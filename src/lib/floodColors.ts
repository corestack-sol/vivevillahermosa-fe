import type { FloodRisk } from '@/types/property';

/** Fuente única de verdad para el color/etiqueta de riesgo de inundación —
 * usado por PropertyCard (punto de color) y la tabla de comparar (fila
 * completa) para que ambos hablen el mismo lenguaje visual. */
export const FLOOD_COLOR: Record<FloodRisk, string> = {
  alto: '#EF4444', medio: '#F59E0B', bajo: '#10B981',
};

// "Riesgo alto/medio de inundación" sonaba a que la plataforma está
// pronosticando algo — el dato real es un registro histórico (Atlas de
// Riesgos del Municipio de Centro, 2023, ver TermsModal.tsx), no una
// predicción. Reformulado como hecho documentado, no como juicio.
export const FLOOD_LABEL: Record<FloodRisk, string> = {
  alto: 'Históricamente inundable', medio: 'Inundaciones menores ocasionales', bajo: 'Bajo historial de inundaciones',
};
