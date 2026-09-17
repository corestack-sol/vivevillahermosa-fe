/**
 * Evita que una respuesta vieja sobrescriba una más nueva cuando dos
 * llamadas async para el mismo dato se solapan (ej. zoom in → zoom out
 * rápido en /mapa, cada uno dispara su propio fetch, y el de zoom in
 * puede tardar más y resolver DESPUÉS). Mismo patrón que ya existía sin
 * compartir en `evaluarSeqRef` (PublishForm.tsx) e `iaSeqRef`
 * (PropertiesClient.tsx) — extraído aquí para poder probarlo una sola vez.
 *
 * Uso:
 *   const guard = createRequestGuard();
 *   async function cargar() {
 *     const id = guard.start();
 *     const data = await fetchAlgo();
 *     if (!guard.isCurrent(id)) return; // ya hay una llamada más nueva
 *     aplicar(data);
 *   }
 */
export function createRequestGuard() {
  let seq = 0;
  return {
    /** Llamar ANTES de iniciar la llamada async — devuelve el id de esta llamada. */
    start(): number {
      return ++seq;
    },
    /** Llamar cuando la llamada async resuelve — false si ya hay una más nueva en curso o resuelta. */
    isCurrent(id: number): boolean {
      return id === seq;
    },
  };
}
