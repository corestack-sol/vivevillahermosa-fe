import { describe, it, expect } from 'vitest';
import { SERVICIOS_RENTA, SERVICIOS_MAP } from './servicios';

describe('SERVICIOS_RENTA / SERVICIOS_MAP', () => {
  it('every key is unique (no accidental duplicate service)', () => {
    const keys = SERVICIOS_RENTA.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('SERVICIOS_MAP has exactly one entry per SERVICIOS_RENTA item, keyed by `key`', () => {
    expect(SERVICIOS_MAP.size).toBe(SERVICIOS_RENTA.length);
    for (const s of SERVICIOS_RENTA) {
      expect(SERVICIOS_MAP.get(s.key)).toBe(s);
    }
  });
});
