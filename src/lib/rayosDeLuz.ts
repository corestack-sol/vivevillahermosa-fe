/**
 * Efecto "rayos de luz con polvo" generado en tiempo real (WebGL, un solo
 * fragment shader) — recrea la imagen de src/assets/bg.jfif: fondo negro,
 * haces que salen de la esquina superior izquierda a través de una
 * bruma con textura, y motas de polvo que flotan dentro de los haces.
 *
 * Opcionalmente recibe un "oclusor" (un elemento del DOM con su imagen, ej.
 * el logo): el shader lee su silueta y la luz interactúa con él — un haz más
 * intenso lo atraviesa, la luz abraza su contorno y proyecta una sombra en
 * dirección contraria a la fuente.
 */

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
uniform sampler2D u_tex;   // silueta del oclusor (canal alfa)
uniform vec4 u_occ;        // rect del oclusor en fracciones del canvas: x, y (arriba-izq), ancho, alto
uniform float u_hayOcc;    // 1.0 si hay oclusor con textura lista

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

// Opacidad de la silueta del oclusor en el punto f (fracciones del canvas).
float ocluso(vec2 f) {
  vec2 l = (f - u_occ.xy) / u_occ.zw;
  float dentro = step(0.0, l.x) * step(l.x, 1.0) * step(0.0, l.y) * step(l.y, 1.0);
  return texture2D(u_tex, clamp(l, 0.0, 1.0)).a * dentro;
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
  float s = coordHaz(p, asp);

  // Haz que atraviesa al oclusor: se intensifica justo hacia él.
  float haz = 0.0;
  if (u_hayOcc > 0.5) {
    vec2 c = u_occ.xy + u_occ.zw * 0.5;
    float sOcc = coordHaz(vec2(c.x * asp, c.y), asp);
    haz = exp(-pow((s - sOcc) / 0.10, 2.0));
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

  // Interacción con el oclusor: sombra proyectada + luz que abraza el contorno.
  if (u_hayOcc > 0.5) {
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
    // Halo: la luz abraza el contorno (silueta borrosa por fuera); el muestreo
    // se gira por píxel para que no se marquen escalones.
    float halo = 0.0;
    for (int i = 0; i < 12; i++) {
      float a = rot + float(i) * 0.5236;
      float rad = mod(float(i), 2.0) < 0.5 ? 0.012 : 0.026;
      vec2 pt = p + vec2(cos(a), sin(a)) * rad;
      halo += ocluso(vec2(pt.x / asp, pt.y));
    }
    halo = clamp(halo / 6.0, 0.0, 1.0) * (1.0 - ocluso(fr));
    luz *= 1.0 - 0.55 * sombra * (1.0 - ocluso(fr));
    luz += halo * (0.18 + 0.4 * haz) * (0.6 + 0.8 * bruma);
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
export function iniciarRayosDeLuz(canvas: HTMLCanvasElement, { estatico = false, oclusor, alPrimerCuadro, alFallar }: OpcionesRayos = {}): () => void {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { alFallar?.(); return () => {}; }

  function compilar(tipo: number, fuente: string) {
    const s = gl!.createShader(tipo);
    if (!s) return null;
    gl!.shaderSource(s, fuente);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) { gl!.deleteShader(s); return null; }
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

  function ajustarTamano() {
    const q = calidadDeRender(canvas.clientWidth, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(canvas.clientWidth * q));
    const h = Math.max(2, Math.round(canvas.clientHeight * q));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl!.viewport(0, 0, canvas.width, canvas.height);
  }

  let raf = 0;
  let primero = true;
  let inicio = performance.now();
  let acumulado = 0; // tiempo del efecto; no avanza mientras la pestaña está oculta
  let ultimo = inicio;
  const T_ESTATICO = 14; // un momento con buenos haces y polvo para el cuadro fijo

  if (oclusor) {
    const img = new Image();
    img.onload = () => {
      if (cancelado) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textura);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      texturaLista = true;
      if (estatico) dibujar(T_ESTATICO);
    };
    img.src = oclusor.src;
  }

  function dibujar(t: number) {
    ajustarTamano();
    gl!.uniform2f(uRes, canvas.width, canvas.height);
    gl!.uniform1f(uT, t);
    // El oclusor se mueve (el logo "flota"): se lee su rect en cada cuadro.
    const el = oclusor && texturaLista ? document.querySelector(oclusor.selector) : null;
    if (el) {
      const [x, y, w, h] = rectEnFracciones(el.getBoundingClientRect(), canvas.getBoundingClientRect());
      gl!.uniform4f(uOcc, x, y, w, h);
      gl!.uniform1f(uHayOcc, 1);
    } else {
      gl!.uniform1f(uHayOcc, 0);
    }
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    if (primero) { primero = false; alPrimerCuadro?.(); }
  }
  function cuadro(ahora: number) {
    acumulado += Math.min(0.1, (ahora - ultimo) / 1000);
    ultimo = ahora;
    dibujar(acumulado + 6);
    raf = requestAnimationFrame(cuadro);
  }

  const alRedimensionar = () => { if (estatico) dibujar(T_ESTATICO); };
  const alVisibilidad = () => {
    if (estatico) return;
    if (document.hidden) cancelAnimationFrame(raf);
    else { ultimo = performance.now(); raf = requestAnimationFrame(cuadro); }
  };
  const alPerderContexto = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); alFallar?.(); };

  window.addEventListener('resize', alRedimensionar);
  document.addEventListener('visibilitychange', alVisibilidad);
  canvas.addEventListener('webglcontextlost', alPerderContexto);

  if (estatico) dibujar(T_ESTATICO);
  else { inicio = performance.now(); ultimo = inicio; raf = requestAnimationFrame(cuadro); }

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
