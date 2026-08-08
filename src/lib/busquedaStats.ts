/**
 * Contadores en memoria de cómo se está resolviendo realmente
 * `/ia/busqueda-inteligente` — agregado 2026-08-08 junto con la caché
 * (busquedaCache.ts) y el aumento de timeouts, en respuesta a una
 * preocupación real: no hay ninguna cifra de tráfico real todavía (tráfico
 * concentrado en Centro + posible pico viral nacional), así que en vez de
 * calibrar límites a ciegas, esto le da al panel de admin (§ "IA de
 * búsqueda") una forma de ver, una vez que haya tráfico real, si la caché
 * de verdad está absorbiendo carga y qué tan seguido se está degradando a
 * la heurística — para ajustar el backstop global (route.ts) con datos, no
 * una suposición.
 *
 * Igual que rateLimit.ts/busquedaCache.ts: vive en memoria de un solo
 * proceso, se reinicia con el servidor — suficiente para `next start` en un
 * solo proceso, el backend nuevo debe replicar esto con algo compartido
 * entre instancias (mismo motivo ya documentado en docs/BACKEND.md §8).
 */
interface BusquedaStats {
  cacheHits: number;
  iaExitosa: number;
  heuristicaRespaldo: number;
}

// globalThis en vez de un simple `const` a nivel de módulo — mismo patrón
// que ya usa src/lib/db.ts para el cliente de Prisma. Confirmado en vivo
// (2026-08-08) que sin esto, en `next dev` los contadores se veían en
// `{}` desde una ruta API y no desde otra (`/ia/busqueda-inteligente` vs
// `/api/admin/metricas`) inmediatamente después de una búsqueda real:
// Next.js/Turbopack puede re-evaluar el módulo por separado según qué ruta
// lo importó, dando una instancia distinta de `stats`/`porHora` cada vez
// en vez de un singleton real — el mismo problema que ya obliga a Prisma a
// usar `globalThis`, aplicado aquí porque este módulo tiene el mismo
// patrón de estado a nivel de módulo.
const g = globalThis as unknown as { __busquedaStats?: BusquedaStats; __busquedaPorHora?: number[] };

const stats: BusquedaStats = g.__busquedaStats ?? { cacheHits: 0, iaExitosa: 0, heuristicaRespaldo: 0 };
g.__busquedaStats = stats;

// Búsquedas por hora del día (0-23), acumulado desde que arrancó el
// servidor — para encontrar horas pico (2026-08-08). Es la ÚNICA actividad
// de la plataforma con datos reales de uso hoy: las "vistas" que aparecen
// en otros lados (analiticaDemo.ts) son de muestra, no tráfico real,
// porque `Property` no es una tabla real todavía — mezclar ambas cosas
// presentaría un número inventado como si fuera medido. Zona horaria fija
// a Tabasco (America/Mexico_City), no la del servidor — un servidor en UTC
// (común en hosting) desfasaría "hora pico" 6 horas si no se corrige.
const porHora: number[] = g.__busquedaPorHora ?? new Array(24).fill(0);
g.__busquedaPorHora = porHora;

function horaEnTabasco(fecha: Date): number {
  const parte = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hour12: false })
    .formatToParts(fecha)
    .find((p) => p.type === 'hour');
  // Algunas implementaciones de Intl devuelven "24" para la medianoche en
  // vez de "0" — el módulo lo normaliza al rango 0-23.
  return parte ? parseInt(parte.value, 10) % 24 : fecha.getHours();
}

function registrarHora(): void {
  porHora[horaEnTabasco(new Date())]++;
}

export function registrarCacheHit(): void {
  stats.cacheHits++;
  registrarHora();
}

export function registrarIaExitosa(): void {
  stats.iaExitosa++;
  registrarHora();
}

export function registrarHeuristicaRespaldo(): void {
  stats.heuristicaRespaldo++;
  registrarHora();
}

export function getBusquedaStats() {
  const total = stats.cacheHits + stats.iaExitosa + stats.heuristicaRespaldo;
  const horaPico = total ? porHora.indexOf(Math.max(...porHora)) : null;
  return {
    ...stats,
    total,
    // Redondeado a 2 decimales — un panel de admin no necesita más precisión.
    tasaCacheHit: total ? Math.round((stats.cacheHits / total) * 10000) / 100 : 0,
    tasaDegradacion: total ? Math.round((stats.heuristicaRespaldo / total) * 10000) / 100 : 0,
    porHora,
    horaPico,
  };
}
