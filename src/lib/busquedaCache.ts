import type { ResultadoBusqueda } from './ai';

/**
 * Caché en memoria de interpretaciones de búsqueda ya resueltas por
 * OpenRouter — agregado 2026-08-08 en respuesta a una preocupación real de
 * escala: con miles de búsquedas al día y horas pico, una prueba de carga
 * concurrente (40 solicitudes simultáneas) mostró que la latencia promedio
 * de OpenRouter se TRIPLICA bajo concurrencia (2.5s → 5.8s, máximo tocando
 * el timeout de 9s) — el cuello de botella real es OpenRouter, no este
 * servidor, así que la forma más directa de aguantar más tráfico es hacer
 * menos llamadas reales, no solo esperar más tiempo por cada una.
 *
 * Muchas búsquedas reales son texto idéntico o casi idéntico ("casa en
 * renta", "depa en Cárdenas") — cachear la interpretación (los filtros
 * estructurados) es seguro porque esa interpretación es esencialmente
 * estable: "casa en renta en Cárdenas" significa lo mismo hoy que en una
 * hora. Lo único que podría cambiar su significado es que se agregue un
 * landmark/colonia/zona nueva al catálogo (trabajo mío, no algo que pase
 * seguido) — por eso el TTL es de 1 hora, no permanente.
 *
 * Solo se cachean resultados que sí vinieron de una llamada real y exitosa
 * a OpenRouter — nunca resultados heurísticos (más pobres, se "congelarían"
 * con esa calidad menor hasta que expire el TTL aunque OpenRouter ya se
 * hubiera recuperado) ni resultados de un intento de inyección (esos ni
 * siquiera llegan a este módulo, se resuelven antes vía la heurística).
 */
const TTL_MS = 60 * 60 * 1000;

interface EntradaCache {
  resultado: ResultadoBusqueda;
  expiraEn: number;
}

// globalThis en vez de un simple `const` a nivel de módulo — mismo patrón
// que ya usa src/lib/db.ts para Prisma, y el mismo motivo que ahora también
// usa busquedaStats.ts: confirmado en vivo que en `next dev` este módulo se
// puede re-evaluar por separado según qué ruta API lo importó, dando una
// instancia de `Map` distinta cada vez en vez de un singleton real — la
// caché parecía vacía desde una ruta aunque otra ruta ya hubiera guardado
// algo un segundo antes.
const g = globalThis as unknown as { __busquedaCache?: Map<string, EntradaCache> };
const cache = g.__busquedaCache ?? new Map<string, EntradaCache>();
g.__busquedaCache = cache;

// Mismo patrón que src/lib/rateLimit.ts — evita que el Map crezca sin
// límite en un proceso de larga duración.
function sweep(now: number) {
  if (cache.size < 5000) return;
  for (const [key, entrada] of cache) {
    if (entrada.expiraEn <= now) cache.delete(key);
  }
}

// Copiado en vez de importado de ai.ts (que ya tiene el mismo helper) para
// no crear una dependencia circular en tiempo de ejecución entre los dos
// módulos — ai.ts importa de aquí, así que aquí no se importa nada de
// vuelta que no sea el tipo (import type, que se borra al compilar).
function quitarAcentos(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

// Sin quitar acentos, "Cárdenas" y "Cardenas" (variación real y común de
// cómo la gente escribe) contaban como dos búsquedas distintas — cache miss
// innecesario, confirmado en pruebas reales.
function normalizarQuery(query: string): string {
  return quitarAcentos(query.trim().toLowerCase()).replace(/\s+/g, ' ');
}

export function getBusquedaCache(query: string): ResultadoBusqueda | undefined {
  const entrada = cache.get(normalizarQuery(query));
  if (!entrada || entrada.expiraEn <= Date.now()) return undefined;
  return entrada.resultado;
}

export function setBusquedaCache(query: string, resultado: ResultadoBusqueda): void {
  const now = Date.now();
  sweep(now);
  cache.set(normalizarQuery(query), { resultado, expiraEn: now + TTL_MS });
}
