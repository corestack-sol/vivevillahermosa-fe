import { describe, it, expect } from 'vitest';
import { detectarRiesgoInundacion } from './zonas-inundacion';

describe('detectarRiesgoInundacion', () => {
  it('returns null for text shorter than 4 characters (avoids matching on noise)', () => {
    expect(detectarRiesgoInundacion('ab', 'Centro')).toBeNull();
    expect(detectarRiesgoInundacion('', 'Centro')).toBeNull();
  });

  it('returns null when nothing in the catalog matches', () => {
    expect(detectarRiesgoInundacion('Una colonia totalmente inventada xyz', 'Centro')).toBeNull();
  });

  it('marks an exact normalized match as "confirmada"', () => {
    const result = detectarRiesgoInundacion('Tabasco 2000', 'Centro');
    expect(result?.confianza).toBe('confirmada');
    expect(result?.riesgo).toBe('bajo');
  });

  it('marks a substring/partial match as "probable"', () => {
    // "Fraccionamiento Tabasco 2000 Norte" contains "tabasco 2000" but isn't
    // an exact match to any single pattern.
    const result = detectarRiesgoInundacion('Fraccionamiento Tabasco 2000 Norte', 'Centro');
    expect(result?.confianza).toBe('probable');
  });

  it('is accent- and case-insensitive', () => {
    expect(detectarRiesgoInundacion('GAVIOTAS SUR', 'Centro')?.riesgo).toBe('alto');
    expect(detectarRiesgoInundacion('gaviótas sur', 'Centro')?.riesgo).toBe('alto');
  });

  // Bug real de integridad de datos (auditoría 2026-09-11): TODA la fuente
  // de este archivo es el Atlas de Riesgos del Municipio de Centro — nunca
  // cubrió otro municipio, aunque muchos nombres de colonia se repitan
  // (ej. "Framboyanes" existe también en Macuspana y Paraíso, con
  // hidrología totalmente distinta). Antes solo un subconjunto de patrones
  // llevaba `municipio: 'Centro'` explícito y el resto matcheaba sin
  // filtro — una propiedad fuera de Centro podía heredar un riesgo
  // calculado para una zona de Centro que ni siquiera existe ahí.
  it('never matches without an explicit municipio === "Centro"', () => {
    expect(detectarRiesgoInundacion('Casa Blanca')).toBeNull();
    expect(detectarRiesgoInundacion('Casa Blanca', 'Centro')?.riesgo).toBe('alto');
    expect(detectarRiesgoInundacion('Casa Blanca', 'Cárdenas')).toBeNull();
  });

  it('does not attribute a Centro-only zone to a homonym colonia in another municipio', () => {
    // "Framboyanes" no llevaba `municipio` explícito — matcheaba en
    // cualquier municipio antes del fix. Ahora nunca matchea fuera de Centro.
    expect(detectarRiesgoInundacion('Framboyanes', 'Macuspana')).toBeNull();
    expect(detectarRiesgoInundacion('Framboyanes', 'Paraíso')).toBeNull();
    expect(detectarRiesgoInundacion('Framboyanes', 'Centro')?.riesgo).toBe('medio');
  });

  // Caso documentado explícitamente en el código fuente: el orden de los
  // patrones importa — una entrada específica ("Atasta de Serra", bajo)
  // debe ganarle a la genérica ("Atasta", medio) cuando el texto completo
  // coincide con la más específica.
  it('prefers a more specific pattern over a generic one when the specific one matches exactly', () => {
    expect(detectarRiesgoInundacion('Atasta de Serra', 'Centro')?.riesgo).toBe('bajo');
    expect(detectarRiesgoInundacion('Atasta', 'Centro')?.riesgo).toBe('medio');
  });

  it('same specific-vs-generic precedence holds for Tamulté', () => {
    expect(detectarRiesgoInundacion('Tamulté de las Barrancas', 'Centro')?.riesgo).toBe('bajo');
    expect(detectarRiesgoInundacion('Tamulté', 'Centro')?.riesgo).toBe('medio');
  });

  it('distinguishes "Pino Suárez" (medio, generic) from "José Ma. Pino Suárez" (alto, specific)', () => {
    expect(detectarRiesgoInundacion('Pino Suárez', 'Centro')?.riesgo).toBe('medio');
    expect(detectarRiesgoInundacion('José Ma. Pino Suárez', 'Centro')?.riesgo).toBe('alto');
  });
});
