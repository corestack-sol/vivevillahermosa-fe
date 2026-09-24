/**
 * Pines del mapa de /propiedades: TODO lo que cumple los filtros, no solo la
 * página visible del listado.
 *
 * Reporte 2026-09-23: sin filtros el mapa mostraba 12 pines aunque hay 31
 * propiedades. Desde que la paginación del 21-sep dejó de traer el catálogo
 * completo, el mapa usaba `results` (la página cargada, 12 en 12). El
 * listado sigue paginado; el mapa pide aparte lo que le falta, de a 100
 * (máximo que acepta el backend: "limit must not be greater than 100") y con
 * tope de páginas para no descargar el catálogo entero a gran escala.
 */

export const LIMITE_POR_PAGINA_MAPA = 100;
export const MAX_PAGINAS_MAPA = 5;

export interface ConId { id: string }

export async function reunirMarcadores<T extends ConId>({
  total,
  primeraPagina,
  pedirPagina,
  limite = LIMITE_POR_PAGINA_MAPA,
  maxPaginas = MAX_PAGINAS_MAPA,
}: {
  /** Total real que cumple los filtros (lo dice el servidor). */
  total: number;
  /** Lo que el listado ya tiene: si alcanza, no se pide nada más. */
  primeraPagina: T[];
  /** Pide la página `pagina` (1-based) de `limite` elementos. */
  pedirPagina: (pagina: number, limite: number) => Promise<T[]>;
  limite?: number;
  maxPaginas?: number;
}): Promise<T[]> {
  if (total <= primeraPagina.length) return primeraPagina;

  const paginas = Math.min(Math.ceil(total / limite), maxPaginas);
  const porId = new Map<string, T>();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    const lote = await pedirPagina(pagina, limite);
    for (const p of lote) porId.set(p.id, p);
    if (lote.length < limite) break; // ya no hay más
  }
  return porId.size > 0 ? [...porId.values()] : primeraPagina;
}
