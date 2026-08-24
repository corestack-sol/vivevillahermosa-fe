import { describe, it, expect } from 'vitest';
import { estaEnTabasco, TABASCO_BOUNDS } from './tabascoBoundary';

describe('estaEnTabasco', () => {
  it('accepts Villahermosa (Centro), well inside the state', () => {
    expect(estaEnTabasco(17.9869, -92.9303)).toBe(true);
  });
  it('accepts Comalcalco, a municipality in the northwest of the state', () => {
    expect(estaEnTabasco(18.2766, -93.2145)).toBe(true);
  });
  it('accepts Tenosique, a municipality in the southeast of the state', () => {
    expect(estaEnTabasco(17.4743, -91.4241)).toBe(true);
  });
  it('rejects Mexico City, clearly outside Tabasco', () => {
    expect(estaEnTabasco(19.4326, -99.1332)).toBe(false);
  });
  it('rejects Mérida (Yucatán), a neighboring-region city outside Tabasco', () => {
    expect(estaEnTabasco(20.9674, -89.5926)).toBe(false);
  });
  it('rejects a point in the Gulf of Mexico just off the coast', () => {
    expect(estaEnTabasco(19.0, -92.0)).toBe(false);
  });
  it('rejects (0, 0), a degenerate/null-island input', () => {
    expect(estaEnTabasco(0, 0)).toBe(false);
  });
});

describe('TABASCO_BOUNDS', () => {
  it('is a valid [[southwest], [northeast]] box with south < north and west < east', () => {
    const [[southLat, westLng], [northLat, eastLng]] = TABASCO_BOUNDS;
    expect(southLat).toBeLessThan(northLat);
    expect(westLng).toBeLessThan(eastLng);
  });
  it('contains Villahermosa with margin to spare', () => {
    const [[southLat, westLng], [northLat, eastLng]] = TABASCO_BOUNDS;
    expect(17.9869).toBeGreaterThan(southLat);
    expect(17.9869).toBeLessThan(northLat);
    expect(-92.9303).toBeGreaterThan(westLng);
    expect(-92.9303).toBeLessThan(eastLng);
  });
});
