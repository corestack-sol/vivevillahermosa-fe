// Evento en `window` en vez de un pub-sub por módulo — quien dispara el
// inicio (onRouterTransitionStart en instrumentation-client.ts) y quien
// escucha (TopProgressBar.tsx) pueden terminar en chunks distintos con
// Turbopack, cada uno con su propia instancia del módulo si fuera un
// array de listeners en memoria. `window` es el mismo objeto sin importar
// el chunk, así que el evento siempre llega.
const START_EVENT = 'vv:top-progress-start';

export function startTopProgress() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(START_EVENT));
}

export function onTopProgressStart(cb: () => void): () => void {
  window.addEventListener(START_EVENT, cb);
  return () => window.removeEventListener(START_EVENT, cb);
}
