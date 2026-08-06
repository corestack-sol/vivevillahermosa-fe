'use client';

export interface FiltrosIA {
  municipio?: string;
  colonia?: string;
  tipo?: string;
  operacion?: string;
  precioMin?: number;
  precioMax?: number;
  recamaras?: number;
  cercaDosoBocas?: boolean;
  riesgoInundacion?: string;
  landmark?: string;
  categoriaLandmark?: string;
}

// El servidor ya tiene su propio timeout sobre la llamada a OpenRouter
// (TIMEOUT_BUSQUEDA_MS en src/lib/ai.ts, 7s) y siempre responde 200 con
// filtros vacíos si falla — este timeout del lado del cliente es una
// segunda capa de seguridad por si la red misma (no OpenRouter) es la que
// se cuelga. Debe quedar arriba del PEOR caso del servidor, no solo del
// típico: cuando ni colonia ni landmark coinciden con el catálogo, el
// servidor puede encadenar hasta 3 llamadas de resolución más
// (TIMEOUT_RESOLUCION_MS, 4.5s cada una) antes de rendirse — un caso raro
// (la mayoría de las búsquedas responden en 2-4s totales), pero si pasa,
// este timeout no debe cortar al servidor a medio intentar resolver bien.
const TIMEOUT_CLIENTE_MS = 21_000;

/**
 * Interpreta una búsqueda en lenguaje natural con OpenRouter (src/lib/ai.ts) y
 * devuelve filtros estructurados — así "algo tranquilo que no se inunde en
 * Comalcalco" no depende de que el título de alguna propiedad contenga esas
 * palabras. Si la IA no está disponible, falla, o tarda demasiado, devuelve
 * un objeto vacío — quien llama cae exactamente al comportamiento sin IA
 * (coincidencia de texto literal vía `q`).
 *
 * Compartido entre SearchBar.tsx (búsqueda desde Home, navega a resultados
 * nuevos) y PropertiesClient.tsx (búsqueda dentro de /propiedades, aplica
 * sobre los filtros ya activos) — misma llamada, cada quien decide qué
 * hacer con el resultado.
 */
export async function interpretarBusqueda(query: string): Promise<FiltrosIA> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_CLIENTE_MS);
  try {
    const res = await fetch('/api/ia/busqueda-inteligente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}
