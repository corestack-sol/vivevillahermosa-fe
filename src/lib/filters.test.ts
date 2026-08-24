import { describe, it, expect, vi } from 'vitest';
import type { Property } from '@/types/property';
import type { SearchFilters } from '@/types/search';
import { applyFilters, getResultadosSimilares, paginateResults } from './filters';

let idCounter = 0;
function mkProperty(overrides: Partial<Property> = {}): Property {
  idCounter += 1;
  return {
    id: `prop-${idCounter}`,
    slug: `propiedad-${idCounter}`,
    titulo: 'Casa en venta',
    descripcion: 'Una propiedad de prueba',
    tipo: 'casa',
    operacion: 'venta',
    precio: 1_000_000,
    moneda: 'MXN',
    m2Construidos: 120,
    m2Terreno: 150,
    recamaras: 2,
    banos: 2,
    mediosBanos: 0,
    estacionamientos: 1,
    antiguedad: 5,
    amenidades: [],
    servicios: [],
    fotos: [],
    municipio: 'Centro',
    colonia: 'Centro',
    direccion: 'Centro, Centro',
    lat: 17.9869,
    lng: -92.9303,
    latPublico: 17.9869,
    lngPublico: -92.9303,
    riesgoInundacion: 'bajo',
    zonaEcologica: false,
    cercaDosoBocas: false,
    featured: false,
    agente: { nombre: 'Test', foto: '' },
    fechaPublicacion: '2026-01-01T00:00:00.000Z',
    activa: true,
    ...overrides,
  };
}

describe('applyFilters — free text (q)', () => {
  it('matches against titulo, colonia, municipio, or descripcion (case-insensitive)', () => {
    const props = [
      mkProperty({ titulo: 'Casa con alberca' }),
      mkProperty({ colonia: 'Reforma' }),
      mkProperty({ municipio: 'Cárdenas' }),
      mkProperty({ descripcion: 'cerca del malecón' }),
      mkProperty({ titulo: 'Nada relacionado', colonia: 'X', municipio: 'Y', descripcion: 'Z' }),
    ];
    expect(applyFilters(props, { q: 'alberca' })).toHaveLength(1);
    expect(applyFilters(props, { q: 'REFORMA' })).toHaveLength(1);
    expect(applyFilters(props, { q: 'cárdenas' })).toHaveLength(1);
    expect(applyFilters(props, { q: 'malecón' })).toHaveLength(1);
  });
});

describe('applyFilters — tipo/operacion (hard filters)', () => {
  it('filters by exact tipo', () => {
    const props = [mkProperty({ tipo: 'casa' }), mkProperty({ tipo: 'departamento' })];
    expect(applyFilters(props, { tipo: 'casa' })).toHaveLength(1);
  });
  it('filters by exact operacion', () => {
    const props = [mkProperty({ operacion: 'venta' }), mkProperty({ operacion: 'renta' })];
    expect(applyFilters(props, { operacion: 'renta' })).toHaveLength(1);
  });
});

describe('applyFilters — colonia (real coordinates, documented bug fix)', () => {
  it('when the colonia is catalogued, filters by real distance, not text', () => {
    // "Atasta" catalogued centroid: 17.9846, -92.9495. This property's
    // colonia field literally says something else (as in the real bug
    // report: "Magisterial" query, property's colonia field says
    // "Framboyanes") but is geographically right there.
    const nearAtasta = mkProperty({ colonia: 'Un nombre distinto', lat: 17.9846, lng: -92.9495 });
    const farAway = mkProperty({ colonia: 'Otro nombre', lat: 18.5, lng: -92.6 });
    const result = applyFilters([nearAtasta, farAway], { colonia: 'Atasta' });
    expect(result.map((p) => p.id)).toEqual([nearAtasta.id]);
  });

  it('excludes a property whose OWN catalogued colonia is different, even if within radius overlap', () => {
    // Documented real bug: "cerca de Tabasco 2000" (centroid 17.9994,
    // -92.9316, radio 1.3km) returning a Centro Histórico property (centroid
    // 17.9896, -92.9282) — only ~1.15km away, inside the radius, but a
    // distinct catalogued colonia with its own identity.
    const centroHistorico = mkProperty({ colonia: 'Centro Histórico', lat: 17.9896, lng: -92.9282 });
    const result = applyFilters([centroHistorico], { colonia: 'Tabasco 2000' });
    expect(result).toEqual([]);
  });

  it('still includes a property whose own colonia is NOT catalogued at all, if it is within radius', () => {
    // No conflicting identity to exclude on — should count as "cerca de".
    const uncatalogued = mkProperty({ colonia: 'Una colonia sin catalogar', lat: 17.9994, lng: -92.9316 });
    const result = applyFilters([uncatalogued], { colonia: 'Tabasco 2000' });
    expect(result).toHaveLength(1);
  });

  it('falls back to text match when the queried colonia is not catalogued', () => {
    const props = [
      mkProperty({ colonia: 'Colonia Totalmente Inventada' }),
      mkProperty({ colonia: 'Otra cosa' }),
    ];
    const result = applyFilters(props, { colonia: 'Colonia Totalmente Inventada' });
    expect(result).toHaveLength(1);
  });
});

describe('applyFilters — precio/recamaras/banos/m2', () => {
  it('precioMin/precioMax bound inclusively', () => {
    const props = [mkProperty({ precio: 500_000 }), mkProperty({ precio: 1_000_000 }), mkProperty({ precio: 2_000_000 })];
    expect(applyFilters(props, { precioMin: 1_000_000, precioMax: 1_000_000 })).toHaveLength(1);
    expect(applyFilters(props, { precioMin: 500_000, precioMax: 2_000_000 })).toHaveLength(3);
  });
  it('recamaras is a MINIMUM, recamarasMax is a MAXIMUM — both can combine into a range', () => {
    const props = [mkProperty({ recamaras: 1 }), mkProperty({ recamaras: 2 }), mkProperty({ recamaras: 3 })];
    expect(applyFilters(props, { recamaras: 2 })).toHaveLength(2); // >= 2
    expect(applyFilters(props, { recamarasMax: 2 })).toHaveLength(2); // <= 2
    expect(applyFilters(props, { recamaras: 2, recamarasMax: 2 })).toHaveLength(1); // exactly 2
  });
  it('m2Min/m2Max measure m2Terreno for terrenos, m2Construidos for everything else', () => {
    const terreno = mkProperty({ tipo: 'terreno', m2Construidos: 0, m2Terreno: 500 });
    const casa = mkProperty({ tipo: 'casa', m2Construidos: 90, m2Terreno: 120 });
    expect(applyFilters([terreno], { m2Min: 400 })).toHaveLength(1);
    expect(applyFilters([casa], { m2Min: 100 })).toHaveLength(0); // 90 construidos < 100, m2Terreno ignored for non-terreno
    expect(applyFilters([casa], { m2Min: 80 })).toHaveLength(1);
  });
});

describe('applyFilters — landmark (documented bug fix: unresolved landmark must never pass everything through)', () => {
  it('returns EMPTY results (not the unfiltered list) when the landmark key does not resolve', () => {
    // Real bug fixed 2026-08-20: landmarks load async; if a search runs
    // before the cache is populated, `getLandmark()` finds nothing. The fix
    // was to return [] in that case, never the full unfiltered list.
    const props = [mkProperty(), mkProperty(), mkProperty()];
    const result = applyFilters(props, { landmark: 'hospital-rovirosa' });
    expect(result).toEqual([]);
  });

  it('categoriaLandmark is ignored entirely when landmark is also set', () => {
    const props = [mkProperty()];
    // landmark unresolved -> [], regardless of categoriaLandmark also being set
    const result = applyFilters(props, { landmark: 'no-existe', categoriaLandmark: 'salud' });
    expect(result).toEqual([]);
  });

  it('resolves a real landmark and filters by real distance once the catalog is populated', async () => {
    vi.resetModules();
    vi.doMock('./backendApi', () => ({
      backendFetch: vi.fn().mockResolvedValue([
        { key: 'hospital-rovirosa', label: 'Hospital Rovirosa', categoria: 'salud', lat: 17.99, lng: -92.93, radioKm: 1 },
      ]),
    }));
    const { obtenerLandmarksBackend } = await import('./landmarks');
    await obtenerLandmarksBackend();
    const { applyFilters: freshApplyFilters } = await import('./filters');

    const near = mkProperty({ lat: 17.991, lng: -92.931 });
    const far = mkProperty({ lat: 19.0, lng: -99.0 });
    const result = freshApplyFilters([near, far], { landmark: 'hospital-rovirosa' });
    expect(result.map((p) => p.id)).toEqual([near.id]);
    vi.resetModules();
  });
});

describe('applyFilters — sort + limite', () => {
  it('sorts by precio-asc/precio-desc', () => {
    const props = [mkProperty({ precio: 3 }), mkProperty({ precio: 1 }), mkProperty({ precio: 2 })];
    expect(applyFilters(props, { sort: 'precio-asc' }).map((p) => p.precio)).toEqual([1, 2, 3]);
    expect(applyFilters(props, { sort: 'precio-desc' }).map((p) => p.precio)).toEqual([3, 2, 1]);
  });
  it('default sort (relevancia) puts featured properties first', () => {
    const notFeatured = mkProperty({ featured: false });
    const featured = mkProperty({ featured: true });
    const result = applyFilters([notFeatured, featured], {});
    expect(result[0].id).toBe(featured.id);
  });
  it('limite applies AFTER sorting, not before', () => {
    const props = [mkProperty({ precio: 3 }), mkProperty({ precio: 1 }), mkProperty({ precio: 2 })];
    const result = applyFilters(props, { sort: 'precio-asc', limite: 2 });
    expect(result.map((p) => p.precio)).toEqual([1, 2]); // the 2 CHEAPEST, not the first 2 unsorted
  });
});

describe('getResultadosSimilares', () => {
  it('never relaxes tipo/operacion (CRITERIOS_DUROS), even if it means fewer/no results', () => {
    const wrongTipo = mkProperty({ tipo: 'departamento', operacion: 'venta', municipio: 'Centro' });
    const filters: SearchFilters = { tipo: 'casa', operacion: 'venta', municipio: 'Centro' };
    const result = getResultadosSimilares([wrongTipo], filters, new Set(), 10);
    expect(result).toEqual([]);
  });

  it('returns [] when only tipo/operacion were requested (nothing soft to relax)', () => {
    const props = [mkProperty({ tipo: 'casa', operacion: 'venta' })];
    const filters: SearchFilters = { tipo: 'casa', operacion: 'venta' };
    const result = getResultadosSimilares(props, filters, new Set(), 10);
    expect(result).toEqual([]);
  });

  it('scores by number of matching soft criteria and sorts best-match first', () => {
    const filters: SearchFilters = { tipo: 'casa', municipio: 'Centro', precioMax: 2_000_000, recamaras: 3 };
    // Matches municipio + precioMax + recamaras (3 soft matches)
    const bestMatch = mkProperty({ tipo: 'casa', municipio: 'Centro', precio: 1_500_000, recamaras: 3 });
    // Matches only municipio (1 soft match)
    const weakMatch = mkProperty({ tipo: 'casa', municipio: 'Centro', precio: 5_000_000, recamaras: 1 });
    const result = getResultadosSimilares([weakMatch, bestMatch], filters, new Set(), 10);
    expect(result[0].id).toBe(bestMatch.id);
  });

  it('excludes ids in excluirIds (already-shown results)', () => {
    const p = mkProperty({ tipo: 'casa', municipio: 'Centro' });
    const filters: SearchFilters = { tipo: 'casa', municipio: 'Centro' };
    const result = getResultadosSimilares([p], filters, new Set([p.id]), 10);
    expect(result).toEqual([]);
  });

  it('respects the max cap', () => {
    const filters: SearchFilters = { municipio: 'Centro' };
    const props = Array.from({ length: 5 }, () => mkProperty({ municipio: 'Centro' }));
    expect(getResultadosSimilares(props, filters, new Set(), 2)).toHaveLength(2);
  });
});

describe('paginateResults', () => {
  it('slices the correct page', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const result = paginateResults(items, 2, 10);
    expect(result.data).toEqual(Array.from({ length: 10 }, (_, i) => i + 10));
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
  });
  it('handles a page beyond the data range gracefully (empty, not an error)', () => {
    const result = paginateResults([1, 2, 3], 10, 10);
    expect(result.data).toEqual([]);
  });
});
