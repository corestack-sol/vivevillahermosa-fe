'use client';

import { backendFetch, BackendApiError } from '@/lib/backendApi';

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

// El backend (BACKEND.md §8, OPENROUTER_TIMEOUT_MS en ia.constants.ts) ya
// tiene su propio timeout de 9s sobre la llamada a OpenRouter y siempre
// responde 200 con filtros vacíos/heurísticos si falla — este timeout del
// lado del cliente es una segunda capa de seguridad por si la red misma (no
// OpenRouter) es la que se cuelga. A diferencia de la implementación previa
// en Next.js (que podía encadenar hasta 3 llamadas más de resolución de
// colonia/landmark antes de responder), el backend resuelve colonias nuevas
// de forma asíncrona en segundo plano (no bloquea la respuesta) — el peor
// caso real es solo la llamada a OpenRouter, así que basta con un margen
// cómodo sobre esos 9s, no el margen de 22.5s que necesitaba el peor caso
// anterior.
const TIMEOUT_CLIENTE_MS = 12_000;

async function llamarBusquedaIA(query: string): Promise<{ ok: true; filtros: FiltrosIA } | { ok: false; status?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_CLIENTE_MS);
  try {
    const filtros = await backendFetch<FiltrosIA>('/ia/busqueda-inteligente', {
      method: 'POST',
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    return { ok: true, filtros };
  } catch (err) {
    return { ok: false, status: err instanceof BackendApiError ? err.status : undefined };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Interpreta una búsqueda en lenguaje natural llamando al backend
 * (`POST /ia/busqueda-inteligente`, BACKEND.md §8) y devuelve filtros
 * estructurados — así "algo tranquilo que no se inunde en Comalcalco" no
 * depende de que el título de alguna propiedad contenga esas palabras. Si la
 * IA no está disponible, falla, o tarda demasiado, devuelve un objeto vacío
 * — quien llama cae exactamente al comportamiento sin IA (coincidencia de
 * texto literal vía `q`, que para una oración completa casi siempre da cero
 * resultados — confirmado en vivo: una falla pasajera de red u OpenRouter en
 * el momento exacto de la búsqueda deja a la persona viendo "sin resultados"
 * sin ninguna pista de que en realidad fue la IA la que no respondió, no que
 * su búsqueda esté mal).
 *
 * **Un reintento automático** (2026-08-07) antes de rendirse — una sola
 * llamada fallida tirando toda la búsqueda a texto literal es un costo
 * demasiado alto para algo tan transitorio como un timeout de red. El
 * backend nunca responde `429` para esta ruta en particular (el límite de
 * tasa cae a la heurística en vez de rechazar, ver resiliencia en §8) — el
 * chequeo de `429` queda como defensa adicional por si eso cambia, pero en
 * la práctica cualquier falla real aquí es transitoria (red, timeout).
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
