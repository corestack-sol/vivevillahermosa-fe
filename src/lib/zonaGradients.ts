// Gradientes de marca para tarjetas de colonia/zona — compartidos entre
// Home (src/app/page.tsx) y /zonas (src/app/zonas/page.tsx) para que las
// dos vistas hablen el mismo lenguaje visual sin quedar desincronizadas
// (antes cada archivo tenía su propia copia y se desviaron entre sí).
//
// Las 3 variantes usan EXACTAMENTE la misma fórmula (color-mix(color 55%,
// black) -> color base), nunca un token "-dark" prearmado — pedido
// explícito 2026-09-07: "la 3ra tiene más degradado que las otras,
// quiero que todas tengan el mismo nivel". Mezclar cada color base
// consigo mismo (55% color + 45% negro) en vez de partir de brand-dark/
// accent-dark (oscurecidos con proporciones distintas entre sí, nunca
// pensados para verse unos junto a otros) es lo único que garantiza el
// mismo contraste real entre extremos en las 3 tarjetas.
export const ZONA_GRADIENTS = [
  'linear-gradient(to bottom right, color-mix(in srgb, var(--color-brand) 55%, black), var(--color-brand))',
  'linear-gradient(to bottom right, color-mix(in srgb, var(--color-accent) 55%, black), var(--color-accent))',
  'linear-gradient(to bottom right, color-mix(in srgb, var(--color-coral) 55%, black), var(--color-coral))',
];
