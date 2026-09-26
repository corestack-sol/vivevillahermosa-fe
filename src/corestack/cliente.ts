// Arranque del efecto de /corestack en el navegador. Lo empaqueta esbuild
// (scripts/build-corestack.mjs) en un solo archivo que la página lleva incrustado:
// /corestack no es una página de React, así que no descarga nada del resto del sitio.
import { detectarNivel, iniciarRayosDeLuz, type EntornoEfecto, type Oclusor } from '../lib/rayosDeLuz';

const OCLUSOR: Oclusor = { selector: '[data-rayos-oclusor]', src: '/corestack/logo.png' };

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

function arrancar() {
  const escena = document.getElementById('escena');
  const fondo = document.getElementById('rayos-fondo') as HTMLCanvasElement | null;
  const sobre = document.getElementById('rayos-sobre') as HTMLCanvasElement | null;
  if (!escena || !fondo || !sobre) return;

  const respaldo = () => escena.classList.add('sin-efecto');
  const nivel = detectarNivel(leerEntorno());
  if (nivel === 'minimo') { respaldo(); return; }

  const estatico = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  iniciarRayosDeLuz(fondo, { modo: 'fondo', estatico, oclusor: OCLUSOR, nivel, alFallar: respaldo });
  iniciarRayosDeLuz(sobre, { modo: 'sobre', estatico, oclusor: OCLUSOR, nivel });
}

// Después del primer pintado (el logo y el título ya se ven): el efecto arranca
// cuando el navegador está libre, con un tope para que no se retrase de más.
const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
if (w.requestIdleCallback) w.requestIdleCallback(arrancar, { timeout: 600 });
else setTimeout(arrancar, 200);
