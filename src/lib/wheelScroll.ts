/**
 * Un <input> de una sola línea nunca responde a la rueda del mouse/trackpad
 * de forma nativa en ningún navegador — solo mover el cursor lo hace
 * (reporte real 2026-08-31, ver src/components/ui/Input.tsx). Esta función
 * calcula el nuevo scrollLeft; el componente es quien lo asigna — así queda
 * 100% pura, sin tocar el DOM aquí, para poder probarla sin montar React.
 *
 * Solo desplaza cuando el texto de verdad desborda (`scrollWidth >
 * clientWidth`) — si cabe completo, la rueda no debe hacer nada.
 */
export function calcularScrollPorRueda(
  el: { scrollWidth: number; clientWidth: number; scrollLeft: number },
  deltaY: number,
  deltaX: number,
): number {
  if (el.scrollWidth <= el.clientWidth) return el.scrollLeft;
  return el.scrollLeft + (deltaY !== 0 ? deltaY : deltaX);
}
