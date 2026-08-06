import type { FloodRisk } from '@/types/property';

/** Fuente única de verdad para el color/etiqueta de riesgo de inundación —
 * usado por PropertyCard (punto de color) y la tabla de comparar (fila
 * completa) para que ambos hablen el mismo lenguaje visual. */
export const FLOOD_COLOR: Record<FloodRisk, string> = {
  alto: '#EF4444', medio: '#F59E0B', bajo: '#10B981',
};

export const FLOOD_LABEL: Record<FloodRisk, string> = {
  alto: 'Riesgo alto de inundación', medio: 'Riesgo medio de inundación', bajo: 'Zona segura de inundación',
};
