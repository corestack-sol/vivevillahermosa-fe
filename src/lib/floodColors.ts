import type { FloodRisk } from '@/types/property';

/** Fuente única de verdad para el color/etiqueta de riesgo de inundación —
 * usado por PropertyCard (punto de color) y la tabla de comparar (fila
 * completa) para que ambos hablen el mismo lenguaje visual. */
export const FLOOD_COLOR: Record<FloodRisk, string> = {
  alto: '#EF4444', medio: '#F59E0B', bajo: '#10B981',
  // Gris cálido (gray-400): "no sabemos" no es una alerta ni una garantía, no lleva color de semáforo.
  sin_dato: '#A5957A',
};

// "Riesgo alto/medio de inundación" sonaba a que la plataforma está
// pronosticando algo — el dato real es un registro histórico (Atlas de
// Riesgos del Municipio de Centro, 2023, ver TermsModal.tsx), no una
// predicción. Reformulado como hecho documentado, no como juicio.
export const FLOOD_LABEL: Record<FloodRisk, string> = {
  alto: 'Históricamente inundable', medio: 'Inundaciones menores ocasionales', bajo: 'Bajo historial de inundaciones',
  sin_dato: 'Sin información de riesgo de inundación',
};

const NIVELES_CONOCIDOS: readonly FloodRisk[] = ['alto', 'medio', 'bajo', 'sin_dato'];

/**
 * Cualquier valor de riesgo que el backend mande y este código no conozca
 * (un cuarto/quinto nivel futuro, `null`, texto raro) se trata como
 * `sin_dato` en el punto de entrada, en vez de dejar que rompa una ficha
 * entera — 2026-09-23 el backend sembró propiedades con `sin_dato` antes de
 * que el front lo conociera y toda su ficha dio "No pudimos cargar esta
 * página". Mostrar "sin información" es siempre más seguro que inventar un
 * nivel o tronar.
 */
export function normalizarRiesgo(valor: unknown): FloodRisk {
  return NIVELES_CONOCIDOS.includes(valor as FloodRisk) ? (valor as FloodRisk) : 'sin_dato';
}
