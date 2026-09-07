// Gradientes de marca para tarjetas de colonia/zona — compartidos entre
// Home (src/app/page.tsx) y /zonas (src/app/zonas/page.tsx) para que las
// dos vistas hablen el mismo lenguaje visual sin quedar desincronizadas
// (antes cada archivo tenía su propia copia y se desviaron entre sí).
//
// El primero (marca) necesita color-mix() para oscurecer un extremo —
// bug real reportado 2026-09-07: `brand-dark` y `brand` solos quedan
// demasiado cerca en luminancia (dos verdes oscuros), así que el
// degradado se veía como un color sólido plano, sobre todo bajo el
// overlay bg-black/10-20 que llevan estas tarjetas encima. Los otros dos
// (accent, coral) ya tenían suficiente contraste — coral usa el mismo
// truco de color-mix() por el mismo motivo.
export const ZONA_GRADIENTS = [
  'linear-gradient(to bottom right, color-mix(in srgb, var(--color-brand-dark) 55%, black), var(--color-brand))',
  'linear-gradient(to bottom right, var(--color-accent-dark), var(--color-accent))',
  'linear-gradient(to bottom right, color-mix(in srgb, var(--color-coral) 55%, black), var(--color-coral))',
];
