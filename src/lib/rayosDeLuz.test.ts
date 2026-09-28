import { describe, it, expect } from 'vitest';
import { DURACION_NUBES, PERIODO_NUBES, hayNubes, DURACION_FADE_IN, factorFadeIn, ESCALA_MINIMA, UMBRAL_CUADRO_MS, siguienteEscala, PERIODO_RAFAGA, calidadDeRender, campoDeSilueta, desenfocar, bordesDeMascara, texturaEnergia, envolventeRafaga, FRAGMENT_SHADER, NUCLEO, T_ESTATICO, detectarNivel, perfilDeNivel, fragmentDeCapa, ANCHO_CAMPO, ENTRADA_LLEGADA, N_CHISPAS_ENTRADA, HALO_INICIO, HALO_APARICION, N_ONDAS_SUELO, PERIODO_ONDAS_SUELO, ANILLOS_INICIO, ANILLOS_APARICION, factorCamaraLenta, FASE_APARECE_FIN, FASE_LENTA_FIN, RALENTI_FACTOR, RALENTI_RAMPA, RALENTI_DURACION_REAL, PROBABILIDAD_RALENTI_CICLO, PROBABILIDAD_RALENTI_TRAS_ACTIVA } from './rayosDeLuz';

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
  it('el primer golpe llega a su máximo (0.55, no 1: se veía más saturado que el segundo, ahora es igual de fuerte) y se repite cada PERIODO_RAFAGA segundos', () => {
    expect(envolventeRafaga(0.15)).toBeCloseTo(0.55, 5);
    expect(envolventeRafaga(0.15 + PERIODO_RAFAGA * 3)).toBeCloseTo(0.55, 5);
  });
  it('el segundo golpe llega al mismo máximo que el primero (misma forma, no más débil)', () => {
    expect(envolventeRafaga(1.6)).toBeCloseTo(0.55, 5);
  });
  it('el cuadro fijo de "reducir movimiento" cae dentro de una ráfaga', () => {
    expect(envolventeRafaga(T_ESTATICO)).toBeGreaterThan(0.3);
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

describe('los arcos tocan el logo (no se cortan antes de llegar)', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 rayos('), FRAGMENT_SHADER.indexOf('vec3 nubes('));
  it('define tocaLogo a partir de la silueta sólida (cf.r) y lo resta al umbral de los 3 arcos y sus halos', () => {
    expect(f()).toContain('float tocaLogo = max(cf.r, cf.b * 0.7) * 0.6;');
    for (const umbral of ['0.57', '0.61', '0.67']) {
      const veces = f().split(`${umbral} + umbralExtra - tocaLogo)`).length - 1;
      expect(veces).toBe(2); // arco() y arcoSuave() con el mismo umbral
    }
  });
  it('sobre la silueta sólida (cf.r = 1) y en el pico de la ráfaga (umbralExtra = 0) el umbral baja lo bastante para que el arco quede prácticamente garantizado', () => {
    // Umbral mínimo (0.57) menos el sesgo máximo (0.6) da negativo: arco(rodea,...,u)
    // hace smoothstep(u, u+0.06, n) con n >= 0, así que con u <= 0 casi siempre es 1.
    const umbralMinimo = 0.57 + 0 - 1 * 0.6;
    expect(umbralMinimo).toBeLessThanOrEqual(0);
  });
  it('lejos del logo (cf.r = 0) el umbral vuelve a ser el original: el comportamiento en espacio abierto no cambia', () => {
    const tocaLogo = (cfR: number) => cfR * 0.6;
    expect(tocaLogo(0)).toBe(0);
  });
});

describe('el halo de cada arco envuelve el logo completo (no se corta donde no hay rayo)', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 rayos('), FRAGMENT_SHADER.indexOf('vec3 nubes('));
  it('h1/h2/h3 usan mix(HALO_BASE, 1.0, arcoSuave(...)) en vez del arcoSuave puro: nunca llegan a 0', () => {
    expect(f()).toContain('float HALO_BASE = 0.70;');
    for (const call of [
      'mix(HALO_BASE, 1.0, arcoSuave(rodea, vec2(bi * 9.1, tramo * 0.9), 0.57 + umbralExtra - tocaLogo))',
      'mix(HALO_BASE, 1.0, arcoSuave(rodea, vec2(bi * 5.3 + 17.0, tramo * 1.1 + 3.0), 0.61 + umbralExtra - tocaLogo))',
      'mix(HALO_BASE, 1.0, arcoSuave(rodea, vec2(bi * 7.7 + 41.0, tramo * 0.8 + 9.0), 0.67 + umbralExtra - tocaLogo))',
    ]) expect(f()).toContain(call);
  });
  it('en el lado sin arco (arcoSuave=0) el halo queda en HALO_BASE, no en 0; donde SÍ hay arco llega a su brillo completo', () => {
    const HALO_BASE = 0.70;
    const mix = (a: number, b: number, x: number) => a * (1 - x) + b * x;
    expect(mix(HALO_BASE, 1.0, 0)).toBe(HALO_BASE);
    expect(mix(HALO_BASE, 1.0, 0)).toBeGreaterThan(0);
    expect(mix(HALO_BASE, 1.0, 1)).toBe(1);
  });
});

describe('cámara lenta durante la ráfaga (ralentiza todo el ambiente, no solo los rayos)', () => {
  it('fase 1 — el rayo aparece a velocidad normal (sin frenar de antemano)', () => {
    expect(factorCamaraLenta(6)).toBe(1); // muy lejos de cualquier ráfaga (t inicial)
    expect(factorCamaraLenta(0)).toBe(1); // arranca el golpe: todavía normal, no hay rampa previa
    expect(factorCamaraLenta(0.5)).toBe(1); // pleno golpe principal (ts 0–1.1)
    expect(factorCamaraLenta(FASE_APARECE_FIN - 0.01)).toBeCloseTo(1, 1);
  });
  it('fase 2 — justo después se activa la cámara lenta y cubre la ráfaga secundaria (ts 1.43–1.98), en una ráfaga que sí le toca (ciclo 0)', () => {
    expect(factorCamaraLenta(FASE_APARECE_FIN + 0.3)).toBeCloseTo(RALENTI_FACTOR, 5);
    expect(factorCamaraLenta(1.7)).toBeCloseTo(RALENTI_FACTOR, 5); // ráfaga secundaria
  });
  it('fase 3 — se apaga la cámara lenta y el resto del ciclo (el rayo terminando de desaparecer) vuelve a la normalidad', () => {
    expect(factorCamaraLenta(FASE_LENTA_FIN + RALENTI_RAMPA + 0.01)).toBeCloseTo(1, 1);
    expect(factorCamaraLenta(PERIODO_RAFAGA - 1)).toBe(1);
  });
  it('las transiciones entre fases son cortas, no de golpe', () => {
    const medioEntrando = factorCamaraLenta(FASE_APARECE_FIN + RALENTI_RAMPA / 2);
    expect(medioEntrando).toBeGreaterThan(RALENTI_FACTOR);
    expect(medioEntrando).toBeLessThan(1);
    const medioSaliendo = factorCamaraLenta(FASE_LENTA_FIN + RALENTI_RAMPA / 2);
    expect(medioSaliendo).toBeGreaterThan(RALENTI_FACTOR);
    expect(medioSaliendo).toBeLessThan(1);
  });
  it('la fase 2 dura los segundos reales pedidos (ancho del tramo / velocidad)', () => {
    const segundosReales = (FASE_LENTA_FIN - FASE_APARECE_FIN) / RALENTI_FACTOR;
    expect(segundosReales).toBeCloseTo(RALENTI_DURACION_REAL, 5);
  });
  it('con reducir movimiento no aplica: ese modo usa un único cuadro fijo, no avanza el reloj', () => {
    // factorCamaraLenta es puro y no distingue "estático"; quien no debe llamarlo con el
    // reloj avanzando es iniciarRayosDeLuz, que en modo estático llama dibujar(T_ESTATICO)
    // una sola vez y nunca entra al bucle que usa tiempoEfecto.
    expect(typeof factorCamaraLenta).toBe('function');
  });
});

describe('la cámara lenta no aparece en todas las ráfagas: en promedio cada 2 o 3, al azar', () => {
  // Un punto dentro del tramo lleno de cámara lenta: si la ráfaga de ese ciclo la tiene,
  // aquí vale RALENTI_FACTOR; si no le tocó esta vez, vale 1 (velocidad normal) todo el ciclo.
  const puntoPico = FASE_APARECE_FIN + 0.3;
  const activaEnCiclo = (bi: number) => factorCamaraLenta(bi * PERIODO_RAFAGA + puntoPico) < 0.99;

  it('no siempre está activa: hay ciclos con cámara lenta y ciclos sin ella', () => {
    const ciclos = Array.from({ length: 60 }, (_, bi) => activaEnCiclo(bi));
    expect(ciclos.some((activa) => activa)).toBe(true);
    expect(ciclos.some((activa) => !activa)).toBe(true);
  });
  it('en promedio aparece cada 2 o 3 ráfagas (ni cada vez, ni una vez cada muchas)', () => {
    const N = 300;
    const activos = Array.from({ length: N }, (_, bi) => activaEnCiclo(bi)).filter(Boolean).length;
    const promedioCadaCuantas = N / activos;
    expect(promedioCadaCuantas).toBeGreaterThan(2);
    expect(promedioCadaCuantas).toBeLessThan(3.3);
  });
  it('es determinista por ciclo (mismo resultado siempre para el mismo ciclo, no cambia cuadro a cuadro)', () => {
    expect(activaEnCiclo(5)).toBe(activaEnCiclo(5));
    expect(factorCamaraLenta(5 * PERIODO_RAFAGA + puntoPico)).toBe(factorCamaraLenta(5 * PERIODO_RAFAGA + puntoPico));
  });
  it('un ciclo sin cámara lenta queda a velocidad normal en TODO el ciclo, no solo en el punto pico', () => {
    const bi = Array.from({ length: 40 }, (_, i) => i).find((i) => !activaEnCiclo(i));
    expect(bi).toBeDefined();
    for (const ts of [0.2, 1, 1.5, 1.7, 2, 5, 10]) {
      expect(factorCamaraLenta((bi as number) * PERIODO_RAFAGA + ts)).toBe(1);
    }
  });
});

describe('las puntas de un arco que queda en el aire se afinan (no quedan gruesas)', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 rayos('), FRAGMENT_SHADER.indexOf('vec3 nubes('));
  it('el grosor de la línea (l1/l2/l3) depende de qué tan adentro del tramo está, no es fijo', () => {
    expect(f()).toContain('float ancho1 = mix(0.0012, 0.026, smoothstep(0.0, 0.45, seg1));');
    expect(f()).toContain('float l1 = smoothstep(ancho1, 0.0, abs(d1)) * seg1 * 2.1;');
    expect(f()).toContain('float ancho2 = mix(0.0012, 0.026, smoothstep(0.0, 0.45, seg2));');
    expect(f()).toContain('float l2 = smoothstep(ancho2, 0.0, abs(d2)) * seg2 * 2.1;');
    expect(f()).toContain('float ancho3 = mix(0.0012, 0.024, smoothstep(0.0, 0.45, seg3));');
    expect(f()).toContain('float l3 = smoothstep(ancho3, 0.0, abs(d3)) * seg3 * 1.6;');
  });
  it('el halo de cada línea (g1/g2/g3) también se angosta hacia la punta: no solo baja de brillo, cambia de ancho', () => {
    expect(f()).toContain('float tasa1 = mix(34.0, 10.0, smoothstep(0.0, 0.45, seg1));');
    expect(f()).toContain('float g1 = exp(-abs(d1) * tasa1) * 1.10 * seg1;');
    expect(f()).toContain('float tasa2 = mix(30.0, 9.0, smoothstep(0.0, 0.45, seg2));');
    expect(f()).toContain('float g2 = exp(-abs(d2) * tasa2) * 1.00 * seg2;');
    expect(f()).toContain('float tasa3 = mix(36.0, 11.0, smoothstep(0.0, 0.45, seg3));');
    expect(f()).toContain('float g3 = exp(-abs(d3) * tasa3) * 0.80 * seg3;');
  });
  it('en la punta (justo donde el tramo empieza o termina) el grosor es casi 0 pero nunca 0 exacto (sin división por cero), y el halo cae mucho más rápido (más angosto)', () => {
    const suave = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const mix = (a: number, b: number, x: number) => a * (1 - x) + b * x;
    const ancho = (seg: number) => mix(0.0012, 0.026, suave(0, 0.45, seg));
    const tasa = (seg: number) => mix(34.0, 10.0, suave(0, 0.45, seg));
    expect(ancho(0)).toBe(0.0012);
    expect(ancho(0)).toBeGreaterThan(0);
    expect(ancho(0.45)).toBe(0.026);
    expect(ancho(0.15)).toBeGreaterThan(ancho(0));
    expect(ancho(0.15)).toBeLessThan(ancho(0.45));
    expect(tasa(0)).toBe(34.0); // en la punta, el halo cae mucho más rápido (más angosto)
    expect(tasa(0.45)).toBe(10.0); // adentro del tramo, el halo ancho de siempre
  });
  it('donde el tramo queda forzado por tocar el logo (seg cerca de 1) el grosor y el halo ya son los de siempre, no afinados', () => {
    const suave = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    expect(suave(0, 0.45, 1)).toBe(1); // seg=1 (dentro de la silueta, forzado) da el ancho y la tasa máximos
  });
});

describe('la trayectoria de los rayos es cuadricular (tramos casi rectos, con esquinas), no redonda ni un zigzag caótico', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 rayos('), FRAGMENT_SHADER.indexOf('vec3 nubes('));
  it('define un escalón angular (radio casi constante por tramo, con un quiebre entre tramos) y lo usa en los 3 arcos, ahora solo como un sesgo menor (ver el describe de "arco eléctrico real": domina el ruido en varias frecuencias)', () => {
    expect(FRAGMENT_SHADER).toContain('float escalonAngular(float rodea, vec2 semilla, float pasos, float dureza) {');
    expect(f()).toContain('escalonAngular(rodea, vec2(bi * 9.1, tramo * 0.9), 16.0, 0.10) * 0.04');
    expect(f()).toContain('escalonAngular(rodea, vec2(bi * 5.3 + 17.0, tramo * 1.1 + 3.0), 13.0, 0.12) * 0.05');
    expect(f()).toContain('escalonAngular(rodea, vec2(bi * 7.7 + 41.0, tramo * 0.8 + 9.0), 20.0, 0.08) * 0.06');
  });
  it('dentro de cada tramo angular el radio es casi constante (un valor de hash), no oscila punto a punto', () => {
    // Lejos del borde entre dos tramos (fract(u) cerca de 0 o 1, fuera de la zona de dureza)
    // el resultado es directamente el hash de esa celda: plano, sin ondular.
    const suave = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const dureza = 0.10;
    expect(suave(0.5 - dureza, 0.5 + dureza, 0.05)).toBe(0); // muy dentro del tramo: puro "a"
    expect(suave(0.5 - dureza, 0.5 + dureza, 0.95)).toBe(1); // muy dentro del siguiente tramo: puro "b"
  });
  it('con más "pasos" hay más tramos (más esquinas) alrededor del logo', () => {
    // j3 (el que se mete sobre el propio logo, "más disperso") tiene más pasos que j1/j2.
    expect(f()).toMatch(/escalonAngular\(rodea, vec2\(bi \* 7\.7 \+ 41\.0, tramo \* 0\.8 \+ 9\.0\), 20\.0/);
  });
});

describe('los rayos se parecen más a un arco eléctrico real (referencia electro.webp): filamento quebrado en varias escalas + ramificaciones', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 rayos('), FRAGMENT_SHADER.indexOf('vec3 nubes('));
  it('el escalón cuadricular ya pesa poco (era demasiado rectangular); domina el ruido en varias frecuencias', () => {
    expect(f()).toContain('escalonAngular(rodea, vec2(bi * 9.1, tramo * 0.9), 16.0, 0.10) * 0.04');
    expect(f()).toContain('escalonAngular(rodea, vec2(bi * 5.3 + 17.0, tramo * 1.1 + 3.0), 13.0, 0.12) * 0.05');
    expect(f()).toContain('escalonAngular(rodea, vec2(bi * 7.7 + 41.0, tramo * 0.8 + 9.0), 20.0, 0.08) * 0.06');
  });
  it('cada arco tiene una capa de ruido fino (alta frecuencia) además de la onda general, para el crepitar', () => {
    expect(f()).toContain('(noise(p * 115.0 + sd * 1.7) - 0.5) * 0.10;');
    expect(f()).toContain('(noise(p * 98.0 + sd * 1.4 + 3.0) - 0.5) * 0.10;');
    expect(f()).toContain('(noise(p * 108.0 + sd * 0.8 + 9.0) - 0.5) * 0.13;');
  });
  it('define ramificacion() (filamento que se afina hasta un punto) y ramas() (unas pocas, no todas cada ráfaga)', () => {
    expect(FRAGMENT_SHADER).toContain('float ramificacion(vec2 p, vec2 origen, vec2 dir, float largo, vec2 semilla) {');
    expect(FRAGMENT_SHADER).toContain('vec3 ramas(vec2 p, vec2 cc, float asp, float bi, float tramo, float ev, float progreso) {');
    expect(FRAGMENT_SHADER).toContain('for (int i = 0; i < 6; i++) {');
    expect(f()).toContain('rayo += ramas(p, cc, asp, bi, tramo, ev, progreso);');
  });
  it('ramificacion() nace con algo de grosor y termina en punta fina (0.0012), y no existe fuera de su propio largo', () => {
    expect(FRAGMENT_SHADER).toContain('float ancho = mix(largo * 0.045, 0.0012, u);');
    expect(FRAGMENT_SHADER).toContain('if (s < 0.0 || s > largo) return 0.0;');
  });
  it('las ramas solo se dibujan en la capa de fondo (no duplicadas también sobre el logo)', () => {
    const dentroDeIf = f().slice(f().indexOf('if (solo < 0.5) {\n    // Resplandor'));
    expect(dentroDeIf).toContain('rayo += ramas(');
  });
  it('las ramas aparecen con menos frecuencia que antes (menos rayos en pantalla), largas y en un color casi blanco-violeta como el de la referencia', () => {
    expect(FRAGMENT_SHADER).toContain('hash(vec2(k * 3.7 + 1.0, bi * 2.1 + 11.0)) < 0.35');
    expect(FRAGMENT_SHADER).toContain('float largo = mix(0.07, 0.20, hash(vec2(k * 4.4 + 4.0, bi * 0.7 + 2.0)));');
    expect(FRAGMENT_SHADER).toContain('vec3 colRama = mix(vec3(0.75, 0.80, 1.0), vec3(1.0, 0.97, 0.92), hash(vec2(k + 0.5, bi + 1.3)));');
    expect(FRAGMENT_SHADER).toContain('return col * ev * 1.6;');
  });
});


describe('el arco que ya se mete sobre el logo a veces llega mucho más cerca del centro (en armonía con el resto, no un elemento aparte)', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 rayos('), FRAGMENT_SHADER.indexOf('vec3 nubes('));
  it('define dip3 (por ángulo, no siempre activo) y lo resta del nivel de d3: mismo seg3, mismo color, solo cambia qué tan cerca del centro pasa', () => {
    expect(f()).toContain('float dip3 = smoothstep(0.60, 0.90, noise1(rodea * 1.1 + bi * 6.3 + 71.0)) * 0.26;');
    expect(f()).toContain('float d3 = cf.g - 0.62 - dip3 + j3;');
  });
  it('dip3 vale 0 la mayor parte del tiempo (arco normal) y hasta 0.26 en los ángulos donde "se mete" hacia el centro', () => {
    const suave = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const dip = (n: number) => suave(0.60, 0.90, n) * 0.26;
    expect(dip(0)).toBe(0);
    expect(dip(0.5)).toBe(0);
    expect(dip(0.9)).toBeCloseTo(0.26, 5);
  });
});

describe('menos rayos a la vez en el anillo (umbral más alto: cada arco cubre menos del círculo)', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 rayos('), FRAGMENT_SHADER.indexOf('vec3 nubes('));
  it('los 3 arcos usan un umbral más alto que antes (0.57/0.61/0.67, antes 0.50/0.54/0.60): menos tramo encendido a la vez', () => {
    expect(f()).toContain('float seg1 = arco(rodea, vec2(bi * 9.1, tramo * 0.9), 0.57 + umbralExtra - tocaLogo);');
    expect(f()).toContain('float seg2 = arco(rodea, vec2(bi * 5.3 + 17.0, tramo * 1.1 + 3.0), 0.61 + umbralExtra - tocaLogo);');
    expect(f()).toContain('float seg3 = arco(rodea, vec2(bi * 7.7 + 41.0, tramo * 0.8 + 9.0), 0.67 + umbralExtra - tocaLogo);');
  });
  it('las ramificaciones no cambiaron con este ajuste (el pedido era sobre los arcos del anillo)', () => {
    expect(FRAGMENT_SHADER).toContain('for (int i = 0; i < 6; i++) {');
    expect(FRAGMENT_SHADER).toContain('hash(vec2(k * 3.7 + 1.0, bi * 2.1 + 11.0)) < 0.35');
  });
});

describe('los quiebres se intercalan cortos y largos (no parejos)', () => {
  it('deforma el ángulo con una onda antes de repartirlo en pasos: comprime unas zonas (quiebres seguidos) y estira otras (tramo largo)', () => {
    expect(FRAGMENT_SHADER).toContain('float rodeaAlt = rodea + 0.6 * sin(rodea * 2.3 + semilla.x * 0.7 + semilla.y);');
    expect(FRAGMENT_SHADER).toContain('float u = (rodeaAlt / 6.2832 + 1.0) * pasos;');
  });
  it('la derivada de la onda varía: donde es alta los pasos se acortan, donde es baja se alargan (no un espaciado constante)', () => {
    const rodeaAlt = (rodea: number) => rodea + 0.6 * Math.sin(rodea * 2.3);
    const paso = 0.001;
    const derivada = (rodea: number) => (rodeaAlt(rodea + paso) - rodeaAlt(rodea - paso)) / (2 * paso);
    const derivadas = [0, 0.5, 1, 1.5, 2, 2.5].map(derivada);
    expect(Math.max(...derivadas) - Math.min(...derivadas)).toBeGreaterThan(0.5);
  });
});

describe('la ráfaga empieza con pocos rayos chicos, crece hacia el pico y vuelve a bajar al terminar', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 rayos('), FRAGMENT_SHADER.indexOf('vec3 nubes('));
  it('define progresoRafaga (0→1→0, un solo arco para toda la ráfaga) y umbralExtra a partir de él', () => {
    expect(FRAGMENT_SHADER).toContain('float progresoRafaga(float t) {');
    expect(FRAGMENT_SHADER).toContain('return smoothstep(0.0, 0.25, ts) * (1.0 - smoothstep(1.5, 1.98, ts));');
    expect(f()).toContain('float progreso = progresoRafaga(t);');
    expect(f()).toContain('float umbralExtra = mix(0.34, 0.0, progreso);');
  });
  it('umbralExtra se suma al umbral de los 3 arcos y sus halos (más umbral = menos círculo encendido = rayos más chicos)', () => {
    expect(f()).toContain('0.57 + umbralExtra - tocaLogo');
    expect(f()).toContain('0.61 + umbralExtra - tocaLogo');
    expect(f()).toContain('0.67 + umbralExtra - tocaLogo');
  });
  it('al arrancar o terminar la ráfaga (progreso=0) el umbral extra es máximo (rayos chicos); en el pico (progreso=1) es 0 (rayos normales)', () => {
    const mix = (a: number, b: number, x: number) => a * (1 - x) + b * x;
    expect(mix(0.34, 0, 0)).toBe(0.34);
    expect(mix(0.34, 0, 1)).toBe(0);
  });
  it('ramas() recibe progreso y cada rama tiene su propio umbral: la primera aparece casi desde el inicio, la última solo cerca del pico', () => {
    expect(FRAGMENT_SHADER).toContain('vec3 ramas(vec2 p, vec2 cc, float asp, float bi, float tramo, float ev, float progreso) {');
    expect(FRAGMENT_SHADER).toContain('if (progreso < (k + 1.0) / 6.0 * 0.85) continue;');
    // rama 0 (primera): umbral bajo, aparece casi de inmediato. Rama 5 (última): umbral alto, solo cerca del pico.
    const umbral = (k: number) => (k + 1) / 6 * 0.85;
    expect(umbral(0)).toBeLessThan(umbral(5));
    expect(umbral(5)).toBeLessThanOrEqual(0.85);
  });
});

describe('el primer golpe se ve tan lleno de rayos como el segundo (progreso llega al pico antes de que el golpe principal se apague)', () => {
  const progreso = (ts: number) => {
    const suave = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    return suave(0, 0.25, ts) * (1 - suave(1.5, 1.98, ts));
  };
  it('ya está en el pico (o casi) durante el golpe principal (ts~0.3-0.5), no solo durante el secundario', () => {
    expect(progreso(0.3)).toBeGreaterThan(0.9);
    expect(progreso(0.5)).toBe(1);
  });
  it('sigue en el pico durante todo el golpe secundario (ts 1.43-1.98) hasta que empieza a apagarse al final', () => {
    expect(progreso(1.43)).toBe(1);
    expect(progreso(1.6)).toBeLessThan(1); // ya empezando a bajar, pero el golpe secundario ya se ve pleno la mayor parte de su duración
    expect(progreso(1.98)).toBeCloseTo(0, 5);
  });
});

describe('la electrificación es menos violenta (parpadeo suave, no un interruptor duro; brillo un poco más bajo)', () => {
  const f = () => FRAGMENT_SHADER.slice(FRAGMENT_SHADER.indexOf('vec3 rayos('), FRAGMENT_SHADER.indexOf('vec3 nubes('));
  it('el parpadeo (flick) se interpola de un valor al siguiente, no salta de golpe (sin step()), y a menor ritmo (10 Hz, no 18)', () => {
    expect(f()).toContain('float pasoF = t * 10.0;');
    expect(f()).toContain('float paso = floor(pasoF);');
    expect(f()).toContain('float flick = 0.78 + 0.16 * mix(flickA, flickB, smoothstep(0.2, 0.8, fract(pasoF)));');
    expect(f()).not.toContain('step(0.30, hash(vec2(paso, 3.3)))'); // el interruptor duro de antes
  });
  it('el rango del parpadeo es más chico que antes (0.16, no 0.30): varía menos, se siente menos agresivo', () => {
    const antes = { base: 0.70, rango: 0.30 };
    const ahora = { base: 0.78, rango: 0.16 };
    expect(ahora.rango).toBeLessThan(antes.rango);
    // El mínimo posible ahora (0.78-0.16=0.62) es más alto que el mínimo de antes (0.70-0.30=0.40*... en realidad step da 0.70 o 1.0):
    expect(ahora.base - ahora.rango).toBeGreaterThan(0.6);
  });
  it('las líneas brillan un poco menos que antes (l1/l2 2.6→2.1, l3 2.0→1.6)', () => {
    expect(f()).toContain('* seg1 * 2.1;');
    expect(f()).toContain('* seg2 * 2.1;');
    expect(f()).toContain('* seg3 * 1.6;');
  });
});

describe('si le tocó cámara lenta a una ráfaga, a la siguiente le baja la probabilidad (para que no salgan seguidas ni muy seguido)', () => {
  const puntoPico = FASE_APARECE_FIN + 0.3;
  const activaEnCiclo = (bi: number) => factorCamaraLenta(bi * PERIODO_RAFAGA + puntoPico) < 0.99;

  it('la probabilidad tras una ráfaga activa es más baja que la normal', () => {
    expect(PROBABILIDAD_RALENTI_TRAS_ACTIVA).toBeLessThan(PROBABILIDAD_RALENTI_CICLO);
  });
  it('en la práctica, justo después de una ráfaga activa rara vez sigue otra activa', () => {
    const N = 400;
    const activos = Array.from({ length: N }, (_, bi) => activaEnCiclo(bi));
    let trasActiva = 0, activaTrasActiva = 0;
    for (let i = 1; i < N; i++) {
      if (activos[i - 1]) {
        trasActiva++;
        if (activos[i]) activaTrasActiva++;
      }
    }
    expect(trasActiva).toBeGreaterThan(10); // que la muestra sí tenga suficientes casos "tras activa"
    const proporcion = activaTrasActiva / trasActiva;
    expect(proporcion).toBeLessThan(0.3); // bastante por debajo del ~0.4 normal
  });
});
