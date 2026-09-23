/**
 * Texto de "fuente" que la ficha muestra bajo el nivel de inundación.
 * Regla simple (pedido 2026-09-23):
 *  - el nivel se detectó contra el Atlas (`fuente: 'atlas'`, lo decide el
 *    backend) → se cita el Atlas;
 *  - la colonia no aparece en el Atlas → el nivel lo ajustó quien publicó.
 */
import type { FloodRisk } from '@/types/property';

export interface EntradaFuenteRiesgo {
  nivel: FloodRisk;
  fuente?: 'atlas' | 'propietario';
  municipio?: string;
}

export function explicarFuenteRiesgo({ nivel, fuente, municipio }: EntradaFuenteRiesgo): string {
  if (nivel === 'sin_dato') {
    return 'Esta propiedad no tiene un nivel de inundación registrado. Si la decisión es importante, pregunta a quien publica y visita la zona en temporada de lluvias.';
  }
  if (fuente === 'atlas') {
    return 'Según el Atlas de Riesgos del Municipio de Centro, 2023. Ayuntamiento de Centro. P 377.';
  }
  if (municipio && municipio !== 'Centro') {
    return 'Nivel indicado por quien publicó la propiedad. En este municipio no existe un atlas de riesgos que lo verifique.';
  }
  return 'Nivel ajustado por quien publicó la propiedad: esta colonia no aparece en el Atlas de Riesgos Municipal.';
}
