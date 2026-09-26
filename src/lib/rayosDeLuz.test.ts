import { describe, it, expect } from 'vitest';
import { DURACION_NUBES, PERIODO_NUBES, hayNubes, DURACION_FADE_IN, factorFadeIn, ESCALA_MINIMA, UMBRAL_CUADRO_MS, siguienteEscala, PERIODO_RAFAGA, calidadDeRender, campoDeSilueta, desenfocar, bordesDeMascara, texturaEnergia, envolventeRafaga, FRAGMENT_SHADER, NUCLEO, T_ESTATICO, detectarNivel, perfilDeNivel, fragmentDeCapa } from './rayosDeLuz';

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
    expect(FRAGMENT_SHADER).toMatch(/#ifdef SOBRE[\s\S]*?gl_FragColor = [\s\S]*?#else/);
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

describe('energía del mock adaptada al logo', () => {
  it('bordesDeMascara marca solo el contorno (~2 px) de una zona, no su interior', () => {
    const ancho = 12, alto = 12;
    const m = new Uint8Array(ancho * alto);
    for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) m[y * ancho + x] = 255;
    const b = bordesDeMascara(m, ancho, alto);
    expect(b[2 * ancho + 2]).toBe(255); // esquina
    expect(b[5 * ancho + 2]).toBe(255); // lado
    expect(b[5 * ancho + 3]).toBe(255); // segundo píxel desde el lado (grosor 2)
    expect(b[5 * ancho + 5]).toBe(0); // interior
    expect(b[0]).toBe(0); // fuera de la zona
  });
  it('texturaEnergia empaqueta bordes y máscaras: R borde azul, G borde naranja, B azul, A naranja', () => {
    const ancho = 8, alto = 8;
    const azul = new Uint8Array(ancho * alto);
    const naranja = new Uint8Array(ancho * alto);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 3; x++) azul[y * ancho + x] = 255;
    for (let y = 0; y < 8; y++) for (let x = 5; x < 8; x++) naranja[y * ancho + x] = 255;
    const tex = texturaEnergia(azul, naranja, ancho, alto);
    const px = (x: number, y: number) => Array.from(tex.slice((y * ancho + x) * 4, (y * ancho + x) * 4 + 4));
    expect(px(1, 4)[2]).toBe(255); // dentro de las capas azules
    expect(px(6, 4)[3]).toBe(255); // dentro de las naranjas
    expect(px(3, 4)).toEqual([0, 0, 0, 0]); // vacío entre ambas
    expect(px(2, 4)[0]).toBe(255); // borde azul (junto al vacío)
    expect(px(5, 4)[1]).toBe(255); // borde naranja
  });
  it('el shader define la energía sobre el logo, las brasas y los anillos del suelo', () => {
    expect(FRAGMENT_SHADER).toContain('vec3 energiaLogo(');
    expect(FRAGMENT_SHADER).toContain('vec3 brasas(');
    expect(FRAGMENT_SHADER).toContain('vec3 anillosSuelo(');
  });
  it('energía y brasas van en la capa superior; los anillos, en el fondo', () => {
    expect(FRAGMENT_SHADER).toMatch(/energiaLogo\(fr, t\) \+ brasas\(p, asp, t\)/);
    expect(FRAGMENT_SHADER).toMatch(/rayos\(p, fr, asp, t, 0\.0\) \+ anillosSuelo\(/);
  });
});

describe('núcleo estilo referencia y luz entre capas', () => {
  it('la textura del logo guarda en el canal alfa la máscara de rendijas (o queda opaca sin ella)', () => {
    const alfa = new Uint8Array([255, 255, 255, 255]);
    const con = campoDeSilueta(alfa, 4, 1, 1, 1, new Uint8Array([0, 255, 255, 0]));
    expect([con[3], con[7], con[11], con[15]]).toEqual([0, 255, 255, 0]);
    const sin = campoDeSilueta(alfa, 4, 1, 1, 1);
    expect([sin[3], sin[7], sin[11], sin[15]]).toEqual([255, 255, 255, 255]);
  });
  it('el núcleo es un cubo cálido y la luz naranja se cuela entre las capas (capa superior)', () => {
    expect(FRAGMENT_SHADER).toContain('vec3 fugaNaranja(');
    expect(FRAGMENT_SHADER).toMatch(/nucleo\(fr, t\) \+ fugaNaranja\(fr, t\)/);
    expect(FRAGMENT_SHADER).toContain('CUBO de luz');
  });
});

describe('niveles de calidad según el equipo', () => {
  it('sin datos del navegador (Safari/Firefox) usa el nivel completo', () => {
    expect(detectarNivel({})).toBe('completo');
  });
  it('ahorro de datos o conexión 2G apagan WebGL (nivel mínimo, solo CSS)', () => {
    expect(detectarNivel({ ahorroDeDatos: true })).toBe('minimo');
    expect(detectarNivel({ conexion: '2g' })).toBe('minimo');
    expect(detectarNivel({ conexion: 'slow-2g', memoriaGB: 16 })).toBe('minimo');
    expect(detectarNivel({ conexion: '3g' })).toBe('completo');
  });
  it('equipos modestos usan el nivel ligero', () => {
    expect(detectarNivel({ memoriaGB: 2 })).toBe('ligero');
    expect(detectarNivel({ nucleos: 4, movil: true })).toBe('ligero');
    expect(detectarNivel({ nucleos: 4, memoriaGB: 4 })).toBe('ligero');
    expect(detectarNivel({ movil: true, dpr: 3, nucleos: 6 })).toBe('ligero');
  });
  it('un equipo potente no baja de nivel', () => {
    expect(detectarNivel({ memoriaGB: 8, nucleos: 8, dpr: 2 })).toBe('completo');
    expect(detectarNivel({ movil: true, nucleos: 8, memoriaGB: 8, dpr: 3 })).toBe('completo');
  });
  it('el nivel ligero dibuja menos cuadros y a menor resolución que el completo', () => {
    const l = perfilDeNivel('ligero'), c = perfilDeNivel('completo');
    expect(l.fpsMax).toBeLessThan(c.fpsMax);
    expect(l.escalaFondo).toBeLessThan(c.escalaFondo);
    expect(l.escalaSobre).toBeLessThan(c.escalaSobre);
  });
  it('siguienteEscala acepta un umbral propio (más holgado con menos fps)', () => {
    expect(siguienteEscala(1, 40, 60)).toBe(1);
    expect(siguienteEscala(1, 70, 60)).toBeCloseTo(0.8);
  });
});

describe('shader por capa', () => {
  it('la capa superior compila con SOBRE definido y la de fondo sin él', () => {
    expect(fragmentDeCapa(true).startsWith('#define SOBRE')).toBe(true);
    expect(fragmentDeCapa(true).endsWith(FRAGMENT_SHADER)).toBe(true);
    expect(fragmentDeCapa(false)).toBe(FRAGMENT_SHADER);
  });
  it('main() separa las dos capas con #ifdef (cada una compila solo lo suyo)', () => {
    const main = FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('void main()'));
    expect(main).toMatch(/#ifdef SOBRE[\s\S]*nubes\(p, fr, asp, t\)[\s\S]*#else[\s\S]*dust\(p, 16\.0[\s\S]*#endif/);
  });
});
