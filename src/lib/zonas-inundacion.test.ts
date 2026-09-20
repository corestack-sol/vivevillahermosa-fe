import { describe, it, expect } from 'vitest';
import { detectarRiesgoInundacion, riesgoPorCercania } from './zonas-inundacion';

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

  // Auditoría 2026-09-20: se extrajo el texto real de las 380 páginas del
  // Atlas (pdftotext -enc UTF-8 sobre el PDF real, no supuesto) y se
  // comparó cada una de las 88 zonas del catálogo. 64 (73%) están citadas
  // literalmente; 24 no aparecen en ningún lado (10 de ellas "alto") — el
  // nivel viene de inferir el riesgo del distrito completo, nunca de una
  // cita directa. `citadaEnAtlas` distingue ambos casos para que ni la UI
  // ni el backend afirmen "según el Atlas" para las 24.
  describe('citadaEnAtlas — distingue cita literal de inferencia por distrito', () => {
    it('una zona con el nombre citado literalmente en el Atlas es citadaEnAtlas: true', () => {
      expect(detectarRiesgoInundacion('Tabasco 2000', 'Centro')?.citadaEnAtlas).toBe(true);
      expect(detectarRiesgoInundacion('Casa Blanca', 'Centro')?.citadaEnAtlas).toBe(true);
      expect(detectarRiesgoInundacion('Gaviotas Sur', 'Centro')?.citadaEnAtlas).toBe(true);
    });

    it('una zona que el Atlas nunca nombra es citadaEnAtlas: false, aunque el catálogo le asigne un riesgo', () => {
      const r = detectarRiesgoInundacion('Valle Verde', 'Centro');
      expect(r?.riesgo).toBe('alto');
      expect(r?.citadaEnAtlas).toBe(false);
    });

    it('mismo caso para Gaviotas Norte — solo "Gaviotas Sur" aparece en el texto real, "Norte" no', () => {
      const r = detectarRiesgoInundacion('Gaviotas Norte', 'Centro');
      expect(r?.riesgo).toBe('alto');
      expect(r?.citadaEnAtlas).toBe(false);
    });
  });
});

describe('riesgoPorCercania — indicio por distancia real, nunca una cita', () => {
  it('nunca corre fuera de Centro', () => {
    expect(riesgoPorCercania('Casa Blanca', 'Cárdenas')).toBeNull();
    expect(riesgoPorCercania('Casa Blanca')).toBeNull();
  });

  it('sin coordenada verificada para la colonia buscada, no hay con qué medir distancia', () => {
    expect(riesgoPorCercania('Una colonia totalmente inventada xyz', 'Centro')).toBeNull();
  });

  it('encuentra una zona confirmada real dentro de 1km (caso real: Olmeca está a 0.39km de Atasta, riesgo medio)', () => {
    const r = riesgoPorCercania('Olmeca', 'Centro');
    expect(r?.riesgo).toBe('medio');
    expect(r?.coloniaReferencia.toLowerCase()).toContain('atasta');
    expect(r?.distanciaKm).toBeGreaterThan(0);
    expect(r?.distanciaKm).toBeLessThanOrEqual(1);
    // La referencia que usó SÍ está citada en el Atlas — nunca propaga una
    // de las 24 inferencias como si fuera más sólida por estar "cerca".
    expect(detectarRiesgoInundacion(r!.coloniaReferencia, 'Centro')?.citadaEnAtlas).toBe(true);
  });

  it('una zona ya detectada directamente no necesita cercanía (no es el caso de uso, pero no debe reventar)', () => {
    expect(() => riesgoPorCercania('Tabasco 2000', 'Centro')).not.toThrow();
  });
});
