/**
 * Efecto "rayos de luz con polvo" generado en tiempo real (WebGL, un solo
 * fragment shader) — recrea la imagen de src/assets/bg.jfif: fondo negro,
 * haces que salen de la esquina superior izquierda a través de una
 * bruma con textura, y motas de polvo que flotan dentro de los haces.
 *
 * Opcionalmente recibe un "oclusor" (un elemento del DOM con su imagen, ej.
 * el logo): el shader lee su silueta y la luz interactúa con él — un haz más
 * intenso lo atraviesa y proyecta una sombra en dirección contraria a la
 * fuente. Además, cada pocos segundos una ráfaga de rayos eléctricos (arcos
 * azules y naranjas con chispas) recorre su contorno.
 */

/** Segundos entre ráfagas de rayos. Lo usan el shader y la envolvente que sincroniza el CSS. */
export const PERIODO_RAFAGA = 14;

/** Segundos entre "olas" de nubes de energía que suben por delante del logo, y cuánto dura cada una. */
export const PERIODO_NUBES = 6.5;
export const DURACION_NUBES = 3.4;

/**
 * Núcleo de luz eléctrica en el hueco del logo. Medido sobre corestack.png
 * (326×301) y expresado en fracciones de la imagen:
 *  - cx, cy, hw, hh: rombo de la APERTURA del anillo superior (todo lo que se ve
 *    dentro del marco naranja: 158×92 px, centrado en (165, 99) px). El núcleo
 *    solo se pinta dentro de él, con un margen del ~6 % para no pisar el marco.
 *  - nx, ny: dónde está el centro del núcleo: el centro del rombo oscuro del
 *    fondo del hueco, (165.5, 123.9) px, que queda hacia el borde delantero de la
 *    apertura. Por eso el borde de abajo recorta la parte inferior y solo asoma
 *    la de arriba, como si el resto estuviera escondido detrás del anillo.
 *  - radio: semiancho del cubo del núcleo, como fracción del ALTO del logo.
 */
export const NUCLEO = { cx: 0.505, cy: 0.329, hw: 0.228, hh: 0.144, nx: 0.508, ny: 0.385, radio: 0.11 };

/**
 * Entrada del núcleo (chispas que se condensan): cantidad de chispas y segundo (desde que el
 * logo está listo) en que llega la última: espera máx. 1.4 s + vuelo máx. 2.3 s.
 */
export const N_CHISPAS_ENTRADA = 24;
export const ENTRADA_LLEGADA = 3.7;

/** Anillos del suelo: ondas que crecen de adentro hacia afuera y se desvanecen; cuántas hay a la vez y segundos que dura el ciclo de cada una. */
export const N_ONDAS_SUELO = 4;
export const PERIODO_ONDAS_SUELO = 60.0;
/** El halo del contorno del logo empieza a aparecer al formarse el núcleo (destello) y tarda HALO_APARICION s en llegar a su intensidad. */
export const HALO_INICIO = ENTRADA_LLEGADA - 0.1;
export const HALO_APARICION = 1.6;
/** Los anillos del suelo aparecen (fade in) justo después de formarse el núcleo: empiezan ANILLOS_INICIO s después de que el logo está listo y tardan ANILLOS_APARICION s en verse completos. */
export const ANILLOS_INICIO = ENTRADA_LLEGADA + 0.2;
export const ANILLOS_APARICION = 2.5;

/** Relleno alrededor del logo en la textura (fracción de su tamaño): los rayos salen fuera de la silueta. */
export const RELLENO_SILUETA = 0.45;

export const VERTEX_SHADER = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_t;
uniform sampler2D u_tex2;  // energía del logo: R borde azul, G borde naranja, B capas azules, A capas naranjas
uniform sampler2D u_tex;   // campo del oclusor: R silueta, G y B silueta difuminada (ancha y fina)
uniform vec4 u_occ;        // rect de la textura (logo + relleno) en fracciones del canvas: x, y (arriba-izq), ancho, alto
uniform float u_hayOcc;    // 1.0 si hay oclusor con textura lista
uniform vec2 u_pad;         // relleno de la textura del logo (fracción de su tamaño, x e y)
uniform float u_logoAsp;   // ancho / alto de la imagen del logo
uniform float u_fade;      // 0 → 1: aparición gradual de todo el efecto la primera vez
uniform float u_entrada;   // segundos desde que el logo está listo (entrada del núcleo); -1 = aún no, muy grande = ya pasó
uniform float u_solo;      // 1.0: capa superior (solo los rayos, para ir SOBRE el logo)

// Hash sin patrones visibles (Hoskins) e interpolación quíntica: sin bordes
// duros ni cuadrícula en la bruma.
// 0 mientras el núcleo se forma (entrada) y 1 justo después: las chispas que salen
// proyectadas del núcleo hacia arriba no existen hasta que el cubo ya está formado.
float trasNucleo() {
  return smoothstep(${ENTRADA_LLEGADA.toFixed(1)}, ${(ENTRADA_LLEGADA + 0.5).toFixed(1)}, u_entrada);
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}
float noise1(float x) {
  float i = floor(x), f = fract(x);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(hash(vec2(i, 3.7)), hash(vec2(i + 1.0, 3.7)), f);
}

// Campo del oclusor en el punto f (fracciones del canvas): x = silueta,
// y = silueta difuminada (ancha), z = difuminada (fina). Fuera de la textura, 0.
vec3 campo(vec2 f) {
  vec2 l = (f - u_occ.xy) / u_occ.zw;
  float dentro = step(0.0, l.x) * step(l.x, 1.0) * step(0.0, l.y) * step(l.y, 1.0);
  return texture2D(u_tex, clamp(l, 0.0, 1.0)).rgb * dentro;
}
float ocluso(vec2 f) { return campo(f).r; }

// Ráfagas de rayos: cada ${PERIODO_RAFAGA} s un golpe fuerte (~1 s) y, poco después, uno
// más débil. Debe coincidir con envolventeRafaga() de rayosDeLuz.ts.
float rafaga(float t) {
  float ts = mod(t, ${PERIODO_RAFAGA.toFixed(1)});
  // El primer golpe se veía más saturado que el segundo (más brillante Y más largo: 1.1 s
  // contra 0.55 s). Ahora usa la MISMA forma que el segundo (mismo brillo máximo 0.55, misma
  // duración), solo que arranca en ts=0 en vez de ts=1.43: se ven igual de llenos de rayos.
  float a = 0.55 * smoothstep(0.0, 0.08, ts) * (1.0 - smoothstep(0.22, 0.55, ts));
  float b = 0.55 * smoothstep(1.43, 1.51, ts) * (1.0 - smoothstep(1.65, 1.98, ts));
  return max(a, b);
}

// Progreso de TODA la ráfaga (0 → 1 → 0, un solo arco a lo largo del golpe principal y el
// secundario): a diferencia de rafaga() (el brillo, con sus dos golpes por separado), esto
// se usa para la CANTIDAD y el tamaño de los rayos — empieza con pocos y chicos, crece
// hacia el pico y vuelve a bajar al terminar, en vez de aparecer todos de golpe.
float progresoRafaga(float t) {
  float ts = mod(t, ${PERIODO_RAFAGA.toFixed(1)});
  // Sube rápido (0 a 0.25 s) para llegar al pico ANTES de que el golpe principal empiece a
  // apagarse (ts 0.5): así el primer golpe se ve tan lleno de rayos como el segundo, no
  // solo el segundo. Se mantiene arriba hasta el final del golpe secundario y ahí sí baja.
  return smoothstep(0.0, 0.25, ts) * (1.0 - smoothstep(1.5, 1.98, ts));
}

// Motas de polvo: una por celda. Cada mota tiene su propia velocidad, fase y
// frecuencias, así que se mueven sin patrón común (deriva errática, con
// arranques y giros), visibles solo dentro de los haces. La deriva global es
// mínima; el movimiento lo pone cada mota, dentro de su celda (±0.4) para que
// no se corte en el borde.
float dust(vec2 p, float scale, float speed, float seed, float luz, float t) {
  vec2 g = p * scale + vec2(t * speed * 0.10, t * speed * 0.16);
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id + seed);
  vec2 r1 = vec2(hash(id + seed + 1.3), hash(id + seed + 2.7));
  vec2 r2 = vec2(hash(id + seed + 5.9), hash(id + seed + 8.3));
  vec2 r3 = vec2(hash(id + seed + 11.1), hash(id + seed + 14.6));
  float v = speed * 6.0;
  // Tres senoidales por eje con frecuencias y fases propias: no se nota periodicidad.
  vec2 off = (r1 - 0.5) * 0.30;
  off.x += 0.13 * sin(t * v * (0.6 + r2.x * 1.6) + r3.x * 6.28)
         + 0.09 * sin(t * v * (1.7 + r2.y * 2.3) + r1.y * 6.28)
         + 0.05 * sin(t * v * (3.9 + r3.y * 3.1) + h * 6.28);
  off.y += 0.13 * sin(t * v * (0.7 + r3.y * 1.5) + r2.x * 6.28)
         + 0.09 * sin(t * v * (1.9 + r1.x * 2.1) + r3.x * 6.28)
         + 0.05 * sin(t * v * (4.3 + r2.y * 2.9) + r1.x * 6.28);
  float d = length(f - off);
  float size = mix(0.025, 0.075, hash(id + seed + 4.1));
  float brillo = 0.55 + 0.45 * sin(t * (0.8 + h * 2.0) + h * 6.28);
  return smoothstep(size, 0.0, d) * step(0.58, h) * brillo * luz;
}


// Altura de una chispa en el tiempo tau desde que sale: tiro parabólico con
// gravedad que rebota en el suelo (yF) perdiendo energía en cada bote. Es
// analítico (sin estado): tramo de vuelo, primer rebote, segundo rebote.
float alturaChispa(float tau, float y0, float vy0, float yF) {
  const float g = 3.0;
  const float e = 0.5;
  float t1 = (-vy0 + sqrt(max(vy0 * vy0 - 2.0 * g * (y0 - yF), 0.0))) / g; // primer contacto
  if (tau < t1) return y0 + vy0 * tau + 0.5 * g * tau * tau;
  float v1 = -(vy0 + g * t1) * e; // sale hacia arriba (negativo) con la mitad de energía
  float u = tau - t1;
  float t2 = -2.0 * v1 / g;
  if (u < t2) return yF + v1 * u + 0.5 * g * u * u;
  float v2 = v1 * e;
  u -= t2;
  float t3 = -2.0 * v2 / g;
  if (u < t3) return yF + v2 * u + 0.5 * g * u * u;
  return yF;
}

// Chispas de cortocircuito: al aparecer los rayos, un puñado de chispas sale
// disparado del contorno del logo y cae por la gravedad, zigzagueando un poco;
// las que salen por debajo del logo rebotan en el suelo (dos botes que se van apagando). Todo se calcula en
// forma analítica a partir del tiempo desde el golpe (sin estado): cada golpe
// (dos por ráfaga) tiene sus propias chispas. Solo corre cerca del logo.
vec3 chispas(vec2 p, float asp, float t) {
  vec2 cc = vec2((u_occ.x + u_occ.z * 0.5) * asp, u_occ.y + u_occ.w * 0.5);
  if (length(p - cc) > 1.0) return vec3(0.0);
  // Tamaño del logo (la textura lleva 45 % de relleno por lado: 1.9 veces el logo).
  vec2 radio = vec2(0.5 * u_occ.z * asp, 0.5 * u_occ.w) / 1.9;
  float ts = mod(t, ${PERIODO_RAFAGA.toFixed(1)});
  float bi = floor(t / ${PERIODO_RAFAGA.toFixed(1)});
  vec3 sumaCol = vec3(0.0);
  for (int e = 0; e < 2; e++) {
    float ini = e == 0 ? 0.08 : 1.46;
    for (int i = 0; i < 7; i++) {
      float k = float(i);
      vec2 sem = vec2(k * 7.13 + float(e) * 31.7, bi * 3.77 + float(e) * 11.3);
      float tau = (ts - ini) - hash(sem + 1.7) * 0.07; // escalonadas al arrancar
      // Cada golpe tiene dos focos de cortocircuito en lugares al azar del
      // contorno (distintos en cada golpe y en cada ráfaga); las chispas salen
      // en abanico desde su foco.
      float foco = k < 4.0 ? 0.0 : 1.0;
      vec2 semF = vec2(bi * 13.7 + float(e) * 5.3, foco * 9.1 + 2.3);
      float aF = hash(semF) * 6.2831;
      vec2 puntoF = cc + vec2(cos(aF), sin(aF)) * radio * (0.75 + 0.45 * hash(semF + 4.4));
      // Solo las que salen por debajo del logo llegan al suelo y rebotan; las
      // demás describen su parábola y se apagan en el aire.
      bool rebota = puntoF.y > cc.y + radio.y * 0.25;
      float vida = rebota ? 0.95 + 0.35 * hash(sem + 2.9) : 0.45 + 0.20 * hash(sem + 2.9);
      if (tau < 0.0 || tau > vida) continue;
      float a = aF + (hash(sem) - 0.5) * 2.4;
      float vel = 0.35 + 0.85 * hash(sem + 5.1);
      vec2 dir = vec2(cos(a), sin(a));
      vec2 origen = puntoF + (vec2(hash(sem + 3.3), hash(sem + 7.7)) - 0.5) * 0.03;
      // El suelo: cada chispa cae a una profundidad distinta de la rejilla.
      float yF = rebota ? max(0.86 + 0.12 * hash(sem + 9.9), origen.y + 0.05) : 100.0; // 100 = sin suelo
      float vx = dir.x * vel * 0.6;
      float vy0 = dir.y * vel;
      vec2 pos = vec2(origen.x + vx * tau * (1.0 - 0.35 * tau / vida), alturaChispa(tau, origen.y, vy0, yF));
      // Zigzag corto, como el arco que salta.
      pos.x += sin(tau * 45.0 + hash(sem + 8.8) * 6.28) * 0.004;
      float tauAntes = max(0.0, tau - 0.012);
      vec2 posAntes = vec2(origen.x + vx * tauAntes * (1.0 - 0.35 * tauAntes / vida), alturaChispa(tauAntes, origen.y, vy0, yF));
      // Distancia del píxel al trazo de la chispa (cabeza brillante y estela).
      vec2 seg = pos - posAntes;
      float u = clamp(dot(p - posAntes, seg) / max(dot(seg, seg), 1e-6), 0.0, 1.0);
      float d = length(p - (posAntes + seg * u));
      float vive = pow(1.0 - tau / vida, 1.5);
      float titila = 0.65 + 0.35 * step(0.4, hash(vec2(k, floor(t * 30.0))));
      float nucleo = smoothstep(0.0042, 0.0, d);
      float brillo = exp(-d * 95.0) * 0.55; // pequeño resplandor del propio color
      vec3 col = hash(sem + 6.6) < 0.6 ? vec3(1.0, 0.50, 0.06) : vec3(0.22, 0.60, 1.0);
      sumaCol += (mix(col, vec3(1.0, 0.96, 0.88), nucleo) * nucleo + col * brillo) * vive * titila;
    }
  }
  return sumaCol * 1.8;
}

// Tramo de arco alrededor del logo: ruido muestreado sobre un círculo (sin
// costura en el ángulo ±π) con lomas muy anchas, así cada rayo es un tramo largo que puede envolver el logo
// y hay pocos a la vez.

// Trayectoria cuadricular, como el trazo de un circuito impreso: el círculo se reparte en
// "pasos" tramos angulares, cada uno a un radio casi constante, con un escalón entre un
// tramo y el siguiente (no una curva pareja, y tampoco un zigzag caótico). dureza chica
// = esquinas más marcadas entre escalones.
float escalonAngular(float rodea, vec2 semilla, float pasos, float dureza) {
  // Los quiebres se intercalan cortos y largos (no parejos): se deforma el ángulo con una
  // onda antes de repartirlo en pasos iguales — donde la onda comprime, los pasos quedan
  // seguidos (tramo corto entre quiebres); donde estira, quedan separados (tramo largo).
  float rodeaAlt = rodea + 0.6 * sin(rodea * 2.3 + semilla.x * 0.7 + semilla.y);
  float u = (rodeaAlt / 6.2832 + 1.0) * pasos;
  float celda = floor(u);
  float a = hash(vec2(celda, semilla.x + semilla.y * 7.0));
  float b = hash(vec2(celda + 1.0, semilla.x + semilla.y * 7.0));
  float t = smoothstep(0.5 - dureza, 0.5 + dureza, fract(u));
  return mix(a, b, t) - 0.5;
}

float arco(float rodea, vec2 semilla, float umbral) {
  float n = noise(vec2(cos(rodea), sin(rodea)) * 0.75 + semilla);
  return smoothstep(umbral, umbral + 0.06, n);
}

// Igual que arco() pero con bordes muy suaves: reparte el halo de luz de cada
// rayo a lo largo de su tramo sin cortes secos.
float arcoSuave(float rodea, vec2 semilla, float umbral) {
  float n = noise(vec2(cos(rodea), sin(rodea)) * 0.75 + semilla);
  return smoothstep(umbral - 0.17, umbral + 0.20, n);
}

// Filamento delgado que sale disparado desde origen en dirección dir (unitaria) y se
// afina hasta un punto en la punta, como las chispas que se desprenden de un arco
// eléctrico real (ver referencia src/assets/electro.webp): no es recto, se quiebra en dos
// escalas de ruido a lo largo de su propio eje.
float ramificacion(vec2 p, vec2 origen, vec2 dir, float largo, vec2 semilla) {
  vec2 perpDir = vec2(-dir.y, dir.x);
  vec2 rel = p - origen;
  float s = dot(rel, dir);
  if (s < 0.0 || s > largo) return 0.0;
  float perp = dot(rel, perpDir);
  float u = s / largo;
  float quiebreGrande = (noise(vec2(s * 90.0, 0.0) + semilla) - 0.5) * largo * 0.30;
  float quiebreChico = (noise(vec2(s * 240.0, 11.0) + semilla) - 0.5) * largo * 0.09;
  float centro = quiebreGrande + quiebreChico;
  float d = abs(perp - centro);
  float ancho = mix(largo * 0.045, 0.0012, u); // nace del tronco con algo de grosor, termina en un punto
  float linea = smoothstep(ancho, 0.0, d);
  float aparece = smoothstep(0.0, 0.12, u) * (1.0 - smoothstep(0.72, 1.0, u));
  return linea * aparece;
}

// Un puñado de ramificaciones que salen disparadas del arco hacia afuera, en puntos y
// direcciones distintas en cada ráfaga (algunas ni aparecen). Radio aproximado: no hace
// falta que nazcan exactas sobre el trazo quebrado del arco, son cortas y fuera de la
// silueta nadie compara el milímetro.
vec3 ramas(vec2 p, vec2 cc, float asp, float bi, float tramo, float ev, float progreso) {
  vec3 col = vec3(0.0);
  float radioBase = (u_occ.z * asp + u_occ.w) * 0.25 * 1.14;
  for (int i = 0; i < 6; i++) {
    float k = float(i);
    // Cada rama tiene su propio umbral de progreso: la primera aparece casi desde que
    // arranca la ráfaga, la última solo cerca del pico — así el número de ramas también
    // sube y baja con la ráfaga, no aparecen todas de golpe ni se apagan de golpe.
    if (progreso < (k + 1.0) / 6.0 * 0.85) continue;
    if (hash(vec2(k * 3.7 + 1.0, bi * 2.1 + 11.0)) < 0.35) continue; // menos ramas por ráfaga que antes
    float ang = hash(vec2(k * 5.3 + 2.0, bi * 1.7 + tramo * 0.3 + 4.0)) * 6.2832;
    vec2 dirFuera = normalize(vec2(cos(ang), sin(ang) * 0.9));
    vec2 origen = cc + dirFuera * radioBase;
    float giro = (hash(vec2(k * 2.1 + 3.0, bi * 3.3 + 8.0)) - 0.5) * 1.5; // se desvía de lo puramente radial
    float c = cos(giro), sn = sin(giro);
    vec2 dir = vec2(dirFuera.x * c - dirFuera.y * sn, dirFuera.x * sn + dirFuera.y * c);
    float largo = mix(0.07, 0.20, hash(vec2(k * 4.4 + 4.0, bi * 0.7 + 2.0)));
    float v = ramificacion(p, origen, dir, largo, vec2(k * 9.9, bi * 5.5 + 1.0));
    // Casi blanco-violeta, como el arco de la foto de referencia (electro.webp), en vez
    // de los azules/naranjas del resto del efecto: así se distinguen del halo del logo.
    vec3 colRama = mix(vec3(0.75, 0.80, 1.0), vec3(1.0, 0.97, 0.92), hash(vec2(k + 0.5, bi + 1.3)));
    col += colRama * v;
  }
  return col * ev * 1.6;
}

// Rayos eléctricos alrededor (y sobre) el logo. Cada rayo es una línea de nivel
// del campo difuminado del logo, deformada con ruido que salta a ~18 Hz (el arco
// cambia de camino y parpadea); solo se ven tramos, que cambian en cada
// ráfaga. Con solo = 1 (capa superior, que va SOBRE el logo) únicamente se
// dibuja lo que cae encima de su silueta; la capa del fondo dibuja el resto.
vec3 rayos(vec2 p, vec2 fr, float asp, float t, float solo) {
  // Las chispas (capa superior) duran más que la ráfaga porque rebotan en el suelo.
  vec3 chis = solo > 0.5 ? chispas(p, asp, t) * trasNucleo() : vec3(0.0);
  float ev = rafaga(t);
  if (ev < 0.01) return chis;
  vec3 cf = campo(fr);
  vec2 cc = vec2((u_occ.x + u_occ.z * 0.5) * asp, u_occ.y + u_occ.w * 0.5);
  float rodea = atan(p.y - cc.y, p.x - cc.x);
  // Antes cambiaba de golpe 18 veces por segundo (un interruptor duro, step()): se sentía
  // como una descarga violenta parpadeando. Ahora es más lento (10 Hz) y se interpola de un
  // valor al siguiente en vez de saltar, y el rango de brillo es más chico (0.16, no 0.30):
  // un parpadeo suave, no una electrificación agresiva.
  float pasoF = t * 10.0;
  float paso = floor(pasoF);
  vec2 sd = vec2(paso * 3.71, paso * 1.93);
  float flickA = hash(vec2(paso, 3.3));
  float flickB = hash(vec2(paso + 1.0, 3.3));
  float flick = 0.78 + 0.16 * mix(flickA, flickB, smoothstep(0.2, 0.8, fract(pasoF)));
  float bi = floor(t / ${PERIODO_RAFAGA.toFixed(1)});
  float tramo = floor(t * 4.0);
  float naranja = step(0.5, noise1(rodea * 1.3 + bi * 3.7 + 30.0));
  // El tramo visible de cada arco arrancaba y terminaba en cualquier ángulo al azar,
  // así que a veces se veía cortado, sin llegar a tocar el logo. Bajando el umbral
  // donde el punto SÍ cae sobre la silueta sólida, el arco queda encendido justo ahí:
  // su inicio y su final siempre coinciden con el contorno del logo, como si lo
  // recorriera por delante (capa "sobre", visible = cf.r) y por detrás (capa de
  // fondo, detrás de la imagen real, visible en los huecos transparentes).
  float tocaLogo = max(cf.r, cf.b * 0.7) * 0.6;
  // Al arrancar y al terminar la ráfaga se ven pocos rayos y cortos; hacia el pico, más y
  // más largos. Un umbral extra que empieza alto (casi nada encendido) y baja a 0 en el
  // pico, sumado al umbral normal de cada arco: a más umbral, arco() enciende menos círculo.
  float progreso = progresoRafaga(t);
  float umbralExtra = mix(0.34, 0.0, progreso);

  // Reflejo en el suelo (solo capa de fondo): una luz eléctrica tenue, ancha y
  // baja, bajo el logo (la rejilla del suelo empieza hacia el 80 % de la altura).
  vec3 piso = vec3(0.0);
  if (solo < 0.5) {
    float dx = (p.x - cc.x) / 0.55;
    float dy = (p.y - 0.90) / 0.11;
    piso = mix(vec3(0.05, 0.42, 1.0), vec3(1.0, 0.42, 0.05), naranja * 0.3)
         * exp(-(dx * dx + dy * dy)) * 0.20 * ev * (0.6 + 0.4 * flick);
  }
  // Lejos del logo el campo vale 0 y no hay rayos que calcular: descartar aquí
  // ahorra ~90 % del trabajo de la ráfaga (si no, la GPU se trababa justo cuando
  // aparecen los rayos y todo parecía congelarse).
  if (cf.g < 0.02) return piso + chis;

  // Arco cercano al contorno. Como el arco eléctrico real de la referencia (electro.webp):
  // un filamento fino y quebrado en muchas escalas a la vez (no una curva redonda, no un
  // bloque cuadriculado limpio, no una maraña gruesa): un poco de escalón para que no sea
  // perfectamente circular, una onda suave para la forma general y dos capas de ruido más
  // fino encima para el crepitar — grietas chicas dentro de otras más grandes.
  float j1 = escalonAngular(rodea, vec2(bi * 9.1, tramo * 0.9), 16.0, 0.10) * 0.04
           + (fbm(p * 22.0 + sd) - 0.5) * 0.08
           + (noise(p * 55.0 + sd.yx) - 0.5) * 0.13
           + (noise(p * 115.0 + sd * 1.7) - 0.5) * 0.10;
  float d1 = cf.g - 0.38 + j1;
  float seg1 = arco(rodea, vec2(bi * 9.1, tramo * 0.9), 0.57 + umbralExtra - tocaLogo);
  // Arco más alejado, pero ya no tan lejos como para redondearse (mismo motivo que arriba).
  float j2 = escalonAngular(rodea, vec2(bi * 5.3 + 17.0, tramo * 1.1 + 3.0), 13.0, 0.12) * 0.05
           + (fbm(p * 16.0 + sd * 1.3 + 7.0) - 0.5) * 0.10
           + (noise(p * 46.0 + sd) - 0.5) * 0.12
           + (noise(p * 98.0 + sd * 1.4 + 3.0) - 0.5) * 0.10;
  float d2 = cf.g - 0.24 + j2;
  float seg2 = arco(rodea, vec2(bi * 5.3 + 17.0, tramo * 1.1 + 3.0), 0.61 + umbralExtra - tocaLogo);
  // Arco que se mete sobre el propio logo (más disperso: el más quebrado de los tres).
  float j3 = escalonAngular(rodea, vec2(bi * 7.7 + 41.0, tramo * 0.8 + 9.0), 20.0, 0.08) * 0.06
           + (fbm(p * 18.0 + sd * 0.9 + 13.0) - 0.5) * 0.20
           + (noise(p * 50.0 + sd.yx * 1.1) - 0.5) * 0.20
           + (noise(p * 108.0 + sd * 0.8 + 9.0) - 0.5) * 0.13;
  // El mismo arco 3 (mismo color, mismo halo, mismo ritmo) se acerca mucho más al centro
  // en algunos ángulos (una "lengua" que se mete hacia el núcleo, no un filamento aparte):
  // así hay energía cruzando hacia el medio del logo, en armonía con el resto del arco.
  float dip3 = smoothstep(0.60, 0.90, noise1(rodea * 1.1 + bi * 6.3 + 71.0)) * 0.26;
  float d3 = cf.g - 0.62 - dip3 + j3;
  float seg3 = arco(rodea, vec2(bi * 7.7 + 41.0, tramo * 0.8 + 9.0), 0.67 + umbralExtra - tocaLogo);

  vec3 azulNucleo = vec3(0.85, 0.95, 1.0);
  vec3 azulGlow = vec3(0.0, 0.40, 1.0);
  vec3 narNucleo = vec3(1.0, 0.92, 0.68);
  vec3 narGlow = vec3(1.0, 0.40, 0.02);

  // El grosor de la línea crece con qué tan "adentro" del tramo está (seg1/2/3 ya es
  // continuo 0→1, no un interruptor de golpe): así la punta, donde el tramo empieza o
  // termina en el aire, se afina hasta quedar bien fina en vez de cortarse de golpe con
  // el mismo grosor que tiene a la mitad del rayo. Un mínimo (no 0) evita que el ancho
  // llegue a 0 justo (division por cero dentro del smoothstep).
  // Afinado más marcado que el primer intento: la punta llega casi a 0 de grosor (no
  // solo 0.006) y tarda más en alcanzar el grosor completo (hasta seg=0.45, no 0.35),
  // así hay un tramo de punta fina más largo y notorio. El halo de cada línea (g1/g2/g3)
  // también se angosta hacia la punta (tasa de caída más alta = resplandor más estrecho):
  // si solo se afinaba la línea, el halo ancho de alrededor seguía viéndose como un
  // bulto borroso del mismo grosor, y la punta no se leía fina.
  float ancho1 = mix(0.0012, 0.026, smoothstep(0.0, 0.45, seg1));
  float l1 = smoothstep(ancho1, 0.0, abs(d1)) * seg1 * 2.1;
  float tasa1 = mix(34.0, 10.0, smoothstep(0.0, 0.45, seg1));
  float g1 = exp(-abs(d1) * tasa1) * 1.10 * seg1;
  float ancho2 = mix(0.0012, 0.026, smoothstep(0.0, 0.45, seg2));
  float l2 = smoothstep(ancho2, 0.0, abs(d2)) * seg2 * 2.1;
  float tasa2 = mix(30.0, 9.0, smoothstep(0.0, 0.45, seg2));
  float g2 = exp(-abs(d2) * tasa2) * 1.00 * seg2;
  float ancho3 = mix(0.0012, 0.024, smoothstep(0.0, 0.45, seg3));
  float l3 = smoothstep(ancho3, 0.0, abs(d3)) * seg3 * 1.6;
  float tasa3 = mix(36.0, 11.0, smoothstep(0.0, 0.45, seg3));
  float g3 = exp(-abs(d3) * tasa3) * 0.80 * seg3;
  // Solo cerca del logo: lejos el campo vale 0 y el ruido dibujaría contornos sueltos.
  float cerca = smoothstep(0.03, 0.12, cf.g);
  // El campo termina en el borde de la textura: se apaga hacia allá para que el
  // halo ancho no quede cortado en línea recta.
  vec2 l = (fr - u_occ.xy) / u_occ.zw;
  float borde = smoothstep(0.0, 0.22, min(min(l.x, 1.0 - l.x), min(l.y, 1.0 - l.y)));
  float visible = (solo > 0.5 ? cf.r : 1.0 - 0.9 * cf.r) * cerca * borde;

  // Halo de luz del propio color de cada rayo: ancho y suave, como el reflejo del
  // arco sobre el logo (en la capa superior cae encima de su superficie). Antes se
  // apagaba del todo donde no había arco (mismo ángulo que seg1/seg2/seg3), y esa
  // zona se veía "cortada" junto a un lado bien iluminado. Con HALO_BASE nunca baja
  // de un mínimo: envuelve el logo por completo, más brillante justo donde SÍ pasa
  // el arco de esta ráfaga.
  vec3 azulHalo = vec3(0.05, 0.42, 1.0);
  vec3 narHalo = vec3(1.0, 0.42, 0.05);
  float HALO_BASE = 0.70;
  float h1 = exp(-abs(d1 - 0.5 * j1) * 3.6) * mix(HALO_BASE, 1.0, arcoSuave(rodea, vec2(bi * 9.1, tramo * 0.9), 0.57 + umbralExtra - tocaLogo));
  float h2 = exp(-abs(d2 - 0.5 * j2) * 3.4) * mix(HALO_BASE, 1.0, arcoSuave(rodea, vec2(bi * 5.3 + 17.0, tramo * 1.1 + 3.0), 0.61 + umbralExtra - tocaLogo));
  float h3 = exp(-abs(d3 - 0.5 * j3) * 3.8) * mix(HALO_BASE, 1.0, arcoSuave(rodea, vec2(bi * 7.7 + 41.0, tramo * 0.8 + 9.0), 0.67 + umbralExtra - tocaLogo));
  vec3 halo = azulHalo * (h1 + h3) * 0.34 + mix(azulHalo, narHalo, naranja) * h2 * 0.30;

  vec3 rayo = halo * visible * ev * flick * (solo > 0.5 ? 1.3 : 1.0);
  rayo += (azulNucleo * (l1 + l3) + azulGlow * (g1 + g3)
             + mix(azulNucleo, narNucleo, naranja) * l2 + mix(azulGlow, narGlow, naranja) * g2)
             * visible * ev * flick;
  if (solo < 0.5) {
    // Resplandor pegado al borde del logo mientras dura la descarga.
    rayo += azulGlow * cf.b * (1.0 - cf.r) * 0.30 * ev * flick;
    // Ramificaciones que salen disparadas hacia afuera, como en la foto de referencia.
    rayo += ramas(p, cc, asp, bi, tramo, ev, progreso);
  }
  return rayo + piso + chis;
}

// Posición dentro de la imagen del logo (0..1) de un punto en fracciones del canvas.
vec2 logoUV(vec2 fr) {
  vec2 l = (fr - u_occ.xy) / u_occ.zw;
  return (l - u_pad / (1.0 + 2.0 * u_pad)) * (1.0 + 2.0 * u_pad);
}

// Nubes de energía por DELANTE del logo (capa superior): el mismo halo azul que
// hay detrás, pero mucho más tenue y transparente, en jirones que suben de abajo
// hacia arriba. No son continuas: cada ${PERIODO_NUBES} s pasa una "ola" (una franja que
// sube por el logo en ~${DURACION_NUBES} s) y en medio no hay nada. Solo se dibujan sobre el
// logo y su entorno inmediato.
vec3 nubes(vec2 p, vec2 fr, float asp, float t) {
  float fase = mod(t, ${PERIODO_NUBES.toFixed(1)}) / ${DURACION_NUBES.toFixed(1)};
  if (fase > 1.0) return vec3(0.0);
  vec3 cf = campo(fr);
  float cerca = smoothstep(0.05, 0.40, cf.g);
  if (cerca <= 0.0) return vec3(0.0);
  vec2 cc = vec2((u_occ.x + u_occ.z * 0.5) * asp, u_occ.y + u_occ.w * 0.5);
  vec2 radio = vec2(0.5 * u_occ.z * asp, 0.5 * u_occ.w) / 1.9;
  vec2 rel = p - cc;
  // Aparece y se desvanece a los extremos de la ola.
  float ola = smoothstep(0.0, 0.18, fase) * (1.0 - smoothstep(0.72, 1.0, fase));
  // La franja sube desde abajo del logo hasta arriba.
  float yc = 1.4 * radio.y * (1.0 - 2.0 * fase);
  // (x * x, no pow: pow con base negativa no está definido en GLSL)
  float dFranja = (rel.y - yc) / (0.85 * radio.y);
  float franja = exp(-dFranja * dFranja);
  // Jirones de nube que también van subiendo (el ruido se desplaza hacia arriba).
  float onda = floor(t / ${PERIODO_NUBES.toFixed(1)});
  float n = fbm(vec2(rel.x * 20.0 + onda * 13.7, rel.y * 12.0 + t * 0.4));
  float n2 = noise(vec2(rel.x * 40.0 - onda * 5.3, rel.y * 24.0 + t * 0.7));
  float nube = smoothstep(0.34, 0.64, 0.7 * n + 0.3 * n2);
  // Mezcla de azul eléctrico y naranja (los colores del logo): más naranja hacia
  // arriba y abajo, y jirones de cada color repartidos por el ruido.
  float extremos = smoothstep(0.22, 0.45, abs(logoUV(fr).y - 0.5));
  float mezcla = clamp(0.25 + 0.55 * extremos + 0.9 * (n2 - 0.5), 0.0, 1.0);
  vec3 colNube = mix(vec3(0.10, 0.45, 1.0), vec3(1.0, 0.50, 0.14), mezcla);
  return colNube * nube * franja * ola * cerca * 0.35;
}

// Entrada del núcleo: chispas que se condensan. Al aparecer el logo, chispas
// redondas (azul eléctrico y naranja) llegan desde alrededor, cada una con su
// espera, su duración y su giro al azar, atraídas hacia el centro del núcleo
// (aceleran al acercarse, cada una a su ritmo, con su tamaño y su color: azul eléctrico
// o naranja; aparecen con un fade in y al llegar son absorbidas). Conforme llegan el cubo se
// va formando (crece y se enciende) y al llegar la última hay un destello; después
// queda fijo. e son los segundos desde que el logo está listo (u_entrada).
float entradaEspera(float k) { return 0.2 + 1.2 * hash(vec2(k, 41.7)); }
float entradaVuelo(float k) { return 0.8 + 1.5 * hash(vec2(k, 47.3)); } // unas llegan rápido y otras despacio

// Fracción (0..1) de chispas que ya llegaron al núcleo.
float cargaNucleo(float e) {
  if (e >= ${ENTRADA_LLEGADA.toFixed(1)}) return 1.0;
  float suma = 0.0;
  for (int i = 0; i < ${N_CHISPAS_ENTRADA}; i++) {
    float k = float(i);
    suma += smoothstep(0.0, 0.2, e - (entradaEspera(k) + entradaVuelo(k)));
  }
  return suma / ${N_CHISPAS_ENTRADA}.0;
}

// Destello (0..1) cuando llega la última chispa.
float destelloEntrada(float e) {
  return smoothstep(${(ENTRADA_LLEGADA - 0.5).toFixed(1)}, ${ENTRADA_LLEGADA.toFixed(1)}, e) * (1.0 - smoothstep(${ENTRADA_LLEGADA.toFixed(1)}, ${(ENTRADA_LLEGADA + 0.5).toFixed(1)}, e));
}

vec3 chispasEntrada(vec2 fr, float e) {
  if (e < 0.0 || e > ${ENTRADA_LLEGADA.toFixed(1)}) return vec3(0.0);
  vec2 lg = logoUV(fr);
  vec2 q = vec2((lg.x - ${NUCLEO.nx}) * u_logoAsp, lg.y - ${NUCLEO.ny});
  vec3 col = vec3(0.0);
  for (int i = 0; i < ${N_CHISPAS_ENTRADA}; i++) {
    float k = float(i);
    float u = (e - entradaEspera(k)) / entradaVuelo(k);
    if (u <= 0.0 || u >= 1.0) continue;
    float hT = hash(vec2(k, 71.9)); // tamaño
    float ex = 1.4 + 1.8 * hash(vec2(k, 73.1)); // cuánto acelera hacia el centro (unas casi constantes, otras se lanzan al final)
    float a = 6.2832 * hash(vec2(k, 53.1)) + (hash(vec2(k, 61.3)) - 0.5) * 2.4 * u;
    float r = (0.42 + 0.5 * hash(vec2(k, 59.9))) * (1.0 - pow(u, ex));
    float d = length(q - vec2(cos(a), sin(a) * 0.9) * r);
    // Al llegar la chispa es absorbida: se encoge y se apaga dentro del núcleo.
    float absorbe = smoothstep(0.72, 1.0, u);
    float rad = mix(0.008, 0.024, hT * hT) * (1.0 - 0.75 * absorbe); // unas grandes, otras chicas
    float brillo = smoothstep(0.0, 0.35, u) * (1.0 - smoothstep(0.85, 1.0, u)) * (1.05 + 0.5 * hT); // aparece con fade in
    vec3 c = hash(vec2(k, 67.7)) > 0.5 ? vec3(0.15, 0.55, 1.0) : vec3(1.0, 0.50, 0.10); // azul eléctrico o naranja
    col += c * smoothstep(rad, rad * 0.3, d) * brillo; // punto redondo y limpio, sin halo
  }
  return col;
}

// Núcleo de luz eléctrica en el hueco del anillo superior del logo (capa
// superior). Solo se pinta DENTRO de la apertura, y su centro queda hacia el borde
// delantero del hueco: el resto lo recorta ese borde y solo asoma la parte de
// arriba, como una esfera de energía escondida detrás del anillo.
vec3 nucleo(vec2 fr, float t) {
  // Posición dentro de la imagen del logo, 0..1 (la textura lleva relleno).
  vec2 l = (fr - u_occ.xy) / u_occ.zw;
  vec2 lg = (l - u_pad / (1.0 + 2.0 * u_pad)) * (1.0 + 2.0 * u_pad);
  // Rombo del hueco, con borde suave.
  vec2 dr = abs(lg - vec2(${NUCLEO.cx}, ${NUCLEO.cy})) / vec2(${NUCLEO.hw}, ${NUCLEO.hh});
  float dentro = 1.0 - smoothstep(0.86, 1.0, dr.x + dr.y);
  if (dentro <= 0.0) return vec3(0.0);
  // Núcleo como el de la imagen de referencia ("Responde"): un CUBO de luz
  // isométrico (cara de arriba en rombo, amarillo-blanco; caras laterales
  // naranja y naranja rojizo), con una brasa que bulle por dentro. Centrado hacia
  // el borde de abajo: el borde delantero del hueco recorta su parte inferior.
  vec2 q = vec2((lg.x - ${NUCLEO.nx}) * u_logoAsp, lg.y - ${NUCLEO.ny});
  // Entrada: el cubo crece y se enciende conforme le llegan las chispas (carga 0 → 1); con 1 es el núcleo de siempre.
  float carga = cargaNucleo(u_entrada);
  q = q / mix(0.3, 1.0, smoothstep(0.0, 1.0, carga));
  float W = ${NUCLEO.radio};      // semiancho del cubo (unidades de alto del logo)
  float Hd = W * 0.58;            // semialto del rombo de arriba
  float E = W * 0.80;             // altura de las aristas verticales
  float yc = -E * 0.5;            // centro del rombo de arriba
  float dTop = abs(q.x) / W + abs(q.y - yc) / Hd - 1.0;
  float yBorde = yc + Hd * (1.0 - abs(q.x) / W); // arista de abajo del rombo, a esa x
  float dLado = max(abs(q.x) / W - 1.0, max((yBorde - q.y) / Hd, (q.y - (yBorde + E)) / Hd));
  float caraTop = 1.0 - smoothstep(-0.04, 0.04, dTop);
  float caraLado = (1.0 - smoothstep(-0.04, 0.04, dLado)) * (1.0 - caraTop);
  float plasma = fbm(q * 34.0 + vec2(t * 0.15, -t * 0.55));
  float pulso = 1.0; // el núcleo no late: una vez que aparece queda fijo
  vec3 azul = vec3(0.10, 0.50, 1.0);
  vec3 blanco = vec3(0.85, 0.97, 1.0);
  vec3 cTop = vec3(1.0, 0.86, 0.45);
  vec3 cIzq = vec3(1.0, 0.50, 0.10);
  vec3 cDer = vec3(0.80, 0.30, 0.05);
  vec3 caras = cTop * caraTop * (0.95 + 0.15 * plasma)
             + mix(cDer, cIzq, step(q.x, 0.0)) * caraLado * (0.85 + 0.15 * plasma);
  float arista = smoothstep(0.10, 0.0, abs(dTop)) * 0.3; // arista iluminada de la cara de arriba
  vec3 base = (caras + vec3(1.0, 0.9, 0.6) * arista * caraTop) * pulso * 1.3;
  float rad = length(q) / (W * 1.05); // radio para los arcos que lo envuelven

  // Rayos PROPIOS del núcleo: arcos finos que solo lo recorren (envuelven su borde
  // y cruzan por dentro), nunca salen de él. Cada arco es una línea de nivel del
  // radio deformada con ruido que salta ~12 veces por segundo (parpadea y cambia
  // de camino); solo se ven tramos, que cambian ~3 veces por segundo.
  float ang = atan(q.y, q.x);
  vec2 circ = vec2(cos(ang), sin(ang));
  float paso = floor(t * 12.0);
  float tramo = floor(t * 3.0);
  float j1 = (fbm(circ * 3.0 + vec2(paso * 1.7, paso * 0.9)) - 0.5) * 0.55 + (noise(circ * 9.0 + vec2(paso * 3.1, 2.0)) - 0.5) * 0.18;
  float d1 = rad - 0.93 + j1;
  float s1 = smoothstep(0.62, 0.72, noise(circ * 1.7 + vec2(tramo * 4.7, 3.0)));
  float j2 = (fbm(circ * 3.4 + vec2(paso * 2.3, 7.0 + paso * 0.6)) - 0.5) * 0.6 + (noise(circ * 11.0 + vec2(paso * 1.3, 5.0)) - 0.5) * 0.16;
  float d2 = rad - 0.58 + j2;
  float s2 = smoothstep(0.72, 0.82, noise(circ * 1.9 + vec2(tramo * 2.9, 11.0))); // el arco interior casi no sale
  // Los arcos aparecen de vez en cuando (ráfagas cortas), no todo el tiempo.
  float activo = smoothstep(0.60, 0.78, noise(vec2(t * 0.5, 1.3)));
  float dentroNucleo = (1.0 - smoothstep(1.15, 1.5, rad)) * activo;
  float linea = (smoothstep(0.075, 0.0, abs(d1)) * s1 + smoothstep(0.065, 0.0, abs(d2)) * s2) * dentroNucleo;
  float brilloArco = (exp(-abs(d1) * 8.0) * 0.45 * s1 + exp(-abs(d2) * 8.0) * 0.40 * s2) * dentroNucleo;
  vec3 rayosNucleo = blanco * linea * 0.9;

  float encendido = smoothstep(0.05, 0.9, carga) * (1.0 + 0.8 * destelloEntrada(u_entrada));
  return (base + rayosNucleo) * dentro * encendido;
}

// Energía SOBRE el logo, como el mock: líneas de luz neón en los bordes de las
// capas (cian en las azules, naranja en las naranjas) que brillan de forma
// constante y por las que corren bandas de luz más intensas; finas, sin relleno.
// Capa superior (se suma sobre el logo).
vec3 energiaLogo(vec2 fr, float t) {
  vec2 l = (fr - u_occ.xy) / u_occ.zw;
  float dentro = step(0.0, l.x) * step(l.x, 1.0) * step(0.0, l.y) * step(l.y, 1.0);
  if (dentro < 0.5) return vec3(0.0);
  // Solo la línea fina del borde (sin resplandor ancho ni relleno).
  vec4 e = texture2D(u_tex2, l);
  if (e.r + e.g <= 0.01) return vec3(0.0);
  vec2 lg = logoUV(fr);
  // La energía recorre los bordes de forma ORGÁNICA, sin barrido ni sentido fijo:
  //  - Frentes de energía que nacen en puntos al azar del logo (distintos en cada
  //    ciclo), se extienden por los bordes cercanos y se apagan.
  //  - Un ruido que deriva despacio deja zonas de borde más vivas que otras, que
  //    se mueven sin patrón.
  vec2 pos = vec2(lg.x * u_logoAsp, lg.y);
  float frentes = 0.0;
  for (int i = 0; i < 8; i++) {
    float k = float(i);
    float h1 = hash(vec2(k, 2.3));
    float h2 = hash(vec2(k, 6.1));
    float vida = 2.6 + 3.4 * h1;
    float fase = t + h2 * vida * 4.0;
    float edad = mod(fase, vida);
    float ciclo = floor(fase / vida);
    float u = edad / vida;
    // Punto de nacimiento y tamaño: se sortean de nuevo en cada ciclo.
    vec2 centro = vec2(mix(0.12, 0.88, hash(vec2(k * 3.7, ciclo))) * u_logoAsp,
                       mix(0.12, 0.90, hash(vec2(k * 5.3, ciclo + 1.7))));
    float rMax = 0.10 + 0.40 * hash(vec2(k * 2.9, ciclo + 4.1));
    // Velocidad al azar en cada ciclo: unos recorridos son rápidos (recorren todo su
    // alcance en ~20 % de su vida y se apagan enseguida) y otros lentos (se
    // extienden despacio durante toda su vida), con distinto frenado.
    float lentitud = hash(vec2(k * 4.3, ciclo + 9.9));
    float tau = mix(0.18, 1.0, lentitud * lentitud);      // fracción de su vida que tarda en extenderse (el cuadrado da más rápidos que lentos)
    float u2 = clamp(u / tau, 0.0, 1.0);
    float frenado = mix(1.3, 3.0, hash(vec2(k * 6.1, ciclo + 2.2)));
    float r = rMax * (1.0 - pow(1.0 - u2, frenado));      // se extiende y frena
    float d = length(pos - centro);
    float frente = exp(-((d - r) / 0.035) * ((d - r) / 0.035));      // borde del frente
    float relleno = (1.0 - smoothstep(r * 0.55, r, d)) * 0.5;         // interior, más suave
    float envolvente = smoothstep(0.0, 0.08, u) * (1.0 - 0.6 * u2) * (1.0 - u) * (1.0 - u);
    frentes += (frente + relleno) * envolvente;
  }
  float deriva = smoothstep(0.45, 0.85, fbm(vec2(lg.x * 5.0 + t * 0.06, lg.y * 5.0 - t * 0.045) + 7.3));
  float viva = 0.22 + 1.5 * frentes + 0.9 * deriva;
  vec3 azulNeon = vec3(0.45, 0.92, 1.0);
  vec3 naranjaNeon = vec3(1.0, 0.62, 0.22);
  vec3 c = azulNeon * e.r * viva + naranjaNeon * e.g * viva * 0.9;
  return c * 0.6;
}

// Luz naranja que se cuela entre las capas del logo, como en la imagen de
// referencia: el fuego del núcleo se asoma por las rendijas oscuras entre las
// capas, más intenso cerca del núcleo y con un parpadeo de brasa. Usa la máscara
// de rendijas oscuras (alfa de la textura del logo).
vec3 fugaNaranja(vec2 fr, float t) {
  vec2 l = (fr - u_occ.xy) / u_occ.zw;
  float dentro = step(0.0, l.x) * step(l.x, 1.0) * step(0.0, l.y) * step(l.y, 1.0);
  float rendija = texture2D(u_tex, clamp(l, 0.0, 1.0)).a * dentro;
  if (rendija <= 0.02) return vec3(0.0);
  vec2 lg = logoUV(fr);
  vec2 q = vec2((lg.x - ${NUCLEO.nx}) * u_logoAsp, lg.y - ${NUCLEO.ny});
  float cerca = exp(-length(q) * 3.4);
  float brasa = noise(vec2(lg.x * 18.0, lg.y * 10.0 + t * 1.1));
  return vec3(1.0, 0.5, 0.12) * rendija * cerca * (0.55 + 0.7 * brasa) * 0.7 * smoothstep(0.25, 1.0, cargaNucleo(u_entrada));
}

// Brasas que salen impulsadas del núcleo hacia arriba (capa superior), como las
// partículas del mock ("Aprende"). Cada brasa es una partícula propia (velocidad,
// ciclo de vida y punto de salida distintos, que cambian en cada ciclo): sale
// con impulso, frena y flota, ondula de lado a lado y se apaga. Se dibuja como un
// disco redondo: el movimiento se percibe porque cada partícula recorre su propio
// camino a su propio ritmo, no porque un patrón deslice.
vec3 brasas(vec2 p, float asp, float t) {
  vec2 cc = vec2((u_occ.x + u_occ.z * 0.5) * asp, u_occ.y + u_occ.w * 0.5);
  float hl = u_occ.w / (1.0 + 2.0 * u_pad.y);           // alto del logo (unidades de p)
  float wl = u_occ.z * asp / (1.0 + 2.0 * u_pad.x);     // ancho del logo
  vec2 nucleoP = vec2(cc.x + (${NUCLEO.nx} - 0.5) * wl, cc.y + (${NUCLEO.ny} - 0.5) * hl);
  // Salen justo por encima del núcleo: del vértice de arriba del cubo (a ~0.11 del alto del logo sobre su centro), no de su interior.
  vec2 origen = nucleoP + vec2(0.0, -0.115 * hl);
  vec2 rel = p - origen;
  // Solo en la columna sobre el núcleo (fuera de ella no hay nada que calcular).
  if (rel.y > 0.05 * hl || rel.y < -2.4 * hl || abs(rel.x) > 0.9 * wl) return vec3(0.0);
  vec3 suma = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float k = float(i);
    float h1 = hash(vec2(k, 1.7));
    float h2 = hash(vec2(k, 4.1));
    float h3 = hash(vec2(k, 8.3));
    float h4 = hash(vec2(k, 12.9));
    float vida = 2.6 + 6.4 * h1;   // vidas muy distintas: las largas son las lentas (un ~25 % más cortas que antes: más rápidas)
    float fase = t + h2 * vida * 3.0;
    float edad = mod(fase, vida);
    float ciclo = floor(fase / vida);
    // Todo lo importante se sortea de nuevo en cada ciclo, así nunca se repite:
    // dónde sale, cuánto sube (las que suben poco son lentas), con qué impulso y
    // si sale o descansa este ciclo.
    float hc = hash(vec2(k * 3.1, ciclo));
    float hc2 = hash(vec2(k * 5.7, ciclo + 0.5));
    float hc3 = hash(vec2(k * 2.3, ciclo + 3.3));
    if (hc3 < 0.3) continue;
    float x0 = (hc - 0.5) * 0.16 * wl; // dentro del ancho del cubo (±0.08 del ancho del logo)
    float sube = 1.8 * hl * (0.3 + 0.85 * hc2);
    float amp = 0.07 * wl * (0.5 + h4);
    float frec = 0.9 + 0.7 * h4;
    // Posición en función de la edad: impulso inicial que se frena (1 - (1-u)^p).
    float u = edad / vida;
    float impulso = mix(1.2, 2.8, hc2 * hc2);            // 1.2: casi lineal y lento; 2.8: sale disparada y frena
    float avance = 1.0 - pow(1.0 - u, impulso);
    vec2 pos = origen + vec2(x0 + sin(edad * frec + h4 * 6.28) * amp * u, -sube * avance);
    // Redondas: un disco suave en la posición actual (el movimiento se ve al
    // desplazarse cada partícula, no por una estela).
    float d = length(p - pos);
    float radio = 0.0050 * (0.7 + 0.6 * h3) * (1.0 - 0.4 * u);
    // Brillosas y etéreas: un punto redondo, limpio (sin halo alrededor), con el centro
    // casi blanco, que entra y se apaga despacio.
    float punto = smoothstep(radio, radio * 0.30, d);
    float entra = smoothstep(0.0, 0.20, u);
    float sale = pow(1.0 - u, 1.5);
    float titila = 0.70 + 0.30 * sin(t * 2.0 + h1 * 60.0);
    vec3 col = h4 > 0.4 ? vec3(1.0, 0.55, 0.15) : vec3(0.35, 0.85, 1.0);
    suma += (col * punto * 1.1 + vec3(1.0, 0.95, 0.85) * punto * 0.5) * entra * sale * titila;
  }
  return suma * 0.85;
}

// Anillos de luz en el suelo, bajo el logo (capa de fondo): ondas que nacen cerca
// del centro, crecen hacia afuera (frenando poco a poco, como una onda en el agua) y
// se van desvaneciendo al alejarse. Hay ${N_ONDAS_SUELO} a la vez, desfasadas entre sí, cada una
// con un ciclo de ${PERIODO_ONDAS_SUELO.toFixed(1)} s; al terminar una nace otra en el centro, sin cortes. Más un
// brillo tenue del suelo y una columna de luz que baja del logo.
vec3 anillosSuelo(vec2 p, float asp, float t) {
  vec2 cc = vec2((u_occ.x + u_occ.z * 0.5) * asp, u_occ.y + u_occ.w * 0.5);
  float wl = u_occ.z * asp / (1.0 + 2.0 * u_pad.x);
  float hl = u_occ.w / (1.0 + 2.0 * u_pad.y);
  float suelo = 0.90;
  vec2 d = vec2(p.x - cc.x, (p.y - suelo) / 0.20);
  float rr = length(d) / wl;                             // en anchos de logo
  // Los anillos aparecen con un fade in justo después de formarse el núcleo, y las ondas
  // cuentan desde que empezó la entrada: así la primera nace en el centro. (Sin animar
  // u_entrada es enorme: ya aparecidos y con el reloj normal.)
  float aparecen = smoothstep(${ANILLOS_INICIO.toFixed(1)}, ${(ANILLOS_INICIO + ANILLOS_APARICION).toFixed(1)}, u_entrada);
  float tOnda = u_entrada < 500.0 ? max(u_entrada, 0.0) : t;
  float anillos = 0.0;
  for (int i = 0; i < ${N_ONDAS_SUELO}; i++) {
    float u = fract(tOnda / ${PERIODO_ONDAS_SUELO.toFixed(1)} + float(i) / ${N_ONDAS_SUELO}.0); // 0 = nace en el centro, 1 = ya se apagó
    float radioOnda = 0.12 + 1.75 * (1.0 - pow(1.0 - u, 1.5)); // crece de adentro hacia afuera, frenando
    float a = (rr - radioOnda) / (0.028 + 0.03 * u);           // se ensancha un poco al crecer
    float vida = smoothstep(0.0, 0.10, u) * pow(1.0 - u, 1.3); // nace suave y se desvanece al alejarse
    anillos += exp(-a * a) * vida;
  }
  float fondo = 1.0 - smoothstep(2.0, 2.6, rr);
  vec3 cian = vec3(0.15, 0.65, 1.0);
  vec3 col = cian * anillos * fondo * aparecen * 0.22;
  col += cian * exp(-rr * rr * 2.5) * 0.08;               // brillo del suelo bajo el logo
  // Columna de luz del logo al suelo.
  float dx = (p.x - cc.x) / (0.16 * wl);
  float baja = smoothstep(cc.y + 0.5 * hl, suelo, p.y) * (1.0 - smoothstep(suelo, suelo + 0.03, p.y));
  col += cian * exp(-dx * dx) * baja * 0.06;
  return col;
}

// Coordenada del haz: constante a lo largo de cada rayo. Los rayos nacen en una
// fuente lejana sobre el borde superior, se abren hacia abajo (perspectiva) y
// llevan una leve inclinación, así la luz cubre todo el ancho de la pantalla.
float coordHaz(vec2 pp, float asp) {
  return (pp.x - 0.5 * asp - 0.10 * pp.y) / (1.0 + 0.30 * pp.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y;
  // Origen arriba a la izquierda, eje y hacia abajo.
  vec2 p = vec2(uv.x * asp, 1.0 - uv.y);
  vec2 fr = vec2(uv.x, 1.0 - uv.y);      // el mismo punto en fracciones del canvas
  float t = u_t;
#if defined(SOBRE)
  // Capa superior: los rayos, las nubes y las brasas que van encima del logo (luz suave).
  gl_FragColor = vec4((u_hayOcc > 0.5 ? rayos(p, fr, asp, t, 1.0) + nubes(p, fr, asp, t) + brasas(p, asp, t) * trasNucleo() : vec3(0.0)) * u_fade, 1.0);
#elif defined(DETALLE)
  // Capa de detalle: solo el logo (núcleo, luz entre capas y líneas de energía), en un
  // canvas del tamaño del logo y a resolución completa para que los bordes salgan nítidos.
  gl_FragColor = vec4(u_hayOcc > 0.5 ? (nucleo(fr, t) + fugaNaranja(fr, t) + energiaLogo(fr, t)) * u_fade + chispasEntrada(fr, u_entrada) : vec3(0.0), 1.0);
#else
  float s = coordHaz(p, asp);

  // Haz que atraviesa al oclusor: se intensifica justo hacia él.
  float haz = 0.0;
  if (u_hayOcc > 0.5) {
    vec2 c = u_occ.xy + u_occ.zw * 0.5;
    float sOcc = coordHaz(vec2(c.x * asp, c.y), asp);
    float dHaz = (s - sOcc) / 0.10;
    haz = exp(-dHaz * dHaz); // (x * x: pow con base negativa no está definido en GLSL)
  }

  // Como si la luz atravesara el agua: la superficie ondulada refracta los
  // haces, que se mecen de lado a lado (más al bajar) y cambian de posición
  // lentamente.
  float sw = s + (0.026 * sin(p.y * 3.0 + t * 0.20 + s * 4.0)
                + 0.014 * sin(p.y * 7.0 - t * 0.30 + s * 9.0)) * (0.4 + p.y);

  // Haces: ruido a varias escalas de la coordenada (ya refractada), anchos y
  // difusos con otros más finos encima. Siempre queda una base de luz entre haz y haz.
  float ra = 0.58 * noise1(sw * 6.0 + t * 0.04)
           + 0.30 * noise1(sw * 14.0 - t * 0.05 + 5.3)
           + 0.12 * noise1(sw * 30.0 + t * 0.07 + 11.7);
  ra = 0.32 + 0.68 * smoothstep(0.05, 1.00, ra);
  ra = min(1.10, ra + 0.35 * haz);

  // La intensidad de cada haz late a su propio ritmo (fase distinta por haz) y
  // una onda de brillo corre por ellos hacia abajo: el centelleo del agua.
  float fase = noise1(s * 8.0 + 40.0) * 12.0;
  float late = 0.78 + 0.22 * sin(t * 0.32 + fase);
  float onda = 0.82 + 0.18 * sin(p.y * 6.0 - t * 0.45 + s * 5.0);
  // Cáusticas finas cerca de la superficie: red de destellos que se deforma.
  float caust = 0.5 + 0.5 * sin(p.x * 22.0 + 3.0 * sin(p.y * 9.0 + t * 0.28) + t * 0.22)
                        * sin(p.y * 17.0 + 3.0 * sin(p.x * 11.0 - t * 0.25) - t * 0.18);
  float superficie = exp(-p.y * 3.5);
  ra *= late * onda * (1.0 - 0.35 * superficie + 0.35 * superficie * caust);

  // Reparto a lo ancho: toda la pantalla recibe luz, con zonas más y menos
  // intensas que derivan despacio.
  float env = 0.72 + 0.28 * noise1(s * 1.6 + t * 0.012 + 20.0);
  env = max(env, 0.6 * haz);

  // Bruma: manchas de humo (isotrópicas) más vetas a lo largo de los haces;
  // el humo desciende despacio desde arriba.
  float vetas = fbm(vec2(s * 5.0, p.y * 1.5 - t * 0.06));
  vec2 q = p * 2.0 - vec2(0.0, 1.0) * t * 0.035;
  // Distorsión moderada: una muy fuerte dobla el ruido y deja pliegues rectos.
  float humo = fbm(q + fbm(q * 0.8 + vec2(t * 0.02, -t * 0.015)) * 0.75);
  float bruma = smoothstep(0.15, 0.85, 0.45 * vetas + 0.55 * humo);

  // La luz entra por el borde superior y se apaga hacia abajo.
  float caida = exp(-pow(p.y * 1.15, 1.6));
  float respira = 0.94 + 0.06 * sin(t * 0.35);
  float luz = 0.46 * caida * env * ra * (0.55 + 0.75 * bruma) * respira;
  luz += exp(-p.y * 5.0) * 0.22 + exp(-p.y * 1.8) * 0.04;

  // Interacción con el oclusor: sombra proyectada y ráfagas de rayos.
  vec3 rayo = vec3(0.0);
  if (u_hayOcc > 0.5) {
    rayo = rayos(p, fr, asp, t, 0.0) + anillosSuelo(p, asp, t);
    // La sombra y el halo solo existen cerca del logo: lejos se salta todo el
    // muestreo (30 lecturas de textura por píxel).
    vec2 ccM = vec2((u_occ.x + u_occ.z * 0.5) * asp, u_occ.y + u_occ.w * 0.5);
    if (length(p - ccM) < 0.5) {
    // Todo en el espacio con aspecto (p): sin distorsión entre ejes.
    // Sombra: se marcha desde el punto hacia la fuente acumulando silueta, en
    // un tramo corto y con más peso lo cercano — cae suave y se desvanece.
    vec2 haciaFuente = -normalize(vec2(0.10 + 0.30 * s, 1.0));
    vec2 lateral = vec2(-haciaFuente.y, haciaFuente.x);
    float rot = hash(gl_FragCoord.xy) * 6.2831;
    float sombra = 0.0;
    for (int i = 0; i < 16; i++) {
      float k = (float(i) + 0.5) / 16.0;
      // Desvío lateral que crece con la distancia: borde difuso, como un penumbra.
      vec2 pt = p + haciaFuente * 0.16 * k + lateral * sin(rot + float(i) * 2.4) * 0.03 * k;
      sombra += ocluso(vec2(pt.x / asp, pt.y)) * (1.0 - 0.75 * k);
    }
    sombra = 1.0 - exp(-sombra * 0.30);
    luz *= 1.0 - 0.55 * sombra * (1.0 - ocluso(fr));

    // Halo propio del logo, azul eléctrico (energía viva): rodea el contorno con
    // la MISMA intensidad por todos lados (no depende de la luz de arriba). Solo
    // late suavemente en el tiempo y se enciende más con cada ráfaga. El muestreo
    // se gira por píxel para que no se marquen escalones.
    float halo = 0.0;
    for (int i = 0; i < 12; i++) {
      float a = rot + float(i) * 0.5236;
      float rad = mod(float(i), 2.0) < 0.5 ? 0.009 : 0.019;
      vec2 pt = p + vec2(cos(a), sin(a)) * rad;
      halo += ocluso(vec2(pt.x / asp, pt.y));
    }
    halo = clamp(halo / 6.0, 0.0, 1.0) * (1.0 - ocluso(fr));
    // Halo VIVO: energía en movimiento continuo. Depende solo del tiempo (no del
    // vaivén del logo), así nunca se queda quieto. Tiene dos partes:
    //  - un anillo pegado al borde que late (siempre encendido) y parpadea con la
    //    energía que pasa, y
    //  - lenguas de energía que fluyen hacia arriba por todo el contorno, salen
    //    hacia afuera y se apagan. Su intensidad media es pareja por todos lados.
    vec2 ccH = vec2((u_occ.x + u_occ.z * 0.5) * asp, u_occ.y + u_occ.w * 0.5);
    vec2 rel = p - ccH;
    float radial = campo(fr).g; // ~0.5 en el borde, cae hacia afuera
    // La energía FLUYE HACIA ARRIBA: el patrón se desplaza siempre hacia arriba
    // (y crece hacia abajo en pantalla, por eso se suma t a la y del ruido),
    // estirado en vertical como una llama, con un detalle más rápido encima.
    float sube = fbm(vec2(rel.x * 9.0 + sin(t * 0.2) * 0.6, rel.y * 5.0 + t * 0.5));
    float sube2 = noise(vec2(rel.x * 22.0 + t * 0.1, rel.y * 12.0 + t * 0.85));
    float energia = smoothstep(0.25, 0.85, 0.65 * sube + 0.35 * sube2);
    float lenguas = smoothstep(0.14, 0.44, radial) * (1.0 - ocluso(fr));
    float latido = 0.75 + 0.25 * sin(t * 0.7 + 1.3 * sin(t * 0.25));
    vec3 azulVivo = vec3(0.05, 0.42, 1.0);
    vec3 nucleoVivo = vec3(0.25, 0.70, 1.0);
    vec3 naranjaVivo = vec3(1.0, 0.48, 0.12);
    // El halo aparece justo después de formarse el núcleo (entrada): antes no existe.
    float aparece = smoothstep(${HALO_INICIO.toFixed(1)}, ${(HALO_INICIO + HALO_APARICION).toFixed(1)}, u_entrada);
    float fuerza = (1.15 + 0.9 * haz) * (1.0 + 0.9 * rafaga(t)) * aparece;
    // El halo mezcla el azul eléctrico con el naranja del logo: naranja hacia
    // arriba y hacia abajo (donde el logo es naranja), azul en la franja del medio
    // (donde es azul), con la energía que fluye mezclando ambos de forma orgánica.
    float extremos = smoothstep(0.22, 0.45, abs(logoUV(fr).y - 0.5));
    float mezcla = clamp(0.15 + 0.7 * extremos + 0.35 * (energia - 0.5), 0.0, 1.0);
    vec3 colAnillo = mix(azulVivo, naranjaVivo, mezcla);
    vec3 colLenguas = mix(mix(azulVivo, nucleoVivo, energia), naranjaVivo, mezcla);
    rayo += (colAnillo * halo * latido * (0.7 + 0.5 * energia) * 0.12
           + colLenguas * lenguas * energia * 0.10) * fuerza;
    }
  }

  // Polvo: tres capas (fino, medio y bokeh grande), solo donde hay luz.
  // Cada mota se ve según dónde está respecto al haz que cruza: 0 = lejos, 1 = en el
  // centro. Lejos del centro casi no se ve, y al entrar o salir del haz (la orilla,
  // a media intensidad) destella un poco más que en el centro.
  float enHaz = smoothstep(0.25, 0.95, ra);
  float visibilidadPolvo = (0.30 + 0.70 * enHaz) * (1.0 + 2.8 * enHaz * (1.0 - enHaz));
  float polvo = (dust(p, 16.0, 0.10, 1.0, luz, t)
              + dust(p, 30.0, 0.16, 7.0, luz, t) * 0.8
              + dust(p, 9.0, 0.06, 13.0, luz, t) * 0.35) * visibilidadPolvo;

  // Rampa de color eléctrica (negro azulado → azul eléctrico → celeste → blanco hielo).
  vec3 col = mix(vec3(0.006, 0.012, 0.030), vec3(0.03, 0.20, 0.66), smoothstep(0.0, 0.65, luz));
  col = mix(col, vec3(0.16, 0.56, 1.0), smoothstep(0.35, 1.15, luz));
  col = mix(col, vec3(0.62, 0.88, 1.0), smoothstep(0.95, 1.8, luz));
  col += vec3(0.65, 0.90, 1.0) * polvo * 0.6;
  col += rayo;
  col *= u_fade;

  // Grano fino para evitar bandas en los degradados oscuros.
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.014;
  gl_FragColor = vec4(col, 1.0);
#endif
}
`;

export type ModoCapa = 'fondo' | 'sobre' | 'detalle';

/**
 * Cada capa compila SOLO su parte del shader: con `#define SOBRE` la capa superior
 * (rayos, nubes y brasas), con `#define DETALLE` la del logo (núcleo, luz entre capas
 * y líneas de energía) y sin nada la de fondo. Compilar el shader entero en cada una
 * (eligiendo con un uniform) cuesta el triple; en una GPU modesta con la caché del
 * driver vacía (primera visita) esa compilación se medía en segundos.
 */
export function fragmentDeCapa(modo: ModoCapa): string {
  if (modo === 'sobre') return `#define SOBRE
${FRAGMENT_SHADER}`;
  if (modo === 'detalle') return `#define DETALLE
${FRAGMENT_SHADER}`;
  return FRAGMENT_SHADER;
}

/**
 * Factor de resolución del canvas: el efecto es un degradado suave, no
 * necesita píxeles nativos. En pantallas chicas o densas se renderiza a
 * menos resolución (y el navegador lo escala) para cuidar batería y fluidez.
 */
export function calidadDeRender(anchoCss: number, dpr: number): number {
  const base = Math.min(Math.max(dpr, 1), 1.5);
  if (anchoCss < 700) return Math.min(base, 1) * 0.75;
  if (anchoCss > 1800) return base * 0.75;
  return base;
}

/** Segundos que tarda en aparecer el efecto (fade in) la primera vez. */
export const DURACION_FADE_IN = 3;

/**
 * Factor de aparición (0..1, con suavizado) a los `seg` segundos del primer
 * cuadro. Va en el shader y se mide con el reloj del efecto (que avanza como
 * máximo 0.1 s por cuadro), así un tirón al compilar el shader no se "salta"
 * el fade: la aparición se ve siempre gradual.
 */
export function factorFadeIn(seg: number): number {
  const x = Math.min(1, Math.max(0, seg / DURACION_FADE_IN));
  return x * x * (3 - 2 * x);
}

/** La capa superior (rayos y chispas) se dibuja a menor resolución: son trazos luminosos, no necesitan más, y así la ráfaga cuesta menos. */
export const ESCALA_CAPA_SUPERIOR = 0.6;

/** Escala mínima de resolución a la que puede bajar la calidad adaptativa. */
export const ESCALA_MINIMA = 0.5;
/** Por encima de este tiempo medio por cuadro (ms) el equipo no sostiene ~40 fps. */
export const UMBRAL_CUADRO_MS = 26;

/**
 * Calidad adaptativa: dada la escala actual y el tiempo medio por cuadro,
 * devuelve la escala siguiente. Solo baja (un 20 % cada vez, hasta el mínimo):
 * nunca vuelve a subir, para no oscilar entre dos calidades.
 */
export function siguienteEscala(escala: number, mediaMs: number, umbralMs: number = UMBRAL_CUADRO_MS): number {
  if (mediaMs <= umbralMs || escala <= ESCALA_MINIMA) return escala;
  return Math.max(ESCALA_MINIMA, escala * 0.8);
}

/** Instante (en el tiempo del efecto) con una ráfaga fuerte: es el cuadro fijo de "reducir movimiento". */
export const T_ESTATICO = 14.3;

function suave(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Intensidad (0..1) de la ráfaga de rayos en el instante `t`. Espejo de rafaga() del shader. */
export function envolventeRafaga(t: number): number {
  const ts = ((t % PERIODO_RAFAGA) + PERIODO_RAFAGA) % PERIODO_RAFAGA;
  const a = 0.55 * suave(0, 0.08, ts) * (1 - suave(0.22, 0.55, ts));
  const b = 0.55 * suave(1.43, 1.51, ts) * (1 - suave(1.65, 1.98, ts));
  return Math.max(a, b);
}

/**
 * Cámara lenta durante la ráfaga (pedido explícito: "se tiene que ralentizar todo el
 * ambiente", no solo los rayos): ralentiza el AVANCE del reloj del efecto (`tiempoEfecto`),
 * así que afecta a todo lo que se dibuja con `t` — haces, bruma, polvo, halo, nubes,
 * brasas — sin tocar cada función una por una. Con reducir movimiento no se aplica: ese
 * modo dibuja un único cuadro fijo (T_ESTATICO), no avanza el reloj.
 *
 * Secuencia pedida (no una rampa que ya empieza a frenar antes del golpe):
 *   1. Aparece el rayo (ts 0–FASE_APARECE_FIN, ~1 s) a velocidad NORMAL — el golpe se ve
 *      de golpe, sin frenar de antemano.
 *   2. Se activa la cámara lenta justo después, y dura RALENTI_DURACION_REAL s reales
 *      (a RALENTI_FACTOR de velocidad, cubre también la ráfaga secundaria, ts 1.43–1.98).
 *   3. Se apaga: el resto del ciclo (el rayo terminando de desaparecer — brasas, halo)
 *      vuelve a velocidad normal.
 */
export const FASE_APARECE_FIN = 1.1;
export const RALENTI_FACTOR = 0.15;
export const RALENTI_DURACION_REAL = 4;
/** Tramo de `ts` (ancho = RALENTI_DURACION_REAL * RALENTI_FACTOR) que dura la cámara lenta. */
export const FASE_LENTA_FIN = FASE_APARECE_FIN + RALENTI_DURACION_REAL * RALENTI_FACTOR;
/** Transición de entrada/salida corta: marca las tres fases sin que se sientan de golpe. */
export const RALENTI_RAMPA = 0.03;

/**
 * No en TODAS las ráfagas: en promedio cada 2 o 3 (al azar, no una cada N fija), y si le tocó
 * a una, a la siguiente le baja la probabilidad (para que no salgan seguidas ni muy seguido).
 * "Hash" con seno igual que se usa en GLSL para ruido pseudoaleatorio.
 */
export const PROBABILIDAD_RALENTI_CICLO = 0.4; // probabilidad normal (si la anterior NO tuvo)
export const PROBABILIDAD_RALENTI_TRAS_ACTIVA = 0.15; // probabilidad si la anterior SÍ tuvo
function hashCiclo(bi: number): number {
  const x = Math.sin(bi * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * ¿Le tocó cámara lenta al ciclo `bi`? Depende de si le tocó al anterior (`bi-1`): es una
 * cadena, así que se cachea (una vez calculado un ciclo no se vuelve a recorrer la cadena
 * completa desde 0 para los siguientes) — en uso normal `bi` sube de 1 en 1 cada
 * PERIODO_RAFAGA segundos, así que en la práctica es O(1) por ciclo nuevo.
 */
// Tope duro: en producción `bi` sube de 1 en 1 para siempre mientras la pestaña esté
// visible (pensado incluso para quedar de fondo de escritorio, días abierto sin recargar),
// así que un Map sin tope crecería sin límite. Con esto, cuando se pasa el tope se olvida
// el ciclo más viejo (orden de inserción de Map) — no importa: nada vuelve a preguntar por
// un ciclo de hace más de CACHE_CICLO_TOPE ráfagas atrás (~17 min a PERIODO_RAFAGA=2s).
const CACHE_CICLO_TOPE = 512;
const cacheCicloActivo = new Map<number, boolean>();
function activoEnCiclo(bi: number): boolean {
  if (bi < 0) return false;
  const enCache = cacheCicloActivo.get(bi);
  if (enCache !== undefined) return enCache;
  let previo = bi - 1;
  while (previo >= 0 && !cacheCicloActivo.has(previo)) previo--;
  let previoActivo = previo >= 0 ? (cacheCicloActivo.get(previo) as boolean) : false;
  for (let i = previo + 1; i <= bi; i++) {
    previoActivo = hashCiclo(i) < (previoActivo ? PROBABILIDAD_RALENTI_TRAS_ACTIVA : PROBABILIDAD_RALENTI_CICLO);
    cacheCicloActivo.set(i, previoActivo);
    if (cacheCicloActivo.size > CACHE_CICLO_TOPE) {
      const masViejo = cacheCicloActivo.keys().next().value as number;
      cacheCicloActivo.delete(masViejo);
    }
  }
  return previoActivo;
}

/** Factor (0..1) al que avanza el reloj del efecto en el instante `t`: 1 = velocidad normal. */
export function factorCamaraLenta(t: number): number {
  const bi = Math.floor(t / PERIODO_RAFAGA);
  if (!activoEnCiclo(bi)) return 1; // esta ráfaga no tiene cámara lenta
  const ts = ((t % PERIODO_RAFAGA) + PERIODO_RAFAGA) % PERIODO_RAFAGA;
  const dentro = suave(FASE_APARECE_FIN, FASE_APARECE_FIN + RALENTI_RAMPA, ts)
               * (1 - suave(FASE_LENTA_FIN, FASE_LENTA_FIN + RALENTI_RAMPA, ts));
  return 1 - (1 - RALENTI_FACTOR) * dentro;
}

/** Segundos tras el inicio de cada ráfaga en que aún puede haber chispas en el aire (rebotando). */
export const DURACION_CHISPAS = 3.4;

/** ¿Hay una ola de nubes de energía por delante del logo en el instante `t`? */
export function hayNubes(t: number): boolean {
  return (((t % PERIODO_NUBES) + PERIODO_NUBES) % PERIODO_NUBES) < DURACION_NUBES;
}

/**
 * Ancho (px) al que se calculan las texturas del logo, sin contar el relleno. Antes era
 * la mitad del original (163 px): los bordes de energía y las rendijas se veían en
 * escalones. A 360 px salen definidos hasta en pantallas densas y el cálculo sigue
 * repartido en pasos que ceden el hilo.
 */
export const ANCHO_CAMPO = 360;
/** Grosor (px, a ANCHO_CAMPO) de la línea de luz de los bordes de las capas: mismo grosor visual que con la textura chica. */
export const RADIO_BORDE = 4;

/** Desenfoque gaussiano aproximado (3 pasadas de caja por eje) de un canal de 1 byte, `radio` en píxeles. */
export function desenfocar(canal: Uint8Array, ancho: number, alto: number, radio: number): Uint8Array {
  const r = Math.max(1, Math.round(radio));
  const a = Uint8Array.from(canal);
  const b = new Uint8Array(canal.length);
  // Una pasada de caja sobre `otro` líneas de `largo` píxeles (separados `paso`, líneas separadas `salto`).
  const pasada = (src: Uint8Array, dst: Uint8Array, largo: number, otro: number, paso: number, salto: number) => {
    for (let l = 0; l < otro; l++) {
      const base = l * salto;
      let suma = 0;
      for (let i = -r; i <= r; i++) suma += src[base + Math.min(largo - 1, Math.max(0, i)) * paso];
      for (let i = 0; i < largo; i++) {
        dst[base + i * paso] = Math.round(suma / (2 * r + 1));
        suma += src[base + Math.min(largo - 1, i + r + 1) * paso] - src[base + Math.max(0, i - r) * paso];
      }
    }
  };
  for (let n = 0; n < 3; n++) {
    pasada(a, b, ancho, alto, 1, ancho); // horizontal
    pasada(b, a, alto, ancho, ancho, 1); // vertical
  }
  return a;
}

/** Textura RGBA del oclusor: R silueta, G silueta muy difuminada, B difuminada fina, A máscara de las rendijas oscuras entre capas (opaco si no se da). */
export function campoDeSilueta(alfa: Uint8Array, ancho: number, alto: number, radioAncho: number, radioFino: number, rendijas?: Uint8Array): Uint8Array {
  const g = desenfocar(alfa, ancho, alto, radioAncho);
  const b = desenfocar(alfa, ancho, alto, radioFino);
  const out = new Uint8Array(ancho * alto * 4);
  for (let i = 0; i < alfa.length; i++) {
    out[i * 4] = alfa[i];
    out[i * 4 + 1] = g[i];
    out[i * 4 + 2] = b[i];
    out[i * 4 + 3] = rendijas ? rendijas[i] : 255;
  }
  return out;
}

/**
 * Borde de una máscara binaria (0 / >0): los píxeles de la máscara que están a
 * menos de 2 px de un píxel fuera de ella. Es la "línea de luz" de las capas del
 * logo (~2 px de grosor; el filtrado de la textura la suaviza).
 */
export function bordesDeMascara(mascara: Uint8Array, ancho: number, alto: number, radio = 2): Uint8Array {
  const borde = new Uint8Array(mascara.length);
  const fuera = (x: number, y: number) => x < 0 || y < 0 || x >= ancho || y >= alto || mascara[y * ancho + x] === 0;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (mascara[y * ancho + x] === 0) continue;
      for (let d = 1; d <= radio; d++) {
        if (fuera(x - d, y) || fuera(x + d, y) || fuera(x, y - d) || fuera(x, y + d)) { borde[y * ancho + x] = 255; break; }
      }
    }
  }
  return borde;
}

/** Textura de energía del logo: R borde de las capas azules, G borde de las naranjas, B capas azules, A capas naranjas. */
export function texturaEnergia(azul: Uint8Array, naranja: Uint8Array, ancho: number, alto: number, radioBorde = 2): Uint8Array {
  const bAzul = bordesDeMascara(azul, ancho, alto, radioBorde);
  const bNaranja = bordesDeMascara(naranja, ancho, alto, radioBorde);
  const out = new Uint8Array(ancho * alto * 4);
  for (let i = 0; i < azul.length; i++) {
    out[i * 4] = bAzul[i];
    out[i * 4 + 1] = bNaranja[i];
    out[i * 4 + 2] = azul[i];
    out[i * 4 + 3] = naranja[i];
  }
  return out;
}

/**
 * Reloj del efecto compartido por todas las capas (fondo y capa superior deben
 * dibujar el MISMO instante para que los rayos casen). Avanza una vez por
 * cuadro (las capas de un mismo cuadro reciben la misma marca de tiempo) y no
 * corre mientras la pestaña está oculta.
 */
/**
 * Entrada compartida por todas las capas: el núcleo (capa de detalle) y el halo del
 * contorno (capa de fondo) tienen que ir sincronizados, pero cada capa arranca cuando
 * termina de compilar su shader. La capa de detalle marca aquí el instante (del reloj del
 * efecto) en que el logo estuvo listo y las demás cuentan desde ahí. Si no hay capa de
 * detalle, marca la primera capa que tenga logo.
 */
const entrada = { hayDetalle: false, tListo: -1 };

const reloj = { acumulado: 0, ultimoAhora: -1 };
function tiempoEfecto(ahora: number): number {
  if (ahora !== reloj.ultimoAhora) {
    if (reloj.ultimoAhora >= 0) {
      const dtReal = Math.min(0.1, (ahora - reloj.ultimoAhora) / 1000);
      // La velocidad de este instante se decide con el t ANTERIOR (el reloj antes de
      // avanzar): así el avance nunca se autorreferencia dentro del mismo cuadro.
      reloj.acumulado += dtReal * factorCamaraLenta(reloj.acumulado + 6);
    }
    reloj.ultimoAhora = ahora;
  }
  return reloj.acumulado + 6;
}
function reanudarReloj() { reloj.ultimoAhora = performance.now(); }

/** Rect de `el` en fracciones del rect de `contenedor` (arriba-izquierda, ancho, alto). */
export function rectEnFracciones(el: DOMRect, contenedor: DOMRect): [number, number, number, number] {
  const w = Math.max(1, contenedor.width);
  const h = Math.max(1, contenedor.height);
  return [(el.left - contenedor.left) / w, (el.top - contenedor.top) / h, el.width / w, el.height / h];
}

export interface Oclusor {
  /** Selector CSS del elemento que proyecta sombra (se busca en cada cuadro). */
  selector: string;
  /** URL de la imagen cuyo canal alfa es la silueta. */
  src: string;
}

// ---------------------------------------------------------------------------
// Niveles de calidad: el efecto se adapta al equipo en vez de costar lo mismo a todos.
// ---------------------------------------------------------------------------

export type NivelEfecto = 'completo' | 'ligero' | 'minimo';

export interface EntornoEfecto {
  /** navigator.deviceMemory (GB, aproximado); undefined si el navegador no lo dice. */
  memoriaGB?: number;
  /** navigator.hardwareConcurrency. */
  nucleos?: number;
  /** navigator.connection.saveData: la persona pidió ahorrar datos. */
  ahorroDeDatos?: boolean;
  /** navigator.connection.effectiveType. */
  conexion?: string;
  /** Pantalla táctil (celular/tableta). */
  movil?: boolean;
  /** window.devicePixelRatio. */
  dpr?: number;
}

/**
 * Decide qué tan pesado puede ser el efecto en este equipo:
 *  - 'minimo': sin WebGL (solo el degradado y la animación CSS del logo): ahorro
 *    de datos activado o conexión muy lenta.
 *  - 'ligero': equipos modestos (poca memoria, pocos núcleos o celular de pantalla
 *    muy densa): menos resolución y menos cuadros por segundo.
 *  - 'completo': el resto.
 */
export function detectarNivel(e: EntornoEfecto): NivelEfecto {
  if (e.ahorroDeDatos) return 'minimo';
  if (e.conexion === 'slow-2g' || e.conexion === '2g') return 'minimo';
  if (e.memoriaGB !== undefined && e.memoriaGB <= 2) return 'ligero';
  if (e.nucleos !== undefined && e.nucleos <= 4 && (e.movil || (e.memoriaGB !== undefined && e.memoriaGB <= 4))) return 'ligero';
  if (e.movil && (e.dpr ?? 1) >= 3 && (e.nucleos ?? 8) <= 6) return 'ligero';
  return 'completo';
}

export interface PerfilEfecto {
  /** Cuadros por segundo máximos: los movimientos son lentos, 30 se ven igual que 60. */
  fpsMax: number;
  /** Factor de resolución del canvas de fondo. */
  escalaFondo: number;
  /** Factor de resolución de la capa superior (rayos, nubes y brasas: luz suave). */
  escalaSobre: number;
  /** Factor de resolución de la capa de detalle del logo (sobre los píxeles del dispositivo, hasta 2x). */
  escalaDetalle: number;
}

export function perfilDeNivel(nivel: Exclude<NivelEfecto, 'minimo'>): PerfilEfecto {
  return nivel === 'ligero'
    ? { fpsMax: 20, escalaFondo: 0.65, escalaSobre: 0.4, escalaDetalle: 0.75 }
    : { fpsMax: 30, escalaFondo: 1, escalaSobre: ESCALA_CAPA_SUPERIOR, escalaDetalle: 1 };
}

// ---------------------------------------------------------------------------
// Preparación (una sola vez, sin bloquear) de las texturas del logo.
// ---------------------------------------------------------------------------

/** Texturas del logo ya calculadas (las comparten la capa de fondo y la superior). */
export interface CamposLogo {
  ancho: number;
  alto: number;
  /** Relleno de la textura, como fracción del tamaño del logo. */
  relX: number;
  relY: number;
  /** Ancho / alto de la imagen del logo. */
  logoAsp: number;
  /** R silueta, G y B difuminadas, A rendijas. */
  campo: Uint8Array;
  /** R borde azul, G borde naranja, B capas azules, A capas naranjas. */
  energia: Uint8Array;
}

const cacheCampos = new Map<string, Promise<CamposLogo>>();

/** Cede el hilo principal para que el navegador pinte y responda entre pasos pesados. */
const ceder = (): Promise<void> => new Promise((res) => setTimeout(res, 0));

/**
 * Calcula (una vez por imagen y compartido entre capas) las texturas del logo.
 * Es trabajo de CPU (~45 ms de una vez): se reparte en pasos con `ceder()` entre
 * ellos, así nunca bloquea el hilo principal más que unos pocos ms seguidos.
 */
export function prepararCampos(src: string): Promise<CamposLogo> {
  let p = cacheCampos.get(src);
  if (!p) {
    p = calcularCampos(src);
    cacheCampos.set(src, p);
    p.catch(() => cacheCampos.delete(src)); // si falla, se puede reintentar
  }
  return p;
}

async function calcularCampos(src: string): Promise<CamposLogo> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const w0 = ANCHO_CAMPO;
  const h0 = Math.max(1, Math.round((ANCHO_CAMPO * img.naturalHeight) / img.naturalWidth));
  const px = Math.round(w0 * RELLENO_SILUETA), py = Math.round(h0 * RELLENO_SILUETA);
  const w = w0 + 2 * px, h = h0 + 2 * py;
  const c2d = document.createElement('canvas');
  c2d.width = w; c2d.height = h;
  const ctx = c2d.getContext('2d');
  if (!ctx) throw new Error('sin canvas 2d');
  ctx.drawImage(img, px, py, w0, h0);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  await ceder();
  const alfa = new Uint8Array(w * h);
  const azules = new Uint8Array(w * h);
  const naranjas = new Uint8Array(w * h);
  const rendijas = new Uint8Array(w * h);
  for (let i = 0; i < alfa.length; i++) {
    const rr = rgba[i * 4], gg = rgba[i * 4 + 1], bb = rgba[i * 4 + 2], aa = rgba[i * 4 + 3];
    alfa[i] = aa;
    azules[i] = aa > 128 && bb > rr + 45 && bb > 115 ? 255 : 0;
    naranjas[i] = aa > 128 && rr > 150 && rr > bb * 1.5 && gg < rr * 0.85 + 30 && rr - bb > 60 ? 255 : 0;
    rendijas[i] = aa > 128 && azules[i] === 0 && naranjas[i] === 0 ? 255 : 0;
  }
  await ceder();
  const campo = campoDeSilueta(alfa, w, h, w0 * 0.12, w0 * 0.04, rendijas);
  await ceder();
  const energia = texturaEnergia(azules, naranjas, w, h, RADIO_BORDE);
  return { ancho: w, alto: h, relX: px / w0, relY: py / h0, logoAsp: img.naturalWidth / img.naturalHeight, campo, energia };
}

export interface OpcionesRayos {
  /**
   * 'fondo' (por defecto): haces, bruma, polvo y rayos. 'sobre': capa transparente-aditiva
   * con los rayos, nubes y brasas que caen sobre el logo. 'detalle': canvas del tamaño del
   * logo con su núcleo y sus líneas de energía a resolución completa. Las dos últimas van
   * encima del logo con mix-blend-mode: screen.
   */
  modo?: ModoCapa;
  /** Un solo cuadro, sin animar (movimiento reducido). */
  estatico?: boolean;
  /** Elemento cuya silueta interactúa con la luz (ej. el logo). */
  oclusor?: Oclusor;
  /** Nivel de calidad (por defecto 'completo'); 'minimo' no usa WebGL. */
  nivel?: NivelEfecto;
  /** Se llama tras dibujar el primer cuadro. */
  alPrimerCuadro?: () => void;
  /** Se llama si no hay WebGL o se perdió el contexto. */
  alFallar?: () => void;
}

/** Inicia el efecto en `canvas`; devuelve la función que lo detiene y limpia. */
export function iniciarRayosDeLuz(canvas: HTMLCanvasElement, { modo = 'fondo', estatico = false, oclusor, nivel = 'completo', alPrimerCuadro, alFallar }: OpcionesRayos = {}): () => void {
  if (nivel === 'minimo') { alFallar?.(); return () => {}; }
  const perfil = perfilDeNivel(nivel);
  const solo = modo !== 'fondo'; // capa transparente-aditiva sobre el logo (rayos o detalle)
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { alFallar?.(); return () => {}; }

  let cancelado = false;
  let detener: () => void = () => {};
  if (modo === 'detalle') entrada.hayDetalle = true;
  const soltarEntrada = () => { if (modo === 'detalle') { entrada.hayDetalle = false; entrada.tListo = -1; } };

  function compilar(tipo: number, fuente: string) {
    const s = gl!.createShader(tipo);
    if (!s) return null;
    gl!.shaderSource(s, fuente);
    gl!.compileShader(s);
    return s;
  }
  const vs = compilar(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compilar(gl.FRAGMENT_SHADER, fragmentDeCapa(modo));
  const prog = vs && fs ? gl.createProgram() : null;
  if (!vs || !fs || !prog) { alFallar?.(); return () => {}; }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  /**
   * Compilar este shader (el más grande de la página) bloquea el hilo principal
   * cientos de ms en equipos modestos. Con KHR_parallel_shader_compile el
   * navegador lo hace en otro hilo y aquí solo se espera a que termine sin
   * bloquear; sin la extensión se compila de forma síncrona, como antes.
   */
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  const compilado = (): Promise<void> => new Promise((res) => {
    const sondear = () => {
      if (cancelado || !ext || gl.getProgramParameter(prog, ext.COMPLETION_STATUS_KHR)) res();
      else setTimeout(sondear, 16);
    };
    sondear();
  });

  void compilado().then(() => {
    if (cancelado) return;
    // Sin este aviso un error del shader es invisible (el efecto simplemente no aparece).
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) console.error('[rayosDeLuz] el shader no compiló:', gl.getShaderInfoLog(fs));
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { soltarEntrada(); alFallar?.(); return; }
    detener = arrancar();
  });

  function arrancar(): () => void {
    gl!.useProgram(prog);
    const buf = gl!.createBuffer();
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl!.STATIC_DRAW);
    const loc = gl!.getAttribLocation(prog!, 'a_pos');
    gl!.enableVertexAttribArray(loc);
    gl!.vertexAttribPointer(loc, 2, gl!.FLOAT, false, 0, 0);
    const uRes = gl!.getUniformLocation(prog!, 'u_res');
    const uT = gl!.getUniformLocation(prog!, 'u_t');
    const uTex = gl!.getUniformLocation(prog!, 'u_tex');
    const uTex2 = gl!.getUniformLocation(prog!, 'u_tex2');
    const uOcc = gl!.getUniformLocation(prog!, 'u_occ');
    const uHayOcc = gl!.getUniformLocation(prog!, 'u_hayOcc');
    const uSolo = gl!.getUniformLocation(prog!, 'u_solo');
    const uFade = gl!.getUniformLocation(prog!, 'u_fade');
    const uEntrada = gl!.getUniformLocation(prog!, 'u_entrada');
    const uPad = gl!.getUniformLocation(prog!, 'u_pad');
    const uLogoAsp = gl!.getUniformLocation(prog!, 'u_logoAsp');
    let tPrimero = -1; // instante (del reloj del efecto) del primer cuadro dibujado

    // Texturas del logo (transparentes hasta que estén calculadas).
    function crearTextura(unidad: number, uniforme: WebGLUniformLocation | null) {
      const tx = gl!.createTexture();
      gl!.activeTexture(gl!.TEXTURE0 + unidad);
      gl!.bindTexture(gl!.TEXTURE_2D, tx);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, 1, 1, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.uniform1i(uniforme, unidad);
      return tx;
    }
    const textura = crearTextura(0, uTex);
    const textura2 = crearTextura(1, uTex2);
    gl!.activeTexture(gl!.TEXTURE0);
    let texturaLista = false;

    // Calidad adaptativa: si el equipo no sostiene los cuadros por segundo del perfil,
    // se baja la resolución del canvas (el navegador lo escala). Solo baja, nunca sube.
    const intervalo = 1000 / perfil.fpsMax;
    const umbral = Math.max(UMBRAL_CUADRO_MS, intervalo * 1.3);
    let escalaAdaptativa = 1;
    let ultimoTs = 0;
    let descartar = 20; // los primeros cuadros incluyen compilar el shader y subir la textura
    let sumaMs = 0;
    let medidos = 0;
    function medirRendimiento(ahora: number) {
      if (ultimoTs > 0 && ahora - ultimoTs < 400) {
        if (descartar > 0) descartar--;
        else {
          sumaMs += ahora - ultimoTs;
          if (++medidos >= 30) {
            const nueva = siguienteEscala(escalaAdaptativa, sumaMs / medidos, umbral);
            if (nueva !== escalaAdaptativa) { escalaAdaptativa = nueva; descartar = 8; }
            sumaMs = 0;
            medidos = 0;
          }
        }
      }
      ultimoTs = ahora;
    }

    let vacio = false; // la capa superior ya está limpia: no hay que redibujar

    function ajustarTamano() {
      const dpr = window.devicePixelRatio || 1;
      // El detalle es un canvas chico (el logo): se dibuja a los píxeles reales del dispositivo
      // (hasta 2x) para que no se vea pixeleado; las demás capas usan la calidad general.
      const q = modo === 'detalle'
        ? Math.min(2, Math.max(1, dpr)) * perfil.escalaDetalle
        : calidadDeRender(canvas.clientWidth, dpr) * (solo ? perfil.escalaSobre : perfil.escalaFondo * escalaAdaptativa);
      const w = Math.max(2, Math.round(canvas.clientWidth * q));
      const h = Math.max(2, Math.round(canvas.clientHeight * q));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; vacio = false; }
      gl!.viewport(0, 0, canvas.width, canvas.height);
    }

    let raf = 0;
    let primero = true;
    let logoAsp = 1; // ancho / alto de la imagen del logo
    let relX = 0, relY = 0; // relleno de la textura del oclusor, como fracción del tamaño del elemento

    if (oclusor) {
      prepararCampos(oclusor.src).then((c) => {
        if (cancelado) return;
        relX = c.relX; relY = c.relY; logoAsp = c.logoAsp;
        gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.bindTexture(gl!.TEXTURE_2D, textura);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, c.ancho, c.alto, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, c.campo);
        gl!.activeTexture(gl!.TEXTURE1);
        gl!.bindTexture(gl!.TEXTURE_2D, textura2);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, c.ancho, c.alto, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, c.energia);
        gl!.activeTexture(gl!.TEXTURE0);
        texturaLista = true;
        if (estatico) dibujar(T_ESTATICO);
      }).catch(() => { /* sin textura el efecto sigue, solo sin interacción con el logo */ });
    }

    function dibujar(t: number) {
      ajustarTamano();
      gl!.uniform2f(uRes, canvas.width, canvas.height);
      gl!.uniform1f(uT, t);
      if (tPrimero < 0) tPrimero = t;
      gl!.uniform1f(uSolo, solo ? 1 : 0);
      gl!.uniform1f(uFade, estatico ? 1 : factorFadeIn(t - tPrimero));
      // El oclusor se mueve (el logo "flota"): se lee su rect en cada cuadro.
      const el = oclusor && texturaLista ? document.querySelector(oclusor.selector) : null;
      // La entrada (núcleo y halo) arranca cuando el logo está listo; ver `entrada` arriba.
      if (el && entrada.tListo < 0 && (modo === 'detalle' || !entrada.hayDetalle)) entrada.tListo = t;
      // Sin animar (movimiento reducido) todo ya está formado: la entrada se salta.
      gl!.uniform1f(uEntrada, estatico ? 1e3 : entrada.tListo < 0 ? -1 : t - entrada.tListo);
      if (el) {
        const [x, y, w, h] = rectEnFracciones(el.getBoundingClientRect(), canvas.getBoundingClientRect());
        // La textura incluye el relleno: se pasa su rect ampliado.
        gl!.uniform4f(uOcc, x - relX * w, y - relY * h, w * (1 + 2 * relX), h * (1 + 2 * relY));
        gl!.uniform1f(uHayOcc, 1);
        gl!.uniform2f(uPad, relX, relY);
        gl!.uniform1f(uLogoAsp, logoAsp);
      } else {
        gl!.uniform1f(uHayOcc, 0);
      }
      if (solo && !el) {
        // Sin logo la capa superior está vacía: se limpia una vez y no se dibuja más.
        if (!vacio) { gl!.clearColor(0, 0, 0, 1); gl!.clear(gl!.COLOR_BUFFER_BIT); vacio = true; }
      } else {
        vacio = false;
        gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      }
      if (primero) { primero = false; alPrimerCuadro?.(); }
    }

    // Tope de cuadros por segundo: se dibuja solo cuando cambia el "tick" de la marca de
    // tiempo del cuadro. Como esa marca es la misma para todas las capas, el fondo y la
    // capa superior dibujan SIEMPRE en los mismos cuadros (quedan sincronizadas).
    let ultimoTick = -1;
    function cuadro(ahora: number) {
      raf = requestAnimationFrame(cuadro);
      const tick = Math.floor(ahora / intervalo);
      if (tick === ultimoTick) return;
      ultimoTick = tick;
      if (!solo) medirRendimiento(ahora);
      dibujar(tiempoEfecto(ahora));
    }

    const alRedimensionar = () => { if (estatico) dibujar(T_ESTATICO); };
    const alVisibilidad = () => {
      if (estatico) return;
      if (document.hidden) cancelAnimationFrame(raf);
      else { reanudarReloj(); ultimoTs = 0; raf = requestAnimationFrame(cuadro); }
    };
    const alPerderContexto = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); soltarEntrada(); alFallar?.(); };

    window.addEventListener('resize', alRedimensionar);
    document.addEventListener('visibilitychange', alVisibilidad);
    canvas.addEventListener('webglcontextlost', alPerderContexto);

    if (estatico) dibujar(T_ESTATICO);
    else raf = requestAnimationFrame(cuadro);

    return () => {
      cancelAnimationFrame(raf);
      soltarEntrada();
      window.removeEventListener('resize', alRedimensionar);
      document.removeEventListener('visibilitychange', alVisibilidad);
      canvas.removeEventListener('webglcontextlost', alPerderContexto);
      gl!.deleteTexture(textura);
      gl!.deleteTexture(textura2);
      gl!.deleteBuffer(buf);
    };
  }

  return () => {
    cancelado = true;
    detener();
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };
}
