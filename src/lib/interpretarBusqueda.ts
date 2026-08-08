'use client';

export interface FiltrosIA {
  municipio?: string;
  colonia?: string;
  tipo?: string;
  operacion?: string;
  precioMin?: number;
  precioMax?: number;
  recamaras?: number;
  recamarasMax?: number;
  banos?: number;
  m2Min?: number;
  m2Max?: number;
  amenidad?: string;
  cercaDosoBocas?: boolean;
  riesgoInundacion?: string;
  landmark?: string;
  categoriaLandmark?: string;
  zonaDestacada?: string;
  sort?: string;
  limite?: number;
}

// El servidor ya tiene su propio timeout sobre la llamada a OpenRouter
// (TIMEOUT_BUSQUEDA_MS en src/lib/ai.ts, 9s desde 2026-08-08) y siempre
// responde 200 con filtros vacíos/heurísticos si falla — este timeout del
// lado del cliente es una segunda capa de seguridad por si la red misma (no
// OpenRouter) es la que se cuelga. Debe quedar arriba del PEOR caso del
// servidor, no solo del típico: cuando ni colonia ni landmark coinciden con
// el catálogo, el servidor puede encadenar hasta 3 llamadas de resolución
// más (TIMEOUT_RESOLUCION_MS, 4.5s cada una) antes de rendirse — un caso
// raro (la mayoría de las búsquedas responden en 1-3s totales), pero si
// pasa, este timeout no debe cortar al servidor a medio intentar resolver
// bien. Peor caso teórico: 9s + 3×4.5s = 22.5s — subido junto con
// TIMEOUT_BUSQUEDA_MS para mantener el mismo margen real sobre red, no solo
// "un poco más" que el nuevo peor caso del servidor.
const TIMEOUT_CLIENTE_MS = 25_000;

async function llamarBusquedaIA(query: string): Promise<{ ok: true; filtros: FiltrosIA } | { ok: false; status?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_CLIENTE_MS);
  try {
    const res = await fetch('/api/ia/busqueda-inteligente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, filtros: await res.json() };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Interpreta una búsqueda en lenguaje natural con OpenRouter (src/lib/ai.ts) y
 * devuelve filtros estructurados — así "algo tranquilo que no se inunde en
 * Comalcalco" no depende de que el título de alguna propiedad contenga esas
 * palabras. Si la IA no está disponible, falla, o tarda demasiado, devuelve
 * un objeto vacío — quien llama cae exactamente al comportamiento sin IA
 * (coincidencia de texto literal vía `q`, que para una oración completa casi
 * siempre da cero resultados — confirmado en vivo: una falla pasajera de red
 * u OpenRouter en el momento exacto de la búsqueda deja a la persona viendo
 * "sin resultados" sin ninguna pista de que en realidad fue la IA la que no
 * respondió, no que su búsqueda esté mal).
 *
 * **Un reintento automático** (2026-08-07) antes de rendirse — una sola
 * llamada fallida tirando toda la búsqueda a texto literal es un costo
 * demasiado alto para algo tan transitorio como un timeout de red. No
 * reintenta si el servidor respondió `429` (límite de tasa) — eso no es
 * transitorio, reintentar de inmediato solo empeora el mismo límite.
 *
 * Compartido entre SearchBar.tsx (búsqueda desde Home, navega a resultados
 * nuevos) y PropertiesClient.tsx (búsqueda dentro de /propiedades, aplica
 * sobre los filtros ya activos) — misma llamada, cada quien decide qué
 * hacer con el resultado.
 */
export async function interpretarBusqueda(query: string): Promise<FiltrosIA> {
  const primero = await llamarBusquedaIA(query);
  if (primero.ok) return primero.filtros;
  if (primero.status === 429) return {};

  await new Promise((resolve) => setTimeout(resolve, 400));
  const segundo = await llamarBusquedaIA(query);
  return segundo.ok ? segundo.filtros : {};
}

/**
 * Una oración de 5+ palabras casi nunca coincide tal cual con el texto de
 * una propiedad — `applyFilters` (filters.ts) compara `q` como texto
 * literal contra título/colonia/municipio/descripción, así que dejarla ahí
 * después de que `interpretarBusqueda` no encontró nada que extraer (objeto
 * vacío, ya sea porque de verdad no había un lugar/tipo concreto que pedir,
 * o porque la IA no respondió) garantiza cero resultados — se veía como "la
 * IA nunca encuentra nada" cuando en realidad no había nada concreto que
 * buscar. Compartido entre SearchBar.tsx y PropertiesClient.tsx: ambos
 * deciden, con este mismo umbral, si vale la pena aplicar `q` como texto
 * literal (términos cortos como "Reforma" sí pueden matchear de verdad) o
 * si es mejor no aplicar ningún filtro y mostrar todo.
 */
export function esOracionLarga(texto: string): boolean {
  return texto.trim().split(/\s+/).filter(Boolean).length >= 5;
}
