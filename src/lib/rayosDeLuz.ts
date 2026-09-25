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
 *  - radio: radio del núcleo, como fracción del ALTO del logo.
 */
export const NUCLEO = { cx: 0.505, cy: 0.329, hw: 0.228, hh: 0.144, nx: 0.508, ny: 0.43, radio: 0.125 };

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
uniform sampler2D u_tex;   // campo del oclusor: R silueta, G y B silueta difuminada (ancha y fina)
uniform vec4 u_occ;        // rect de la textura (logo + relleno) en fracciones del canvas: x, y (arriba-izq), ancho, alto
uniform float u_hayOcc;    // 1.0 si hay oclusor con textura lista
uniform vec2 u_pad;         // relleno de la textura del logo (fracción de su tamaño, x e y)
uniform float u_logoAsp;   // ancho / alto de la imagen del logo
uniform float u_fade;      // 0 → 1: aparición gradual de todo el efecto la primera vez
uniform float u_solo;      // 1.0: capa superior (solo los rayos, para ir SOBRE el logo)

// Hash sin patrones visibles (Hoskins) e interpolación quíntica: sin bordes
// duros ni cuadrícula en la bruma.
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
  float a = smoothstep(0.0, 0.08, ts) * (1.0 - smoothstep(0.5, 1.1, ts));
  float b = 0.55 * smoothstep(1.43, 1.51, ts) * (1.0 - smoothstep(1.65, 1.98, ts));
  return max(a, b);
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

// Rayos eléctricos alrededor (y sobre) el logo. Cada rayo es una línea de nivel
// del campo difuminado del logo, deformada con ruido que salta a ~18 Hz (el arco
// cambia de camino y parpadea); solo se ven tramos, que cambian en cada
// ráfaga. Con solo = 1 (capa superior, que va SOBRE el logo) únicamente se
// dibuja lo que cae encima de su silueta; la capa del fondo dibuja el resto.
vec3 rayos(vec2 p, vec2 fr, float asp, float t, float solo) {
  // Las chispas (capa superior) duran más que la ráfaga porque rebotan en el suelo.
  vec3 chis = solo > 0.5 ? chispas(p, asp, t) : vec3(0.0);
  float ev = rafaga(t);
  if (ev < 0.01) return chis;
  vec3 cf = campo(fr);
  vec2 cc = vec2((u_occ.x + u_occ.z * 0.5) * asp, u_occ.y + u_occ.w * 0.5);
  float rodea = atan(p.y - cc.y, p.x - cc.x);
  float paso = floor(t * 18.0);
  vec2 sd = vec2(paso * 3.71, paso * 1.93);
  float flick = 0.70 + 0.30 * step(0.30, hash(vec2(paso, 3.3)));
  float bi = floor(t / ${PERIODO_RAFAGA.toFixed(1)});
  float tramo = floor(t * 4.0);
  float naranja = step(0.5, noise1(rodea * 1.3 + bi * 3.7 + 30.0));

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

  // Arco cercano al contorno.
  float j1 = (fbm(p * 24.0 + sd) - 0.5) * 0.34 + (noise(p * 60.0 + sd.yx) - 0.5) * 0.09;
  float d1 = cf.g - 0.34 + j1;
  float seg1 = arco(rodea, vec2(bi * 9.1, tramo * 0.9), 0.50);
  // Arco más alejado.
  float j2 = (fbm(p * 18.0 + sd * 1.3 + 7.0) - 0.5) * 0.44 + (noise(p * 48.0 + sd) - 0.5) * 0.08;
  float d2 = cf.g - 0.17 + j2;
  float seg2 = arco(rodea, vec2(bi * 5.3 + 17.0, tramo * 1.1 + 3.0), 0.54);
  // Arco que se mete sobre el propio logo (más disperso).
  float j3 = (fbm(p * 20.0 + sd * 0.9 + 13.0) - 0.5) * 0.78 + (noise(p * 55.0 + sd.yx * 1.1) - 0.5) * 0.10;
  float d3 = cf.g - 0.62 + j3;
  float seg3 = arco(rodea, vec2(bi * 7.7 + 41.0, tramo * 0.8 + 9.0), 0.60);

  vec3 azulNucleo = vec3(0.85, 0.95, 1.0);
  vec3 azulGlow = vec3(0.0, 0.40, 1.0);
  vec3 narNucleo = vec3(1.0, 0.92, 0.68);
  vec3 narGlow = vec3(1.0, 0.40, 0.02);

  float l1 = smoothstep(0.050, 0.0, abs(d1)) * seg1 * 2.6;
  float g1 = exp(-abs(d1) * 10.0) * 1.10 * seg1;
  float l2 = smoothstep(0.050, 0.0, abs(d2)) * seg2 * 2.6;
  float g2 = exp(-abs(d2) * 9.0) * 1.00 * seg2;
  float l3 = smoothstep(0.048, 0.0, abs(d3)) * seg3 * 2.0;
  float g3 = exp(-abs(d3) * 11.0) * 0.80 * seg3;
  // Solo cerca del logo: lejos el campo vale 0 y el ruido dibujaría contornos sueltos.
  float cerca = smoothstep(0.03, 0.12, cf.g);
  // El campo termina en el borde de la textura: se apaga hacia allá para que el
  // halo ancho no quede cortado en línea recta.
  vec2 l = (fr - u_occ.xy) / u_occ.zw;
  float borde = smoothstep(0.0, 0.22, min(min(l.x, 1.0 - l.x), min(l.y, 1.0 - l.y)));
  float visible = (solo > 0.5 ? cf.r : 1.0 - 0.9 * cf.r) * cerca * borde;

  // Halo de luz del propio color de cada rayo: ancho y suave, como el reflejo del
  // arco sobre el logo (en la capa superior cae encima de su superficie).
  vec3 azulHalo = vec3(0.05, 0.42, 1.0);
  vec3 narHalo = vec3(1.0, 0.42, 0.05);
  float h1 = exp(-abs(d1 - 0.5 * j1) * 3.6) * arcoSuave(rodea, vec2(bi * 9.1, tramo * 0.9), 0.50);
  float h2 = exp(-abs(d2 - 0.5 * j2) * 3.4) * arcoSuave(rodea, vec2(bi * 5.3 + 17.0, tramo * 1.1 + 3.0), 0.54);
  float h3 = exp(-abs(d3 - 0.5 * j3) * 3.8) * arcoSuave(rodea, vec2(bi * 7.7 + 41.0, tramo * 0.8 + 9.0), 0.60);
  vec3 halo = azulHalo * (h1 + h3) * 0.34 + mix(azulHalo, narHalo, naranja) * h2 * 0.30;

  vec3 rayo = halo * visible * ev * flick * (solo > 0.5 ? 1.3 : 1.0);
  rayo += (azulNucleo * (l1 + l3) + azulGlow * (g1 + g3)
             + mix(azulNucleo, narNucleo, naranja) * l2 + mix(azulGlow, narGlow, naranja) * g2)
             * visible * ev * flick;
  if (solo < 0.5) {
    // Resplandor pegado al borde del logo mientras dura la descarga.
    rayo += azulGlow * cf.b * (1.0 - cf.r) * 0.30 * ev * flick;
  }
  return rayo + piso + chis;
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
  return vec3(0.10, 0.45, 1.0) * nube * franja * ola * cerca * 0.35;
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
  // Núcleo (círculo en unidades de alto del logo), centrado hacia el borde de abajo.
  vec2 q = vec2((lg.x - ${NUCLEO.nx}) * u_logoAsp, lg.y - ${NUCLEO.ny});
  float rad = length(q) / ${NUCLEO.radio};
  float cuerpo = 1.0 - smoothstep(0.55, 1.0, rad);
  float corona = exp(-rad * 2.2) * 0.5; // halo que rodea el núcleo: transparente
  // Plasma que bulle por dentro (ruido que sube despacio) y un latido suave.
  float plasma = fbm(q * 34.0 + vec2(t * 0.15, -t * 0.55));
  float pulso = 0.82 + 0.18 * sin(t * 1.5);
  vec3 azul = vec3(0.10, 0.50, 1.0);
  vec3 blanco = vec3(0.85, 0.97, 1.0);
  vec3 col = mix(azul, blanco, smoothstep(0.35, 0.95, (1.0 - rad) + 0.35 * plasma));
  vec3 base = col * (cuerpo * (0.75 + 0.5 * plasma) + corona) * pulso;

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
  float s1 = smoothstep(0.40, 0.55, noise(circ * 1.7 + vec2(tramo * 4.7, 3.0)));
  float j2 = (fbm(circ * 3.4 + vec2(paso * 2.3, 7.0 + paso * 0.6)) - 0.5) * 0.6 + (noise(circ * 11.0 + vec2(paso * 1.3, 5.0)) - 0.5) * 0.16;
  float d2 = rad - 0.58 + j2;
  float s2 = smoothstep(0.46, 0.60, noise(circ * 1.9 + vec2(tramo * 2.9, 11.0)));
  float dentroNucleo = 1.0 - smoothstep(1.15, 1.5, rad);
  float linea = (smoothstep(0.075, 0.0, abs(d1)) * s1 + smoothstep(0.065, 0.0, abs(d2)) * s2) * dentroNucleo;
  float brilloArco = (exp(-abs(d1) * 8.0) * 0.45 * s1 + exp(-abs(d2) * 8.0) * 0.40 * s2) * dentroNucleo;
  vec3 rayosNucleo = blanco * linea * 1.5 + azul * brilloArco * 0.7;

  return (base + rayosNucleo) * dentro;
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
  if (u_solo > 0.5) {
    gl_FragColor = vec4((u_hayOcc > 0.5 ? rayos(p, fr, asp, t, 1.0) + nubes(p, fr, asp, t) + nucleo(fr, t) : vec3(0.0)) * u_fade, 1.0);
    return;
  }
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
    rayo = rayos(p, fr, asp, t, 0.0);
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
    float fuerza = (1.15 + 0.9 * haz) * (1.0 + 0.9 * rafaga(t));
    rayo += (azulVivo * halo * latido * (0.7 + 0.5 * energia) * 0.4
           + mix(azulVivo, nucleoVivo, energia) * lenguas * energia * 0.35) * fuerza;
    }
  }

  // Polvo: tres capas (fino, medio y bokeh grande), solo donde hay luz.
  float polvo = dust(p, 16.0, 0.10, 1.0, luz, t)
              + dust(p, 30.0, 0.16, 7.0, luz, t) * 0.8
              + dust(p, 9.0, 0.06, 13.0, luz, t) * 0.35;

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
}
`;

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
export function siguienteEscala(escala: number, mediaMs: number): number {
  if (mediaMs <= UMBRAL_CUADRO_MS || escala <= ESCALA_MINIMA) return escala;
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
  const a = suave(0, 0.08, ts) * (1 - suave(0.5, 1.1, ts));
  const b = 0.55 * suave(1.43, 1.51, ts) * (1 - suave(1.65, 1.98, ts));
  return Math.max(a, b);
}

/** Segundos tras el inicio de cada ráfaga en que aún puede haber chispas en el aire (rebotando). */
export const DURACION_CHISPAS = 3.4;

/** ¿Hay una ola de nubes de energía por delante del logo en el instante `t`? */
export function hayNubes(t: number): boolean {
  return (((t % PERIODO_NUBES) + PERIODO_NUBES) % PERIODO_NUBES) < DURACION_NUBES;
}

/** Resolución del campo del logo respecto a la imagen original (es un campo suave: no necesita más). */
export const ESCALA_CAMPO = 0.5;

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

/** Textura RGBA del oclusor: R silueta, G silueta muy difuminada, B difuminada fina, A opaco. */
export function campoDeSilueta(alfa: Uint8Array, ancho: number, alto: number, radioAncho: number, radioFino: number): Uint8Array {
  const g = desenfocar(alfa, ancho, alto, radioAncho);
  const b = desenfocar(alfa, ancho, alto, radioFino);
  const out = new Uint8Array(ancho * alto * 4);
  for (let i = 0; i < alfa.length; i++) {
    out[i * 4] = alfa[i];
    out[i * 4 + 1] = g[i];
    out[i * 4 + 2] = b[i];
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * Reloj del efecto compartido por todas las capas (fondo y capa superior deben
 * dibujar el MISMO instante para que los rayos casen). Avanza una vez por
 * cuadro (las capas de un mismo cuadro reciben la misma marca de tiempo) y no
 * corre mientras la pestaña está oculta.
 */
const reloj = { acumulado: 0, ultimoAhora: -1 };
function tiempoEfecto(ahora: number): number {
  if (ahora !== reloj.ultimoAhora) {
    if (reloj.ultimoAhora >= 0) reloj.acumulado += Math.min(0.1, (ahora - reloj.ultimoAhora) / 1000);
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

export interface OpcionesRayos {
  /**
   * 'fondo' (por defecto): haces, bruma, polvo y rayos. 'sobre': capa transparente-aditiva
   * con solo los rayos que caen sobre el logo; va encima de él con mix-blend-mode: screen.
   */
  modo?: 'fondo' | 'sobre';
  /** Un solo cuadro, sin animar (movimiento reducido). */
  estatico?: boolean;
  /** Elemento cuya silueta interactúa con la luz (ej. el logo). */
  oclusor?: Oclusor;
  /** Se llama tras dibujar el primer cuadro. */
  alPrimerCuadro?: () => void;
  /** Se llama si no hay WebGL o se perdió el contexto. */
  alFallar?: () => void;
}

/** Inicia el efecto en `canvas`; devuelve la función que lo detiene y limpia. */
export function iniciarRayosDeLuz(canvas: HTMLCanvasElement, { modo = 'fondo', estatico = false, oclusor, alPrimerCuadro, alFallar }: OpcionesRayos = {}): () => void {
  const solo = modo === 'sobre';
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { alFallar?.(); return () => {}; }

  function compilar(tipo: number, fuente: string) {
    const s = gl!.createShader(tipo);
    if (!s) return null;
    gl!.shaderSource(s, fuente);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      // Sin este aviso un error del shader es invisible (el efecto simplemente no aparece).
      console.error('[rayosDeLuz] el shader no compiló:', gl!.getShaderInfoLog(s));
      gl!.deleteShader(s);
      return null;
    }
    return s;
  }
  const vs = compilar(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compilar(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const prog = vs && fs ? gl.createProgram() : null;
  if (!vs || !fs || !prog) { alFallar?.(); return () => {}; }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { alFallar?.(); return () => {}; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uT = gl.getUniformLocation(prog, 'u_t');
  const uTex = gl.getUniformLocation(prog, 'u_tex');
  const uOcc = gl.getUniformLocation(prog, 'u_occ');
  const uHayOcc = gl.getUniformLocation(prog, 'u_hayOcc');
  const uSolo = gl.getUniformLocation(prog, 'u_solo');
  const uFade = gl.getUniformLocation(prog, 'u_fade');
  const uPad = gl.getUniformLocation(prog, 'u_pad');
  const uLogoAsp = gl.getUniformLocation(prog, 'u_logoAsp');
  let tPrimero = -1; // instante (del reloj del efecto) del primer cuadro dibujado

  // Textura del oclusor (transparente hasta que cargue la imagen).
  const textura = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textura);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(uTex, 0);
  let texturaLista = false;
  let cancelado = false;

  // Calidad adaptativa (solo la capa de fondo, que es la pesada): si el equipo no
  // sostiene ~40 fps, se baja la resolución del canvas; el navegador lo escala.
  let escalaAdaptativa = 1;
  let ultimoTs = 0;
  let descartar = 20; // los primeros cuadros incluyen compilar el shader y subir la textura
  let sumaMs = 0;
  let medidos = 0;
  function medirRendimiento(ahora: number) {
    if (ultimoTs > 0 && ahora - ultimoTs < 250) {
      if (descartar > 0) descartar--;
      else {
        sumaMs += ahora - ultimoTs;
        if (++medidos >= 45) {
          const nueva = siguienteEscala(escalaAdaptativa, sumaMs / medidos);
          if (nueva !== escalaAdaptativa) { escalaAdaptativa = nueva; descartar = 12; }
          sumaMs = 0;
          medidos = 0;
        }
      }
    }
    ultimoTs = ahora;
  }

  let vacio = false; // la capa superior ya está limpia: no hay que redibujar hasta la próxima ráfaga

  function ajustarTamano() {
    const q = calidadDeRender(canvas.clientWidth, window.devicePixelRatio || 1) * (solo ? ESCALA_CAPA_SUPERIOR : escalaAdaptativa);
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
    const img = new Image();
    img.onload = () => {
      if (cancelado) return;
      // La silueta se rasteriza con relleno alrededor y se le calcula el campo
      // difuminado (una sola vez) que usa el shader para trazar los rayos. Es un
      // campo suave: se calcula a media resolución (4 veces menos píxeles, ~45 ms
      // en vez de ~180 ms bloqueando el hilo principal al cargar) y la GPU lo
      // amplía con filtrado lineal.
      const w0 = Math.max(1, Math.round(img.naturalWidth * ESCALA_CAMPO));
      const h0 = Math.max(1, Math.round(img.naturalHeight * ESCALA_CAMPO));
      const px = Math.round(w0 * RELLENO_SILUETA), py = Math.round(h0 * RELLENO_SILUETA);
      const w = w0 + 2 * px, h = h0 + 2 * py;
      const c2d = document.createElement('canvas');
      c2d.width = w; c2d.height = h;
      const ctx = c2d.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, px, py, w0, h0);
      const rgba = ctx.getImageData(0, 0, w, h).data;
      const alfa = new Uint8Array(w * h);
      for (let i = 0; i < alfa.length; i++) alfa[i] = rgba[i * 4 + 3];
      const datos = campoDeSilueta(alfa, w, h, w0 * 0.12, w0 * 0.04);
      relX = px / w0; relY = py / h0;
      logoAsp = img.naturalWidth / img.naturalHeight;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textura);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, datos);
      texturaLista = true;
      if (estatico) dibujar(T_ESTATICO);
    };
    img.src = oclusor.src;
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
  function cuadro(ahora: number) {
    if (!solo) medirRendimiento(ahora);
    dibujar(tiempoEfecto(ahora));
    raf = requestAnimationFrame(cuadro);
  }

  const alRedimensionar = () => { if (estatico) dibujar(T_ESTATICO); };
  const alVisibilidad = () => {
    if (estatico) return;
    if (document.hidden) cancelAnimationFrame(raf);
    else { reanudarReloj(); ultimoTs = 0; raf = requestAnimationFrame(cuadro); }
  };
  const alPerderContexto = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); alFallar?.(); };

  window.addEventListener('resize', alRedimensionar);
  document.addEventListener('visibilitychange', alVisibilidad);
  canvas.addEventListener('webglcontextlost', alPerderContexto);

  if (estatico) dibujar(T_ESTATICO);
  else raf = requestAnimationFrame(cuadro);

  return () => {
    cancelado = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', alRedimensionar);
    document.removeEventListener('visibilitychange', alVisibilidad);
    canvas.removeEventListener('webglcontextlost', alPerderContexto);
    gl.deleteTexture(textura);
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteBuffer(buf);
  };
}
