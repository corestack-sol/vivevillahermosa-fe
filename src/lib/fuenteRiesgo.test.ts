import { describe, it, expect } from 'vitest';
import { explicarFuenteRiesgo } from './fuenteRiesgo';

describe('explicarFuenteRiesgo', () => {
  it('detectado contra el Atlas: cita el Atlas con su página', () => {
    const t = explicarFuenteRiesgo({ nivel: 'medio', fuente: 'atlas', municipio: 'Centro' });
    expect(t).toMatch(/Atlas de Riesgos del Municipio de Centro, 2023.*P 377/);
  });

  // Caso del reporte 2026-09-23 (Gaviotas Sur Sector San José): la colonia no
  // aparece en el Atlas → el mensaje es que el propietario ajustó el nivel,
  // nunca "no podemos detectar" ni una cita del Atlas.
  it('colonia que no aparece en el Atlas: el propietario ajustó el nivel, sin citar el Atlas', () => {
    const t = explicarFuenteRiesgo({ nivel: 'alto', fuente: 'propietario', municipio: 'Centro' });
    expect(t).toMatch(/ajustado por quien publicó/i);
    expect(t).toMatch(/no aparece en el Atlas/);
    expect(t).not.toMatch(/P 377|Según el Atlas/);
  });

  it('propiedad sin campo de fuente en Centro: mismo mensaje que "no aparece en el Atlas"', () => {
    expect(explicarFuenteRiesgo({ nivel: 'bajo', municipio: 'Centro' })).toMatch(/ajustado por quien publicó/i);
  });

  it('fuera de Centro no existe atlas', () => {
    expect(explicarFuenteRiesgo({ nivel: 'bajo', fuente: 'propietario', municipio: 'Cárdenas' })).toMatch(/no existe un atlas/);
  });

  it('sin_dato no afirma nada sobre el Atlas', () => {
    expect(explicarFuenteRiesgo({ nivel: 'sin_dato', fuente: 'propietario', municipio: 'Centro' })).toMatch(/no tiene un nivel de inundación registrado/);
  });

  it('los mensajes de Atlas y de propietario son distintos', () => {
    const a = explicarFuenteRiesgo({ nivel: 'alto', fuente: 'atlas', municipio: 'Centro' });
    const p = explicarFuenteRiesgo({ nivel: 'alto', fuente: 'propietario', municipio: 'Centro' });
    expect(a).not.toBe(p);
  });
});
