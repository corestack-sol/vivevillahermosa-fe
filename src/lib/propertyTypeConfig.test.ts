import { describe, it, expect } from 'vitest';
import { getPropertyTypeConfig, PROPERTY_TYPE_CONFIG } from './propertyTypeConfig';

describe('getPropertyTypeConfig', () => {
  it('returns the correct config for each real property type', () => {
    expect(getPropertyTypeConfig('terreno').label).toBe('Terreno');
    expect(getPropertyTypeConfig('bodega').label).toBe('Bodega');
  });
  it('falls back to "casa" config for an unrecognized tipo instead of throwing/returning undefined', () => {
    const result = getPropertyTypeConfig('algo-que-no-existe');
    expect(result).toBe(PROPERTY_TYPE_CONFIG.casa);
  });
  it('every configured type has a non-empty label, labelPlural, and Icon', () => {
    for (const tipo of Object.keys(PROPERTY_TYPE_CONFIG)) {
      const cfg = PROPERTY_TYPE_CONFIG[tipo as keyof typeof PROPERTY_TYPE_CONFIG];
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.labelPlural.length).toBeGreaterThan(0);
      expect(cfg.Icon).toBeDefined();
    }
  });
});
