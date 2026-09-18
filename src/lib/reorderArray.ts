/**
 * Mueve un elemento a una nueva posición, expresada como "antes de" o
 * "después de" otro elemento — pensado para arrastrar-y-soltar con
 * indicador de posición exacta (barra vertical entre dos tarjetas, ver
 * PublishForm.tsx, reordenar fotos). Extraído en vez de dejarlo inline
 * porque la aritmética de índices es fácil de equivocar (quitar el
 * elemento arrastrado corre los índices posteriores un lugar hacia
 * atrás) — con tests, no verificado solo a mano.
 *
 * `targetIdx`/`side` están en términos del arreglo ORIGINAL (antes de
 * quitar `from`), tal como se leen del elemento sobre el que se soltó.
 */
export function moverElemento<T>(arr: T[], from: number, targetIdx: number, side: 'before' | 'after'): T[] {
  if (from < 0 || from >= arr.length || targetIdx < 0 || targetIdx >= arr.length) return arr;
  const insertarAntesDeOriginal = side === 'before' ? targetIdx : targetIdx + 1;
  const item = arr[from];
  const resto = arr.filter((_, idx) => idx !== from);
  const insertarEn = insertarAntesDeOriginal > from ? insertarAntesDeOriginal - 1 : insertarAntesDeOriginal;
  if (insertarEn === from) return arr; // soltar justo donde ya estaba — sin cambio real
  const resultado = [...resto];
  resultado.splice(insertarEn, 0, item);
  return resultado;
}
