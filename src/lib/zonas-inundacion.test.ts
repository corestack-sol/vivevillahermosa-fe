import { describe, it, expect } from 'vitest';
import { detectarRiesgoInundacion } from './zonas-inundacion';

describe('detectarRiesgoInundacion', () => {
  it('returns null for text shorter than 4 characters (avoids matching on noise)', () => {
    expect(detectarRiesgoInundacion('ab')).toBeNull();
    expect(detectarRiesgoInundacion('')).toBeNull();
  });

  it('returns null when nothing in the catalog matches', () => {
    expect(detectarRiesgoInundacion('Una colonia totalmente inventada xyz')).toBeNull();
  });

  it('marks an exact normalized match as "confirmada"', () => {
    const result = detectarRiesgoInundacion('Tabasco 2000');
    expect(result?.confianza).toBe('confirmada');
    expect(result?.riesgo).toBe('bajo');
  });

  it('marks a substring/partial match as "probable"', () => {
    // "Fraccionamiento Tabasco 2000 Norte" contains "tabasco 2000" but isn't
    // an exact match to any single pattern.
    const result = detectarRiesgoInundacion('Fraccionamiento Tabasco 2000 Norte');
    expect(result?.confianza).toBe('probable');
  });

  it('is accent- and case-insensitive', () => {
    expect(detectarRiesgoInundacion('GAVIOTAS SUR')?.riesgo).toBe('alto');
    expect(detectarRiesgoInundacion('gaviótas sur')?.riesgo).toBe('alto');
  });

  it('respects the municipio filter — a zone scoped to Centro does not match under a different municipio', () => {
    // "casa blanca" is scoped to municipio: 'Centro'.
    expect(detectarRiesgoInundacion('Casa Blanca', 'Centro')?.riesgo).toBe('alto');
    expect(detectarRiesgoInundacion('Casa Blanca', 'Cárdenas')).toBeNull();
  });

  it('does not filter out a municipio-unscoped zone when a municipio is passed', () => {
    // "framboyanes" has no `municipio` field — should match regardless of
    // which municipio is passed in (it's ambiguous across municipios, see
    // colonias.ts findings, but THIS function has no such disambiguation).
    expect(detectarRiesgoInundacion('Framboyanes', 'Macuspana')?.riesgo).toBe('medio');
  });

  it('matches when no municipio is provided at all, even for a municipio-scoped zone', () => {
    // zona.municipio filter only excludes when a `municipio` arg IS passed
    // and doesn't match — omitting it entirely should not block scoped zones.
    expect(detectarRiesgoInundacion('Casa Blanca')?.riesgo).toBe('alto');
  });

  // Caso documentado explícitamente en el código fuente: el orden de los
  // patrones importa — una entrada específica ("Atasta de Serra", bajo)
  // debe ganarle a la genérica ("Atasta", medio) cuando el texto completo
  // coincide con la más específica.
  it('prefers a more specific pattern over a generic one when the specific one matches exactly', () => {
    expect(detectarRiesgoInundacion('Atasta de Serra')?.riesgo).toBe('bajo');
    expect(detectarRiesgoInundacion('Atasta')?.riesgo).toBe('medio');
  });

  it('same specific-vs-generic precedence holds for Tamulté', () => {
    expect(detectarRiesgoInundacion('Tamulté de las Barrancas')?.riesgo).toBe('bajo');
    expect(detectarRiesgoInundacion('Tamulté')?.riesgo).toBe('medio');
  });

  it('distinguishes "Pino Suárez" (medio, generic) from "José Ma. Pino Suárez" (alto, specific)', () => {
    expect(detectarRiesgoInundacion('Pino Suárez')?.riesgo).toBe('medio');
    expect(detectarRiesgoInundacion('José Ma. Pino Suárez')?.riesgo).toBe('alto');
  });
});
