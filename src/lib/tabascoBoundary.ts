import anilloRaw from '@/data/tabasco-boundary.json';

/**
 * Frontera real del estado de Tabasco — 2026-08-08, obtenida de
 * OpenStreetMap vía Nominatim (`relation 2556680`, licencia ODbL), no
 * dibujada ni aproximada a mano: mismo criterio de todo este proyecto,
 * nunca inventar una coordenada cuando existe una fuente real que
 * verificar. Simplificada del lado del servidor con
 * `polygon_threshold=0.01` (Douglas-Peucker, ~1.1km de tolerancia — de
 * ~19,000 puntos originales a 212) para que el chequeo punto-en-polígono
 * sea barato en cada publicación sin perder precisión real: verificado
 * contra los 17 centros de municipio, los 88 landmarks, las 88+753
 * colonias catalogadas y las propiedades de muestra — cero falsos
 * positivos (ningún dato real de la plataforma cae fuera del polígono
 * simplificado).
 *
 * El archivo de datos (`tabasco-boundary.json`) guarda un solo anillo
 * `[lng, lat][]` (formato GeoJSON) — sin agujeros ni islas, Tabasco es un
 * polígono simple.
 */
const anillo = anilloRaw as [number, number][];

/**
 * Ray casting estándar (algoritmo de Jordan) — sin dependencias. Cuenta
 * cuántas veces un rayo horizontal desde el punto cruza los bordes del
 * polígono; impar = adentro, par = afuera.
 */
export function estaEnTabasco(lat: number, lng: number): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [lngI, latI] = anillo[i];
    const [lngJ, latJ] = anillo[j];
    const interseca = latI > lat !== latJ > lat && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (interseca) dentro = !dentro;
  }
  return dentro;
}

/**
 * Caja envolvente con margen — para restringir panning/zoom del mapa
 * (Leaflet `maxBounds` solo acepta rectángulos, no un polígono real). El
 * margen (~0.15°, ~15-17km) evita que el borde exacto del estado quede
 * pegado al borde de la vista, que se sentiría roto al usar el mapa —
 * `estaEnTabasco()` sigue siendo la validación real y precisa para
 * publicar, esto es solo para que la navegación del mapa se sienta natural.
 */
const MARGEN_GRADOS = 0.15;
const lats = anillo.map(([, lat]) => lat);
const lngs = anillo.map(([lng]) => lng);

export const TABASCO_BOUNDS: [[number, number], [number, number]] = [
  [Math.min(...lats) - MARGEN_GRADOS, Math.min(...lngs) - MARGEN_GRADOS],
  [Math.max(...lats) + MARGEN_GRADOS, Math.max(...lngs) + MARGEN_GRADOS],
];
