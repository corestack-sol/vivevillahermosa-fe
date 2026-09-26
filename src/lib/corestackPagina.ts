/**
 * HTML completo de /corestack. Es una página independiente (no pasa por el layout
 * de React del sitio): el navegador solo descarga este documento (con el CSS y el
 * script del efecto incrustados) y el logo, en vez de los ~480 KB de JS del sitio.
 */

const CSS = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;height:100%;background:#000;overflow:hidden}
.escena{position:fixed;inset:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#000}
.escena.sin-efecto{background:radial-gradient(ellipse at 0% 0%,#0a2a66 0%,#030a1c 45%,#000 80%)}
.capa{position:absolute;inset:0;width:100%;height:100%;display:block}
.escena.sin-efecto .capa{opacity:0}
.capa-sobre{pointer-events:none;z-index:3;mix-blend-mode:screen}
.rejilla{position:absolute;inset:-10%;background-image:radial-gradient(circle,rgba(56,189,248,.55) 2.1px,transparent 2.3px),linear-gradient(rgba(56,189,248,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.18) 1px,transparent 1px);background-size:48px 48px,48px 48px,48px 48px;transform:perspective(600px) rotateX(60deg) scale(1.8) translateY(6%);transform-origin:center bottom;-webkit-mask-image:radial-gradient(ellipse at center,#000 0%,transparent 70%);mask-image:radial-gradient(ellipse at center,#000 0%,transparent 70%)}
.lineas{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0,rgba(255,255,255,.035) 1px,transparent 1px,transparent 3px);mix-blend-mode:overlay;opacity:.5}
.pila{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}
.logo-caja{position:relative;z-index:2;width:min(46vw,220px);animation:encender 2.6s ease-out .2s backwards}
.logo{display:block;width:100%;height:auto;filter:saturate(1.05) contrast(1.04) brightness(1.02) drop-shadow(0 0 4px rgba(90,190,255,.06))}
.luz-logo{position:absolute;inset:0;pointer-events:none;-webkit-mask-image:var(--mascara);mask-image:var(--mascara);-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;mix-blend-mode:soft-light;background:linear-gradient(115deg,rgba(200,235,255,.55) 0%,rgba(120,190,255,.28) 32%,rgba(0,0,0,.3) 78%),linear-gradient(115deg,transparent 38%,rgba(235,248,255,.5) 50%,transparent 62%) 0 0/260% 100% no-repeat}
.titulo{position:relative;z-index:2;margin:0;color:#fff;font-family:'Orbitron','Courier New',ui-monospace,monospace;font-weight:800;font-size:clamp(20px,4.4vw,32px);letter-spacing:.04em;text-shadow:0 0 6px rgba(0,0,0,.9),0 1px 14px rgba(0,0,0,.8);animation:aparecer 1.6s ease-out .4s backwards}
@keyframes encender{from{opacity:0;filter:brightness(.25) saturate(.4)}60%{opacity:1}to{opacity:1;filter:brightness(1) saturate(1)}}
@keyframes aparecer{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.logo-caja,.titulo{animation:none!important}}
`.trim();

/** Ruta pública del logo (la copia scripts/build-corestack.mjs). */
export const RUTA_LOGO = '/corestack/logo.png';

/** Un `</script` dentro del código cerraría la etiqueta antes de tiempo. */
export function escaparScript(js: string): string {
  return js.replace(/<\/(script)/gi, '<\\/$1');
}

/** @font-face del título (Orbitron 800) con la fuente incrustada como data URI: cero peticiones extra. */
export function fuenteTitulo(woff2Base64: string): string {
  return `@font-face{font-family:'Orbitron';font-weight:800;font-display:block;src:url(data:font/woff2;base64,${woff2Base64}) format('woff2')}`;
}

export function construirPagina(scriptEfecto: string, woff2Base64 = ''): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#000000">
<title>Corestack</title>
<link rel="preload" as="image" href="${RUTA_LOGO}" fetchpriority="high">
<style>${woff2Base64 ? fuenteTitulo(woff2Base64) : ''}${CSS}</style>
</head>
<body>
<div class="escena" id="escena">
<canvas class="capa" id="rayos-fondo" aria-hidden="true"></canvas>
<div class="rejilla" aria-hidden="true"></div>
<div class="lineas" aria-hidden="true"></div>
<div class="pila">
<div class="logo-caja" data-rayos-oclusor style="--mascara:url(${RUTA_LOGO})">
<img class="logo" src="${RUTA_LOGO}" width="326" height="301" alt="Corestack" fetchpriority="high" decoding="async">
<div class="luz-logo" aria-hidden="true"></div>
</div>
<p class="titulo">Corestack Solutions</p>
</div>
<canvas class="capa capa-sobre" id="rayos-sobre" aria-hidden="true"></canvas>
</div>
<script>${escaparScript(scriptEfecto)}</script>
</body>
</html>
`;
}
