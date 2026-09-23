/**
 * Memoriza el resultado de una llamada asíncrona por `ttlMs` (y comparte la
 * llamada en vuelo). Un rechazo NO se guarda: el siguiente intento vuelve a
 * salir a la red. Reporte 2026-09-23 (demasiadas peticiones): el formulario
 * de publicar descargaba el catálogo completo en cada pausa al escribir el
 * teléfono.
 */
export function memoConTtl<T>(fn: () => Promise<T>, ttlMs: number, ahora: () => number = () => Date.now()): () => Promise<T> {
  let guardado: { hasta: number; valor: Promise<T> } | null = null;
  return () => {
    if (guardado && ahora() < guardado.hasta) return guardado.valor;
    const valor = fn();
    const entrada = { hasta: ahora() + ttlMs, valor };
    guardado = entrada;
    valor.catch(() => { if (guardado === entrada) guardado = null; });
    return valor;
  };
}
