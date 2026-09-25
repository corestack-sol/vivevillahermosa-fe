import { describe, it, expect } from 'vitest';
import { DURACION_NUBES, PERIODO_NUBES, hayNubes, DURACION_FADE_IN, factorFadeIn, ESCALA_MINIMA, UMBRAL_CUADRO_MS, siguienteEscala, PERIODO_RAFAGA, calidadDeRender, campoDeSilueta, desenfocar, envolventeRafaga, FRAGMENT_SHADER, NUCLEO, T_ESTATICO } from './rayosDeLuz';

describe('calidadDeRender', () => {
  it('en escritorio usa la densidad del dispositivo con tope de 1.5', () => {
    expect(calidadDeRender(1280, 1)).toBe(1);
    expect(calidadDeRender(1280, 2)).toBe(1.5);
    expect(calidadDeRender(1280, 3)).toBe(1.5);
  });
  it('en pantallas chicas renderiza a menor resolución (batería y fluidez)', () => {
    expect(calidadDeRender(390, 3)).toBe(0.75);
    expect(calidadDeRender(390, 1)).toBe(0.75);
  });
  it('en pantallas muy anchas también baja la resolución', () => {
    expect(calidadDeRender(2560, 1)).toBeCloseTo(0.75);
  });
  it('nunca devuelve 0 ni negativos', () => {
    expect(calidadDeRender(1280, 0)).toBeGreaterThan(0);
  });
});

describe('shader', () => {
  it('declara los uniforms que el código le manda', () => {
    expect(FRAGMENT_SHADER).toContain('uniform vec2 u_res');
    expect(FRAGMENT_SHADER).toContain('uniform float u_t');
    expect(FRAGMENT_SHADER).toContain('uniform float u_solo');
  });
  it('la capa superior solo dibuja los rayos (no repite el fondo)', () => {
    expect(FRAGMENT_SHADER).toMatch(/if \(u_solo > 0\.5\) \{[\s\S]*?return;/);
  });
});

describe('envolventeRafaga', () => {
  it('las ráfagas son esporádicas: fuera del golpe no hay rayos', () => {
    expect(envolventeRafaga(0)).toBe(0);
    expect(envolventeRafaga(3)).toBe(0);
    expect(envolventeRafaga(PERIODO_RAFAGA - 0.1)).toBeCloseTo(0, 5);
  });
  it('en el golpe llega al máximo y se repite cada PERIODO_RAFAGA segundos', () => {
    expect(envolventeRafaga(0.4)).toBeCloseTo(1, 5);
    expect(envolventeRafaga(0.4 + PERIODO_RAFAGA * 3)).toBeCloseTo(1, 5);
  });
  it('hay un segundo golpe más débil poco después', () => {
    const v = envolventeRafaga(1.6);
    expect(v).toBeGreaterThan(0.4);
    expect(v).toBeLessThan(0.6);
  });
  it('el cuadro fijo de "reducir movimiento" cae dentro de una ráfaga', () => {
    expect(envolventeRafaga(T_ESTATICO)).toBeGreaterThan(0.9);
  });
});

describe('campo de silueta (base de los rayos)', () => {
  const ancho = 40, alto = 40;
  // Cuadrado sólido de 10x10 en el centro.
  const alfa = new Uint8Array(ancho * alto);
  for (let y = 15; y < 25; y++) for (let x = 15; x < 25; x++) alfa[y * ancho + x] = 255;

  it('desenfocar reparte la silueta hacia afuera y mantiene su masa aproximada', () => {
    const d = desenfocar(alfa, ancho, alto, 4);
    expect(d[20 * ancho + 26]).toBeGreaterThan(0); // fuera del cuadrado ahora hay campo
    expect(d[0]).toBe(0); // lejos sigue en 0
    const antes = alfa.reduce((a, v) => a + v, 0);
    const despues = d.reduce((a, v) => a + v, 0);
    expect(Math.abs(despues - antes) / antes).toBeLessThan(0.02);
  });
  it('el campo decae al alejarse del logo (permite trazar rayos por nivel)', () => {
    const d = desenfocar(alfa, ancho, alto, 4);
    const cerca = d[20 * ancho + 26], lejos = d[20 * ancho + 32];
    expect(cerca).toBeGreaterThan(lejos);
  });
  it('arma la textura RGBA: R silueta, G y B difuminadas, A opaco', () => {
    const t = campoDeSilueta(alfa, ancho, alto, 4, 2);
    expect(t).toHaveLength(ancho * alto * 4);
    const i = (20 * ancho + 20) * 4;
    expect(t[i]).toBe(255);
    expect(t[i + 3]).toBe(255);
    const f = (20 * ancho + 27) * 4; // justo fuera del borde
    expect(t[f]).toBe(0);
    expect(t[f + 1]).toBeGreaterThan(0);
    expect(t[f + 2]).toBeGreaterThan(0);
  });
});

describe('calidad adaptativa', () => {
  it('con buen rendimiento no toca la escala', () => {
    expect(siguienteEscala(1, 16.7)).toBe(1);
    expect(siguienteEscala(1, UMBRAL_CUADRO_MS)).toBe(1);
  });
  it('si no sostiene ~40 fps baja la resolución un 20 %', () => {
    expect(siguienteEscala(1, 40)).toBeCloseTo(0.8);
    expect(siguienteEscala(0.8, 40)).toBeCloseTo(0.64);
  });
  it('nunca baja de la escala mínima', () => {
    let e = 1;
    for (let i = 0; i < 20; i++) e = siguienteEscala(e, 80);
    expect(e).toBe(ESCALA_MINIMA);
  });
  it('nunca vuelve a subir (evita oscilar entre dos calidades)', () => {
    expect(siguienteEscala(0.64, 8)).toBe(0.64);
  });
});

describe('fade in de la primera aparición', () => {
  it('empieza en negro y termina completo', () => {
    expect(factorFadeIn(0)).toBe(0);
    expect(factorFadeIn(DURACION_FADE_IN)).toBe(1);
    expect(factorFadeIn(DURACION_FADE_IN + 5)).toBe(1);
  });
  it('sube de forma gradual y nunca retrocede', () => {
    let previo = -1;
    for (let s = 0; s <= DURACION_FADE_IN; s += 0.1) {
      const v = factorFadeIn(s);
      expect(v).toBeGreaterThanOrEqual(previo);
      previo = v;
    }
    expect(factorFadeIn(DURACION_FADE_IN / 2)).toBeCloseTo(0.5, 5);
  });
  it('un valor negativo (reloj adelantado) no rompe nada', () => {
    expect(factorFadeIn(-1)).toBe(0);
  });
  it('el shader multiplica el resultado por u_fade', () => {
    expect(FRAGMENT_SHADER).toContain('uniform float u_fade');
    expect(FRAGMENT_SHADER).toContain('col *= u_fade');
  });
});

describe('nubes de energía delante del logo', () => {
  it('no son continuas: pasan en olas y en medio hay silencio', () => {
    expect(hayNubes(0.5)).toBe(true);
    expect(hayNubes(DURACION_NUBES + 0.2)).toBe(false);
    expect(hayNubes(PERIODO_NUBES - 0.2)).toBe(false);
  });
  it('se repiten cada PERIODO_NUBES segundos', () => {
    expect(hayNubes(PERIODO_NUBES * 4 + 1)).toBe(true);
    expect(hayNubes(PERIODO_NUBES * 4 + DURACION_NUBES + 0.5)).toBe(false);
  });
  it('el shader dibuja las nubes solo en la capa superior', () => {
    expect(FRAGMENT_SHADER).toContain('vec3 nubes(');
    expect(FRAGMENT_SHADER).toMatch(/rayos\(p, fr, asp, t, 1\.0\) \+ nubes\(/);
  });
});

describe('núcleo de luz en el hueco del logo', () => {
  it('la apertura y el núcleo caen dentro de la imagen del logo', () => {
    expect(NUCLEO.cx - NUCLEO.hw).toBeGreaterThan(0);
    expect(NUCLEO.cx + NUCLEO.hw).toBeLessThan(1);
    expect(NUCLEO.cy - NUCLEO.hh).toBeGreaterThan(0);
    expect(NUCLEO.cy + NUCLEO.hh).toBeLessThan(1);
    expect(NUCLEO.nx - NUCLEO.radio).toBeGreaterThan(0);
    expect(NUCLEO.ny + NUCLEO.radio).toBeLessThan(1);
  });
  it('el núcleo está en el rombo oscuro medido (0.508, ~0.43), por encima del centro de la imagen no: por debajo del centro de la apertura', () => {
    expect(NUCLEO.nx).toBeCloseTo(0.508, 2);
    expect(NUCLEO.ny).toBeGreaterThan(NUCLEO.cy);
  });
  it('el núcleo sobresale del borde de abajo de la apertura: es lo que recorta su parte inferior', () => {
    expect(NUCLEO.ny + NUCLEO.radio).toBeGreaterThan(NUCLEO.cy + NUCLEO.hh);
  });
  it('el shader lo dibuja en la capa superior y lo recorta al rombo', () => {
    expect(FRAGMENT_SHADER).toContain('vec3 nucleo(');
    expect(FRAGMENT_SHADER).toMatch(/nucleo\(fr, t\)/);
    expect(FRAGMENT_SHADER).toContain('uniform vec2 u_pad');
    expect(FRAGMENT_SHADER).toContain('uniform float u_logoAsp');
  });
});
