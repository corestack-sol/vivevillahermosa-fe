import { backendFetch } from './backendApi';

export type LandmarkCategoria = 'salud' | 'educacion' | 'comercial' | 'transporte' | 'cultura' | 'centro';

export interface Landmark {
  key: string;
  label: string;
  categoria: LandmarkCategoria;
  lat: number;
  lng: number;
  /** Qué tan lejos todavía cuenta como "cerca de" este lugar. */
  radioKm: number;
  /**
   * Formas cortas/coloquiales por las que la gente también nombra el lugar
   * (ej. "Hospital Ángeles" en vez de "Hospital Ángeles Villahermosa") — se
   * revisan además del label completo al hacer coincidencia de texto. Sin
   * esto, alguien que omite la palabra final del nombre oficial (algo muy
   * común) no obtenía ningún match, ni por heurística ni como red de
   * seguridad de la IA.
   */
  aliases?: string[];
}

/**
 * Fecha en que se investigó y verificó por última vez el catálogo que este
 * frontend mantenía a mano, antes de la migración de abajo. Se conserva como
 * referencia histórica — la fuente de verdad real ahora es el backend (ver
 * `obtenerLandmarksBackend` más abajo), que controla su propia frescura.
 */
export const LANDMARKS_VERIFICADO_EN = '2026-08-07';

/**
 * Catálogo de landmarks — migrado al backend real 2026-08-17
 * (`docs/message.txt`, reporte del equipo de backend; ver también
 * `docs/NUEVOS-LANDMARKS-TABASCO.md` para la investigación original de los
 * 30 landmarks nuevos). Antes de esto, `LANDMARKS` era un array hardcodeado
 * de 90 entradas mantenido a mano en este archivo — con el mismo problema
 * de fondo que ya se había resuelto para colonias (`colonias.ts`,
 * `precargarColoniasDescubiertas`/`obtenerColoniaDescubiertaBackend`): una
 * copia local que se desincroniza del catálogo real en cuanto alguien lo
 * actualiza de un solo lado.
 *
 * El backend ahora tiene 118 landmarks (88 originales + 30 nuevos, cada uno
 * con su fuente ya documentada) vía `GET /landmarks` — mismo shape
 * `{ key, label, categoria, lat, lng, radioKm, aliases? }` que este archivo
 * ya usaba, cache `public, max-age=300, stale-while-revalidate=3600` (igual
 * que `/colonias/descubiertas`). El historial completo de cómo se verificó
 * cada uno de los 90 originales (Nominatim, NotebookLM, búsqueda web, por
 * qué cada alias se eligió así — varias rondas de auditoría real, no
 * trivia) vive en `BACKEND.md §9.4` del repo del backend, y en el
 * historial de git de este archivo hasta este commit.
 *
 * Mismo patrón que colonias.ts:
 *  - `precargarLandmarks()` — cliente, fire-and-forget, cachea en memoria.
 *  - `obtenerLandmarksBackend()` — server-side, fetch directo y awaited
 *    (un Server Component no puede depender del cache de cliente, que
 *    nunca llega a poblarse ahí) — puebla el mismo cache compartido antes
 *    de devolver el array, así que las funciones de abajo (`getLandmark`,
 *    `landmarksPorCategoria`, `distanciaMinimaACategoria`) funcionan igual
 *    en ambos contextos con la misma firma: solo cambia cuándo/cómo se
 *    llenó el cache que leen.
 */
let landmarksCache: Landmark[] = [];
let cargaIniciada = false;

/**
 * Dispara la carga del catálogo una sola vez por sesión de navegador — igual
 * que `precargarColoniasDescubiertas`. Fire-and-forget: si falla o tarda,
 * `getLandmark`/`landmarksPorCategoria` simplemente se comportan como si el
 * catálogo estuviera vacío hasta que sí cargue, ninguna búsqueda se rompe ni
 * espera por esto.
 */
// Devuelve la promesa (antes era `void`) — `landmarksCache` es una
// variable de módulo, no estado de React, así que nada vuelve a renderizar
// solo porque este fetch resolvió. Quien necesite reaccionar cuando
// termine (ver PropertiesClient.tsx, bug real 2026-08-20: un filtro
// "cerca de X" podía correr antes de que esto cargara) puede engancharse
// a este promise; los llamados fire-and-forget existentes siguen
// funcionando igual, simplemente ignoran el valor de retorno.
export function precargarLandmarks(): Promise<void> {
  if (cargaIniciada || typeof window === 'undefined') return Promise.resolve();
  cargaIniciada = true;
  return backendFetch<Landmark[]>('/landmarks')
    .then((data) => { landmarksCache = data; })
    .catch(() => { /* silencioso — se sigue intentando en la próxima carga de página */ });
}

/**
 * Para Server Components (ver propiedades/[id]/page.tsx, zonas/[slug]/page.tsx)
 * — ahí `precargarLandmarks()` nunca llega a ejecutarse (guardada tras
 * `typeof window === 'undefined'`), así que se le pregunta al backend
 * directo, awaited, antes de usar `getLandmark`/`landmarksPorCategoria`/
 * `distanciaMinimaACategoria` en ese mismo request. `GET /landmarks` ya
 * trae `Cache-Control: public, max-age=300`, así que esto no golpea la
 * base de datos del backend en cada request de una ficha de propiedad.
 */
export async function obtenerLandmarksBackend(): Promise<Landmark[]> {
  try {
    const data = await backendFetch<Landmark[]>('/landmarks');
    landmarksCache = data;
    return data;
  } catch {
    return landmarksCache;
  }
}

export function getLandmark(key: string): Landmark | undefined {
  return landmarksCache.find((l) => l.key === key);
}

/** Distancia entre dos coordenadas en km (fórmula de Haversine). */
export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Solo categorías donde hay más de un punto catalogado tiene sentido preguntar
 *  "cerca de un/a ___" sin nombrar cuál — transporte/cultura en la práctica son
 *  un solo lugar de referencia (el aeropuerto, la laguna) y ya se resuelven como
 *  landmark específico por nombre. */
export const CATEGORIAS_GENERICAS: { value: 'salud' | 'educacion' | 'comercial'; label: string; keywords: string[] }[] = [
  { value: 'salud', label: 'un hospital', keywords: ['hospital', 'clínica', 'clinica', 'centro de salud'] },
  { value: 'educacion', label: 'una escuela o universidad', keywords: ['universidad', 'escuela', 'colegio', 'preparatoria', 'secundaria', 'tecnológico', 'tecnologico'] },
  { value: 'comercial', label: 'un centro comercial', keywords: ['centro comercial', 'plaza comercial', 'mall'] },
];

export function landmarksPorCategoria(categoria: string): Landmark[] {
  return landmarksCache.filter((l) => l.categoria === categoria);
}

/** Distancia al landmark más cercano de una categoría — null si no hay ninguno catalogado ahí. */
export function distanciaMinimaACategoria(lat: number, lng: number, categoria: string): number | null {
  const puntos = landmarksPorCategoria(categoria);
  if (puntos.length === 0) return null;
  return Math.min(...puntos.map((l) => distanciaKm(lat, lng, l.lat, l.lng)));
}

/** Radio por defecto de "cerca de un/a [categoría]" cuando no se nombra un lugar específico. */
export const RADIO_CATEGORIA_KM = 2.5;
