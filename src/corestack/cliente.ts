// Arranque del efecto de /corestack en el navegador. Lo empaqueta esbuild
// (scripts/build-corestack.mjs) en un solo archivo que la página lleva incrustado:
// /corestack no es una página de React, así que no descarga nada del resto del sitio.
import { detectarNivel, iniciarRayosDeLuz, type EntornoEfecto, type Oclusor } from '../lib/rayosDeLuz';

const OCLUSOR: Oclusor = { selector: '[data-rayos-oclusor]', src: '/corestack/logo.webp' };

interface ConexionNavegador { saveData?: boolean; effectiveType?: string }

function leerEntorno(): EntornoEfecto {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: ConexionNavegador };
  return {
    memoriaGB: nav.deviceMemory,
    nucleos: nav.hardwareConcurrency,
    ahorroDeDatos: nav.connection?.saveData,
    conexion: nav.connection?.effectiveType,
    movil: window.matchMedia('(pointer: coarse)').matches,
    dpr: window.devicePixelRatio,
  };
}

/** Margen del canvas de detalle alrededor del logo, como fracción de su tamaño. */
const MARGEN_DETALLE = 0.6;

/** Coloca el canvas de detalle sobre el logo (el logo está centrado por CSS y su posición depende del título). */
function ubicarDetalle(detalle: HTMLCanvasElement, escena: HTMLElement) {
  const logo = document.querySelector('[data-rayos-oclusor]');
  if (!logo) return;
  const l = logo.getBoundingClientRect();
  const e = escena.getBoundingClientRect();
  const mx = l.width * MARGEN_DETALLE, my = l.height * MARGEN_DETALLE;
  detalle.style.left = `${l.left - e.left - mx}px`;
  detalle.style.top = `${l.top - e.top - my}px`;
  detalle.style.width = `${l.width + 2 * mx}px`;
  detalle.style.height = `${l.height + 2 * my}px`;
}

function arrancar() {
  const escena = document.getElementById('escena');
  const fondo = document.getElementById('rayos-fondo') as HTMLCanvasElement | null;
  const sobre = document.getElementById('rayos-sobre') as HTMLCanvasElement | null;
  const detalle = document.getElementById('rayos-detalle') as HTMLCanvasElement | null;
  if (!escena || !fondo || !sobre || !detalle) return;

  const respaldo = () => escena.classList.add('sin-efecto');
  const nivel = detectarNivel(leerEntorno());
  if (nivel === 'minimo') { respaldo(); return; }

  const estatico = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  ubicarDetalle(detalle, escena);
  window.addEventListener('resize', () => ubicarDetalle(detalle, escena));
  iniciarRayosDeLuz(fondo, { modo: 'fondo', estatico, oclusor: OCLUSOR, nivel, alFallar: respaldo });
  iniciarRayosDeLuz(sobre, { modo: 'sobre', estatico, oclusor: OCLUSOR, nivel });
  iniciarRayosDeLuz(detalle, { modo: 'detalle', estatico, oclusor: OCLUSOR, nivel });
}

// Después del primer pintado (el logo y el título ya se ven): el efecto arranca
// cuando el navegador está libre, con un tope para que no se retrase de más.
const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
if (w.requestIdleCallback) w.requestIdleCallback(arrancar, { timeout: 600 });
else setTimeout(arrancar, 200);
