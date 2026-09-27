import { describe, it, expect } from 'vitest';
import { DURACION_NUBES, PERIODO_NUBES, hayNubes, DURACION_FADE_IN, factorFadeIn, ESCALA_MINIMA, UMBRAL_CUADRO_MS, siguienteEscala, PERIODO_RAFAGA, calidadDeRender, campoDeSilueta, desenfocar, bordesDeMascara, texturaEnergia, envolventeRafaga, FRAGMENT_SHADER, NUCLEO, T_ESTATICO, detectarNivel, perfilDeNivel, fragmentDeCapa, ANCHO_CAMPO, ENTRADA_LLEGADA, N_CHISPAS_ENTRADA, HALO_INICIO, HALO_APARICION, N_ONDAS_SUELO, PERIODO_ONDAS_SUELO, ANILLOS_INICIO, ANILLOS_APARICION } from './rayosDeLuz';

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
    expect(FRAGMENT_SHADER).toMatch(/#if defined\(SOBRE\)[\s\S]*?gl_FragColor = [\s\S]*?#elif defined\(DETALLE\)/);
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
  it('las brasas van en la capa superior, la energía en la de detalle del logo y los anillos en el fondo', () => {
    expect(FRAGMENT_SHADER).toMatch(/nubes\(p, fr, asp, t\) \+ brasas\(p, asp, t\)/);
    expect(FRAGMENT_SHADER).toMatch(/#elif defined\(DETALLE\)[\s\S]*?nucleo\(fr, t\) \+ fugaNaranja\(fr, t\) \+ energiaLogo\(fr, t\)/);
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
    expect(fragmentDeCapa('sobre').startsWith('#define SOBRE')).toBe(true);
    expect(fragmentDeCapa('sobre').endsWith(FRAGMENT_SHADER)).toBe(true);
    expect(fragmentDeCapa('detalle').startsWith('#define DETALLE')).toBe(true);
    expect(fragmentDeCapa('detalle').endsWith(FRAGMENT_SHADER)).toBe(true);
    expect(fragmentDeCapa('fondo')).toBe(FRAGMENT_SHADER);
  });
  it('main() separa las dos capas con #ifdef (cada una compila solo lo suyo)', () => {
    const main = FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('void main()'));
    expect(main).toMatch(/#if defined\(SOBRE\)[\s\S]*nubes\(p, fr, asp, t\)[\s\S]*#elif defined\(DETALLE\)[\s\S]*energiaLogo\(fr, t\)[\s\S]*#else[\s\S]*dust\(p, 16\.0[\s\S]*#endif/);
    // Ninguna capa compila lo de otra: lo del logo solo en DETALLE, lo de los rayos solo en SOBRE.
    const sobre = main.slice(main.indexOf('#if defined(SOBRE)'), main.indexOf('#elif defined(DETALLE)'));
    expect(sobre).not.toContain('energiaLogo(');
    expect(sobre).not.toContain('nucleo(');
    const detalle = main.slice(main.indexOf('#elif defined(DETALLE)'), main.indexOf('#else'));
    expect(detalle).not.toContain('rayos(');
    expect(detalle).not.toContain('nubes(');
  });
});

describe('texturas del logo a mayor resolución', () => {
  it('bordesDeMascara acepta un radio mayor: la línea de luz se engrosa en píxeles (para conservar el grosor visual a más resolución)', () => {
    const ancho = 24, alto = 24;
    const m = new Uint8Array(ancho * alto);
    for (let y = 4; y < 20; y++) for (let x = 4; x < 20; x++) m[y * ancho + x] = 255;
    const fino = bordesDeMascara(m, ancho, alto, 2);
    const grueso = bordesDeMascara(m, ancho, alto, 4);
    expect(fino[12 * ancho + 6]).toBe(0); // a 3 px del lado: fuera del borde de radio 2
    expect(grueso[12 * ancho + 6]).toBe(255); // dentro del de radio 4
    expect(grueso[12 * ancho + 9]).toBe(0); // el interior sigue vacío
  });
  it('la capa de detalle se dibuja a los píxeles reales del dispositivo; la ligera, a menos', () => {
    expect(perfilDeNivel('completo').escalaDetalle).toBe(1);
    expect(perfilDeNivel('ligero').escalaDetalle).toBeLessThan(1);
  });
  it('el campo del logo se calcula a un ancho de trabajo fijo y más fino que antes (163 px)', () => {
    expect(ANCHO_CAMPO).toBeGreaterThan(163);
  });
});

describe('entrada del núcleo: chispas que se condensan', () => {
  it('el shader define la entrada (chispas, carga del núcleo y destello) y la usa solo en la capa de detalle', () => {
    for (const f of ['float cargaNucleo(', 'float destelloEntrada(', 'vec3 chispasEntrada(', 'uniform float u_entrada']) expect(FRAGMENT_SHADER).toContain(f);
    const main = FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('void main()'));
    const detalle = main.slice(main.indexOf('#elif defined(DETALLE)'), main.indexOf('#else'));
    expect(detalle).toContain('chispasEntrada(fr, u_entrada)');
    const sobre = main.slice(main.indexOf('#if defined(SOBRE)'), main.indexOf('#elif defined(DETALLE)'));
    expect(sobre).not.toContain('chispasEntrada(');
  });
  it('las chispas de la entrada son redondas y de colores del logo (azul y naranja), sin estela', () => {
    const f = FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 chispasEntrada('), FRAGMENT_SHADER.indexOf('vec3 nucleo('));
    expect(f).toContain('length(q - '); // distancia radial: punto redondo
    expect(f).toContain('vec3(0.15, 0.55, 1.0) : vec3(1.0, 0.50, 0.10)'); // cada chispa: azul eléctrico o naranja, sin mezcla
  });
  it('tras la última llegada el núcleo queda fijo: la carga vale 1 y no hay más chispas', () => {
    expect(FRAGMENT_SHADER).toContain(`if (e >= ${ENTRADA_LLEGADA.toFixed(1)}) return 1.0;`);
    expect(FRAGMENT_SHADER).toContain(`if (e < 0.0 || e > ${ENTRADA_LLEGADA.toFixed(1)}) return vec3(0.0);`);
    // la llegada máxima = espera máx. (0.2 + 1.2) + vuelo máx. (0.8 + 1.5)
    expect(ENTRADA_LLEGADA).toBeCloseTo(0.2 + 1.2 + 0.8 + 1.5, 5);
    expect(N_CHISPAS_ENTRADA).toBeGreaterThan(0);
  });
  it('la carga del núcleo escala el cubo y su brillo (con carga 1 es el núcleo de siempre)', () => {
    expect(FRAGMENT_SHADER).toContain('q = q / mix(0.3, 1.0, smoothstep(0.0, 1.0, carga));');
    expect(FRAGMENT_SHADER).toContain('smoothstep(0.05, 0.9, carga)');
  });
});

describe('polvo según su posición en el haz de luz', () => {
  it('el polvo destella al entrar o salir del haz (orilla) y se apaga lejos del centro del haz', () => {
    expect(FRAGMENT_SHADER).toContain('float enHaz = smoothstep(0.25, 0.95, ra);');
    expect(FRAGMENT_SHADER).toContain('float visibilidadPolvo = (0.30 + 0.70 * enHaz) * (1.0 + 2.8 * enHaz * (1.0 - enHaz));');
    expect(FRAGMENT_SHADER).toMatch(/dust\(p, 9\.0, 0\.06, 13\.0, luz, t\) \* 0\.35\) \* visibilidadPolvo;/);
  });
  it('la visibilidad del polvo vale poco lejos del haz, 1 en el centro y más que en el centro en la orilla', () => {
    const vis = (e: number) => (0.3 + 0.7 * e) * (1 + 2.8 * e * (1 - e));
    expect(vis(0)).toBeCloseTo(0.3, 5);
    expect(vis(1)).toBeCloseTo(1, 5);
    expect(vis(0.5)).toBeGreaterThan(vis(1));
    expect(vis(0.1)).toBeLessThan(vis(1));
  });
});

describe('halo del contorno tras la entrada del núcleo', () => {
  it('el halo empieza a aparecer al formarse el núcleo, no antes', () => {
    expect(HALO_INICIO).toBeLessThan(ENTRADA_LLEGADA);
    expect(HALO_INICIO).toBeGreaterThan(ENTRADA_LLEGADA - 0.5);
    expect(FRAGMENT_SHADER).toContain(`float aparece = smoothstep(${HALO_INICIO.toFixed(1)}, ${(HALO_INICIO + HALO_APARICION).toFixed(1)}, u_entrada);`);
    expect(FRAGMENT_SHADER).toMatch(/\* aparece;/);
  });
  it('el halo es menos intenso que antes (0.17 / 0.14)', () => {
    expect(FRAGMENT_SHADER).toMatch(/\* 0\.12\s+\+ colLenguas \* lenguas \* energia \* 0\.10\) \* fuerza;/);
  });
});

describe('chispas que salen del núcleo, solo tras formarse', () => {
  it('las brasas y las chispas de las ráfagas se multiplican por trasNucleo(), que vale 0 hasta que llega la última chispa de la entrada', () => {
    expect(FRAGMENT_SHADER).toContain('float trasNucleo()');
    expect(FRAGMENT_SHADER).toContain(`smoothstep(${ENTRADA_LLEGADA.toFixed(1)}, ${(ENTRADA_LLEGADA + 0.5).toFixed(1)}, u_entrada)`);
    expect(FRAGMENT_SHADER).toContain('brasas(p, asp, t) * trasNucleo()');
    expect(FRAGMENT_SHADER).toContain('chispas(p, asp, t) * trasNucleo()');
  });
});

describe('brasas brillosas y etéreas', () => {
  it('cada brasa es un punto redondo, limpio y con centro casi blanco (sin halo ni estela), y se apaga despacio', () => {
    const f = FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 brasas('), FRAGMENT_SHADER.indexOf('vec3 anillosSuelo('));
    expect(f).toContain('float d = length(p - pos);'); // distancia radial: redonda
    expect(f).not.toContain('aura'); // sin halo alrededor
    expect(f).not.toMatch(/exp\(-d \* d/);
    expect(f).toContain('float sale = pow(1.0 - u, 1.5);');
    expect(f).toMatch(/vec3\(1\.0, 0\.95, 0\.85\) \* punto \* 0\.5/);
  });
});

describe('chispas sin halo, más rápidas y desde arriba del núcleo', () => {
  it('las chispas de la entrada tampoco llevan halo: solo el punto redondo', () => {
    const f = FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 chispasEntrada('), FRAGMENT_SHADER.indexOf('vec3 nucleo('));
    expect(f).not.toMatch(/exp\(-d \* d/);
    expect(f).toContain('smoothstep(rad, rad * 0.3, d) * brillo');
  });
  it('las brasas viven ~25 % menos que antes (más rápidas)', () => {
    expect(FRAGMENT_SHADER).toContain('float vida = 2.6 + 6.4 * h1;');
  });
  it('las brasas salen justo por encima del núcleo (vértice de arriba del cubo) y dentro de su ancho', () => {
    const f = FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 brasas('), FRAGMENT_SHADER.indexOf('vec3 anillosSuelo('));
    expect(f).toContain('vec2 origen = nucleoP + vec2(0.0, -0.115 * hl);');
    expect(f).toContain('vec2 pos = origen + vec2(');
    expect(f).toContain('float x0 = (hc - 0.5) * 0.16 * wl;');
    // el vértice de arriba del cubo queda a W*0.58 + W*0.4 = 0.98 W del centro: ~0.108 del alto del logo
    expect(NUCLEO.radio * (0.58 + 0.4)).toBeLessThan(0.115);
  });
});

describe('chispas de la entrada: variadas, con fade in y absorbidas', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 chispasEntrada('), FRAGMENT_SHADER.indexOf('vec3 nucleo('));
  it('cada chispa tiene su tamaño, su color y su ritmo de atracción', () => {
    expect(f()).toContain('float rad = mix(0.008, 0.024, hT * hT)');
    expect(f()).toContain('hash(vec2(k, 67.7)) > 0.5 ? vec3(0.15, 0.55, 1.0) : vec3(1.0, 0.50, 0.10)');
    expect(f()).toContain('float ex = 1.4 + 1.8 * hash(vec2(k, 73.1));');
    expect(f()).toContain('(1.0 - pow(u, ex))');
    expect(FRAGMENT_SHADER).toContain('float entradaVuelo(float k) { return 0.8 + 1.5 * hash(vec2(k, 47.3));');
  });
  it('aparecen con un fade in gradual y al llegar son absorbidas (se encogen y se apagan)', () => {
    expect(f()).toContain('smoothstep(0.0, 0.35, u) * (1.0 - smoothstep(0.85, 1.0, u))');
    expect(f()).toContain('float absorbe = smoothstep(0.72, 1.0, u);');
    expect(f()).toContain('(1.0 - 0.75 * absorbe)');
  });
});

describe('anillos del suelo animados', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 anillosSuelo('), FRAGMENT_SHADER.indexOf('float coordHaz('));
  it('son ondas que nacen cerca del centro y crecen hacia afuera con el tiempo', () => {
    expect(f()).toContain(`for (int i = 0; i < ${N_ONDAS_SUELO}; i++)`);
    expect(f()).toContain(`float u = fract(tOnda / ${PERIODO_ONDAS_SUELO.toFixed(1)} + float(i) / ${N_ONDAS_SUELO}.0);`);
    expect(f()).toContain('float radioOnda = 0.12 + 1.75 * (1.0 - pow(1.0 - u, 1.5));');
    expect(f()).toContain('float a = (rr - radioOnda)');
  });
  it('se desvanecen al alejarse: nacen suaves y su brillo cae a 0 al llegar al final del ciclo (sin cortes al reiniciar)', () => {
    expect(f()).toContain('float vida = smoothstep(0.0, 0.10, u) * pow(1.0 - u, 1.3);');
    // espejo TS de la envolvente: 0 al nacer y 0 al terminar, para que la onda que reinicia no "salte"
    const suave = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const vida = (u: number) => suave(0, 0.1, u) * Math.pow(1 - u, 1.3);
    expect(vida(0)).toBe(0);
    expect(vida(0.9999)).toBeLessThan(0.001);
    expect(vida(0.15)).toBeGreaterThan(vida(0.6)); // más brillante al inicio que al final
    const radio = (u: number) => 0.12 + 1.75 * (1 - Math.pow(1 - u, 1.5));
    expect(radio(0)).toBeCloseTo(0.12, 5);
    expect(radio(0.5)).toBeGreaterThan(radio(0.2));
    expect(radio(1)).toBeCloseTo(1.87, 5);
  });
  it('las ondas van desfasadas: hay varias a la vez, no una sola', () => {
    expect(N_ONDAS_SUELO).toBeGreaterThan(1);
  });
});

describe('anillos del suelo: aparecen tras formarse el núcleo', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 anillosSuelo('), FRAGMENT_SHADER.indexOf('float coordHaz('));
  it('empiezan después de que el núcleo se forma y con un fade in gradual', () => {
    expect(ANILLOS_INICIO).toBeGreaterThan(ENTRADA_LLEGADA);
    expect(ANILLOS_APARICION).toBeGreaterThan(1);
    expect(f()).toContain(`float aparecen = smoothstep(${ANILLOS_INICIO.toFixed(1)}, ${(ANILLOS_INICIO + ANILLOS_APARICION).toFixed(1)}, u_entrada);`);
    expect(f()).toContain('cian * anillos * fondo * aparecen * 0.22');
  });
  it('las ondas cuentan desde el inicio de la entrada (la primera nace en el centro); sin animar usan el reloj normal', () => {
    expect(f()).toContain('float tOnda = u_entrada < 500.0 ? max(u_entrada, 0.0) : t;');
  });
  it('el brillo del suelo y la columna de luz no dependen de esa aparición (solo los anillos)', () => {
    expect(f()).toContain('col += cian * exp(-rr * rr * 2.5) * 0.08;');
    expect(f()).toContain('col += cian * exp(-dx * dx) * baja * 0.06;');
  });
});
