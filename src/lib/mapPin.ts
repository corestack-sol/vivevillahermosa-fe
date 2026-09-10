import type { Coords } from '@/components/forms/MapPicker';
import { distanciaKm } from './landmarks';
import { estaEnTabasco } from './tabascoBoundary';

/**
 * Radio máximo (km) que se puede mover el pin de una propiedad YA
 * publicada respecto a su ubicación original — pedido explícito
 * 2026-08-30: el pin sí se puede corregir después de publicar, pero
 * acotado (1km cubre "me equivoqué de cuadra", no "reubicar la propiedad
 * a otra colonia"). Ver dashboard/propiedades/[id]/editar/page.tsx.
 */
export const RADIO_MAXIMO_PIN_KM = 1;

/**
 * true si `candidato` sigue dentro del radio permitido desde `original`.
 * Sin `original` (propiedad nueva, sin punto de referencia todavía) o sin
 * `candidato`, siempre es válido — la restricción solo aplica al EDITAR
 * una propiedad ya publicada.
 */
export function dentroDeRadioPermitido(
  original: Coords | null,
  candidato: Coords,
  radioKm: number = RADIO_MAXIMO_PIN_KM,
): boolean {
  if (!original) return true;
  return distanciaKm(original.lat, original.lng, candidato.lat, candidato.lng) <= radioKm;
}

/**
 * Decide si el pin debe re-colocarse automáticamente en el centroide de la
 * colonia escrita en el formulario de publicar — bug real reportado
 * 2026-09-09: escribir una colonia que no coincidía con el pin no
 * indicaba ni corregía nada. Nunca pisa un pin puesto a mano ni uno
 * sugerido por GPS real de una foto (mismo criterio de "nunca sobreescribe
 * una elección real" que ya usa sugerirPinDesdeFoto en PublishForm.tsx) —
 * solo actúa mientras el pin actual siga siendo, él mismo, una sugerencia
 * automática por colonia (o no exista ninguno todavía).
 *
 * Devuelve las coordenadas nuevas a aplicar, o `null` si no debe cambiar
 * nada.
 */
export function coordsAutoDesdeColonia(params: {
  coordsActual: Coords | null;
  pinEsAutoColonia: boolean;
  coloniaVerificada: { lat: number; lng: number } | undefined;
}): Coords | null {
  const { coordsActual, pinEsAutoColonia, coloniaVerificada } = params;
  if (!coloniaVerificada) return null;
  if (coordsActual && !pinEsAutoColonia) return null;
  const nueva = { lat: coloniaVerificada.lat, lng: coloniaVerificada.lng };
  // El catálogo de colonias (colonias.ts) debería contener solo colonias
  // reales de Tabasco, pero MapPicker (que sí valida esto en cada clic/
  // arrastre) nunca interviene en esta ruta — se llama a setCoords()
  // directo. Mismo criterio de "nunca confiar" que ya aplica en el resto
  // de este flujo (ver onSubmit en PublishForm.tsx/editar/page.tsx):
  // nunca se ofrece una coordenada fuera de Tabasco, aunque en la práctica
  // el catálogo nunca debería producir una.
  if (!estaEnTabasco(nueva.lat, nueva.lng)) return null;
  if (coordsActual && coordsActual.lat === nueva.lat && coordsActual.lng === nueva.lng) return null;
  return nueva;
}
