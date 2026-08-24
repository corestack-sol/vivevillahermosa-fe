import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { distanciaKm, RADIO_CATEGORIA_KM, CATEGORIAS_GENERICAS } from './landmarks';

describe('distanciaKm (Haversine)', () => {
  it('returns 0 for identical points', () => {
    expect(distanciaKm(17.9869, -92.9303, 17.9869, -92.9303)).toBe(0);
  });
  it('matches a known real-world distance within reasonable tolerance', () => {
    // Villahermosa centro to Mexico City centro — real great-circle distance
    // is ~670km (verified against this same computation, not eyeballed).
    const d = distanciaKm(17.9869, -92.9303, 19.4326, -99.1332);
    expect(d).toBeGreaterThan(650);
    expect(d).toBeLessThan(690);
  });
  it('is symmetric — order of points does not matter', () => {
    const a = distanciaKm(17.9869, -92.9303, 18.0089, -92.9278);
    const b = distanciaKm(18.0089, -92.9278, 17.9869, -92.9303);
    expect(a).toBeCloseTo(b, 10);
  });
  it('returns a small, sane distance for two nearby points within Villahermosa', () => {
    // Two colonias roughly 2-3km apart in real life.
    const d = distanciaKm(17.9869, -92.9303, 18.0056, -92.9288);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(5);
  });
  it('handles antipodal-ish large distances without NaN (sqrt domain edge case)', () => {
    const d = distanciaKm(17.9869, -92.9303, -17.9869, 87.0697);
    expect(Number.isNaN(d)).toBe(false);
    expect(d).toBeGreaterThan(19000); // close to half of Earth's circumference
  });
});

describe('CATEGORIAS_GENERICAS / RADIO_CATEGORIA_KM', () => {
  it('has a sane positive default radius', () => {
    expect(RADIO_CATEGORIA_KM).toBeGreaterThan(0);
  });
  it('each generic category has at least one keyword', () => {
    for (const cat of CATEGORIAS_GENERICAS) {
      expect(cat.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe('landmarksCache-backed functions (module-level cache, isolated per test)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getLandmark/landmarksPorCategoria/distanciaMinimaACategoria behave correctly against an empty cache', async () => {
    const { getLandmark, landmarksPorCategoria, distanciaMinimaACategoria } = await import('./landmarks');
    expect(getLandmark('hospital-rovirosa')).toBeUndefined();
    expect(landmarksPorCategoria('salud')).toEqual([]);
    expect(distanciaMinimaACategoria(17.9869, -92.9303, 'salud')).toBeNull();
  });

  it('obtenerLandmarksBackend populates the shared cache used by getLandmark/landmarksPorCategoria', async () => {
    const fake = [
      { key: 'hospital-rovirosa', label: 'Hospital Rovirosa', categoria: 'salud', lat: 17.99, lng: -92.93, radioKm: 1 },
      { key: 'ujat', label: 'UJAT', categoria: 'educacion', lat: 17.98, lng: -92.92, radioKm: 1 },
    ];
    vi.doMock('@/lib/backendApi', () => ({ backendFetch: vi.fn().mockResolvedValue(fake) }));
    // landmarks.ts imports './backendApi' (relative), not '@/lib/backendApi'
    // — mock both specifiers so it resolves regardless of which one Vitest
    // ends up matching against the module graph.
    vi.doMock('./backendApi', () => ({ backendFetch: vi.fn().mockResolvedValue(fake) }));

    const { obtenerLandmarksBackend, getLandmark, landmarksPorCategoria, distanciaMinimaACategoria } = await import('./landmarks');
    const result = await obtenerLandmarksBackend();
    expect(result).toEqual(fake);
    expect(getLandmark('hospital-rovirosa')?.label).toBe('Hospital Rovirosa');
    expect(landmarksPorCategoria('salud')).toHaveLength(1);
    expect(distanciaMinimaACategoria(17.9869, -92.9303, 'salud')).not.toBeNull();
  });

  it('obtenerLandmarksBackend falls back to the last known cache on a fetch failure, instead of throwing', async () => {
    vi.doMock('./backendApi', () => ({ backendFetch: vi.fn().mockRejectedValue(new Error('network down')) }));
    const { obtenerLandmarksBackend } = await import('./landmarks');
    const result = await obtenerLandmarksBackend();
    expect(result).toEqual([]); // empty cache, but no throw
  });

  it('precargarLandmarks resolves without fetching when window is undefined (SSR/server context)', async () => {
    const mockFetch = vi.fn();
    vi.doMock('./backendApi', () => ({ backendFetch: mockFetch }));
    const { precargarLandmarks } = await import('./landmarks');
    await precargarLandmarks();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
