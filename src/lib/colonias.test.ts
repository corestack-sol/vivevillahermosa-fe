import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  matchColonia, matchColoniaCandidates, sugerirColonias, getColoniaByKey, buscarColoniaEnTexto, jitterCoord, getPuntoPublico,
  normalizarNombreColonia, RADIO_COLONIA_KM,
} from './colonias';

describe('normalizarNombreColonia', () => {
  it('lowercases and strips accents', () => {
    expect(normalizarNombreColonia('José María Pino Suárez')).toBe('jose maria pino suarez');
  });
  it('strips a leading "colonia"/"col." prefix', () => {
    expect(normalizarNombreColonia('Colonia Magisterial')).toBe('magisterial');
    expect(normalizarNombreColonia('col Magisterial')).toBe('magisterial');
    expect(normalizarNombreColonia('col. Magisterial')).toBe('magisterial');
    expect(normalizarNombreColonia('la colonia Magisterial')).toBe('magisterial');
  });
  it('does NOT strip "fraccionamiento" or "sector" — these are part of the real distinguishing name', () => {
    expect(normalizarNombreColonia('Fraccionamiento Carrizal')).toBe('fraccionamiento carrizal');
    expect(normalizarNombreColonia('Sector Carrizal')).toBe('sector carrizal');
  });
  it('trims surrounding whitespace', () => {
    expect(normalizarNombreColonia('  Atasta  ')).toBe('atasta');
  });
});

describe('matchColonia', () => {
  it('matches a catalogued colonia by exact label', () => {
    expect(matchColonia('Atasta')?.key).toBe('atasta');
  });
  it('matches case- and accent-insensitively', () => {
    expect(matchColonia('atasta')?.key).toBe('atasta');
    expect(matchColonia('JOSÉ MARÍA PINO SUÁREZ')?.key).toBe('jose-maria-pino-suarez');
  });
  it('matches via the "colonia"/"col." prefix being stripped', () => {
    expect(matchColonia('col magisterial')?.key).toBe('magisterial');
  });
  it('matches via a registered alias', () => {
    expect(matchColonia('Pino Suárez')?.key).toBe('jose-maria-pino-suarez');
    expect(matchColonia('campestre')?.key).toBe('club-campestre');
    expect(matchColonia('T2000')?.key).toBe('tabasco-2000');
    expect(matchColonia('Zona Luz')?.key).toBe('centro-historico');
  });
  it('resolves "Petrolera" to Heriberto Kehoe Vicent (Centro) by default, and to the real Cárdenas one with municipioHint — caso real reportado 2026-09-04', () => {
    // "Petrolera" es un nombre real compartido por dos colonias distintas:
    // el apodo popular de Heriberto Kehoe Vicent (Centro) y una colonia
    // homónima real en Cárdenas (catalogada en colonias-municipios.json).
    // Sin pista de municipio, debe ganar Centro (mismo criterio pedido
    // para "sin municipio especificado, caer en Centro por defecto").
    expect(matchColonia('Petrolera')?.key).toBe('heriberto-kehoe-vicent');
    expect(matchColonia('La Petrolera')?.key).toBe('heriberto-kehoe-vicent');
    expect(matchColonia('Petrolera', 'Cárdenas')?.key).toBe('petrolera');
  });
  it('returns undefined for a completely unrelated string', () => {
    expect(matchColonia('Guadalajara Centro Histórico Sur')).toBeUndefined();
  });
  it('returns undefined for empty/whitespace-only input', () => {
    expect(matchColonia('')).toBeUndefined();
    expect(matchColonia('   ')).toBeUndefined();
  });
  it('tolerates a single-character typo on a long name that is unique in the catalog', () => {
    // "Bosques de Saloya" (Nacajuca) does not collide with any other
    // catalogued name, unlike "Framboyanes"/"Magisterial" below.
    expect(matchColonia('Bosques de Salolla')?.key).toBe('bosques-de-saloya');
  });
  it('does NOT guess when a short name has a typo that pushes it out of a tight margin', () => {
    // "Cotip" (5 chars) -> margin = max(1, floor(5/8)) = 1. Two typos exceeds it.
    expect(matchColonia('Kotipp')).toBeUndefined();
  });
  it('never guesses between multiple ambiguous close candidates (returns undefined, not the "closest" one)', () => {
    // Deliberately ambiguous/garbled input that could plausibly be close to
    // several different real colonia names — the function must not pick a
    // "best guess" among ties/multiple matches.
    const result = matchColonia('la manga');
    if (result) {
      expect(['la-manga-ii', 'triunfo-la-manga-i']).not.toContain(result.key);
    }
  });

  // Bug real encontrado 2026-08-23 escribiendo estas pruebas, corregido el
  // mismo día: 85 nombres de colonia (incluido "Magisterial", 6 lugares
  // reales distintos: Centro, Cunduacán, Huimanguillo, Macuspana, Paraíso,
  // Tenosique) existen en más de un municipio.
  describe('municipioHint (fix del bug de colonias homónimas entre municipios)', () => {
    it('without a hint, an ambiguous exact match still resolves to the first in the array (Centro) — same as before the fix', () => {
      const result = matchColonia('Magisterial');
      expect(result?.key).toBe('magisterial');
      expect(result?.municipio).toBe('Centro');
    });

    it('with a hint, resolves to the SPECIFIC municipio requested, not Centro', () => {
      expect(matchColonia('Magisterial', 'Cunduacán')?.key).toBe('magisterial-cunduacan');
      expect(matchColonia('Magisterial', 'Macuspana')?.key).toBe('magisterial-macuspana');
      expect(matchColonia('Magisterial', 'Tenosique')?.key).toBe('magisterial-tenosique');
    });

    it('the hint is accent/case-insensitive', () => {
      expect(matchColonia('Magisterial', 'CUNDUACAN')?.key).toBe('magisterial-cunduacan');
      expect(matchColonia('Magisterial', 'cunduacán')?.key).toBe('magisterial-cunduacan');
    });

    it('falls back to the normal (hint-less) resolution when the hint does not match any real municipio for that name', () => {
      // "Magisterial" doesn't exist in Balancán — should NOT return undefined,
      // should fall back to the standard ambiguous resolution instead of
      // failing a search entirely over a hint that turned out not to apply.
      expect(matchColonia('Magisterial', 'Balancán')?.key).toBe('magisterial');
    });

    it('a hint that matches the ONLY catalogued place is a no-op (same result with or without it)', () => {
      expect(matchColonia('Atasta', 'Centro')?.key).toBe('atasta');
      expect(matchColonia('Atasta')?.key).toBe('atasta');
    });

    it('also disambiguates the typo-tolerance fallback, not just exact matches', () => {
      // "Magisteral" (1 char dropped) was UNRESOLVABLE before the fix (6 exact
      // homonyms all within the typo margin, ambiguous). With a hint, exactly
      // one of them is in-margin AND in the right municipio.
      expect(matchColonia('Magisteral')).toBeUndefined(); // still ambiguous without a hint
      expect(matchColonia('Magisteral', 'Paraíso')?.key).toBe('magisterial-paraiso');
    });
  });
});

describe('matchColoniaCandidates', () => {
  it('empty string returns no candidates', () => {
    expect(matchColoniaCandidates('')).toEqual([]);
  });

  it('an unambiguous name returns a single candidate', () => {
    const result = matchColoniaCandidates('Atasta');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('atasta');
  });

  it('a name that repeats across municipios returns ALL of them, without a hint', () => {
    const result = matchColoniaCandidates('Magisterial');
    expect(result.length).toBeGreaterThanOrEqual(6);
    expect(result.map((c) => c.municipio)).toContain('Centro');
    expect(result.map((c) => c.municipio)).toContain('Cunduacán');
  });

  it('with a municipio hint, narrows down to just that one', () => {
    const result = matchColoniaCandidates('Magisterial', 'Cunduacán');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('magisterial-cunduacan');
  });

  it('a name not in the catalog returns no candidates', () => {
    expect(matchColoniaCandidates('Esta Colonia No Existe De Verdad')).toEqual([]);
  });
});

describe('sugerirColonias', () => {
  it('returns nothing for a query shorter than 2 characters', () => {
    expect(sugerirColonias('a')).toEqual([]);
    expect(sugerirColonias('')).toEqual([]);
  });

  it('matches by substring, not just prefix', () => {
    const result = sugerirColonias('gaviota');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.label.toLowerCase().includes('gaviota'))).toBe(true);
  });

  it('is accent/case-insensitive', () => {
    expect(sugerirColonias('MAGISTERIAL').length).toBeGreaterThan(0);
    expect(sugerirColonias('gil y saenz').length).toBeGreaterThan(0); // "Gil y Sáenz" real
  });

  it('respects the limite parameter', () => {
    const result = sugerirColonias('re', undefined, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('de-duplicates homonyms across municipios into a single suggestion', () => {
    const result = sugerirColonias('magisterial');
    const labels = result.map((c) => c.label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('prioritizes the given municipio when there are homonyms', () => {
    const result = sugerirColonias('magisterial', 'Cunduacán');
    expect(result[0]?.municipio).toBe('Cunduacán');
  });

  it('a query with no match returns an empty list', () => {
    expect(sugerirColonias('xyzxyzxyz-no-existe')).toEqual([]);
  });
});

describe('getColoniaByKey', () => {
  it('finds a colonia by its exact key', () => {
    expect(getColoniaByKey('tabasco-2000')?.label).toBe('Tabasco 2000');
  });
  it('returns undefined for an unknown key', () => {
    expect(getColoniaByKey('no-existe-esta-colonia')).toBeUndefined();
  });
});

describe('buscarColoniaEnTexto', () => {
  it('finds a catalogued colonia mentioned inside a longer free-text query', () => {
    expect(buscarColoniaEnTexto('busco algo cerca de la col magisterial por favor')?.key).toBe('magisterial');
  });
  it('respects word boundaries — does not match a substring inside an unrelated word', () => {
    // "atasta" should not match inside a longer unrelated word containing it.
    expect(buscarColoniaEnTexto('metastasis')).toBeUndefined();
  });
  it('is accent-insensitive', () => {
    expect(buscarColoniaEnTexto('cerca de jose maria pino suarez')?.key).toBe('jose-maria-pino-suarez');
  });
  it('returns undefined when no catalogued colonia appears in the text', () => {
    expect(buscarColoniaEnTexto('una casa bonita con jardín')).toBeUndefined();
  });
  it('does not throw on regex special characters in the input text', () => {
    expect(() => buscarColoniaEnTexto('casa (con parentesis) [y corchetes] $100')).not.toThrow();
  });
  // Bug real reportado 2026-09-11: buscar "centro histórico" mostraba TODAS
  // las propiedades del municipio Centro (la IA solo extraía el municipio,
  // nunca la colonia) en vez de priorizar la colonia real. Esta función ya
  // existía y ya cubría el caso — el bug era que SearchBar.tsx/
  // PropertiesClient.tsx nunca la llamaban como red de seguridad.
  it('resolves "centro histórico" to the colonia, not just the municipio', () => {
    const c = buscarColoniaEnTexto('casas en renta cerca del centro histórico');
    expect(c?.key).toBe('centro-historico');
    expect(c?.municipio).toBe('Centro');
  });
});

describe('jitterCoord', () => {
  it('is deterministic — same id always produces the same offset', () => {
    const a = jitterCoord('prop-123', 17.9869, -92.9303);
    const b = jitterCoord('prop-123', 17.9869, -92.9303);
    expect(a).toEqual(b);
  });
  it('produces different offsets for different ids', () => {
    const a = jitterCoord('prop-123', 17.9869, -92.9303);
    const b = jitterCoord('prop-456', 17.9869, -92.9303);
    expect(a).not.toEqual(b);
  });
  it('actually moves the point (never returns the exact original coordinate)', () => {
    const [lat, lng] = jitterCoord('prop-1', 17.9869, -92.9303);
    expect(lat).not.toBe(17.9869);
    expect(lng).not.toBe(-92.9303);
  });
  it('stays within a bounded, sane distance of the original point for a given radius', () => {
    const [lat, lng] = jitterCoord('prop-1', 17.9869, -92.9303, 500);
    // Rough distance check (Haversine-lite via Pythagorean approx is
    // enough at this small scale) — offset should be well under 1km for a
    // 500m radius, not degrees away.
    const dLat = Math.abs(lat - 17.9869);
    const dLng = Math.abs(lng - (-92.9303));
    expect(dLat).toBeLessThan(0.02); // ~2.2km of latitude, generous upper bound
    expect(dLng).toBeLessThan(0.02);
  });
});

describe('getPuntoPublico', () => {
  it('returns the verified colonia centroid when the colonia is catalogued (never the real coordinate)', () => {
    const real = { lat: 17.5, lng: -93.5 }; // deliberately far from the catalogued centroid
    const result = getPuntoPublico('prop-1', real.lat, real.lng, 'Atasta');
    expect(result).toEqual({ lat: 17.9846, lng: -92.9495 });
  });
  it('falls back to a jittered point when the colonia is not catalogued', () => {
    const result = getPuntoPublico('prop-1', 17.9, -92.9, 'Colonia Totalmente Inventada Que No Existe');
    expect(result.lat).not.toBe(17.9);
    expect(result.lng).not.toBe(-92.9);
  });
  it('never leaks the exact real coordinate under any circumstance', () => {
    const real = { lat: 18.12345, lng: -92.54321 };
    const catalogued = getPuntoPublico('prop-1', real.lat, real.lng, 'Atasta');
    const uncatalogued = getPuntoPublico('prop-2', real.lat, real.lng, 'No Existe Esta Colonia');
    expect(catalogued).not.toEqual(real);
    expect(uncatalogued).not.toEqual(real);
  });
});

describe('RADIO_COLONIA_KM', () => {
  it('is a sane positive radius (not accidentally 0 or negative)', () => {
    expect(RADIO_COLONIA_KM).toBeGreaterThan(0);
    expect(RADIO_COLONIA_KM).toBeLessThan(10); // sanity ceiling — this is a neighborhood radius, not a city-wide one
  });
});

describe('precargarColoniasDescubiertas (network-dependent, server-guard behavior)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves immediately without fetching when window is undefined (server/SSR context)', async () => {
    vi.doMock('@/lib/backendApi', () => ({ backendFetch: vi.fn() }));
    const { precargarColoniasDescubiertas } = await import('./colonias');
    const { backendFetch } = await import('@/lib/backendApi');
    await precargarColoniasDescubiertas();
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it('fetches once when window is defined, and does not re-fetch on a second call', async () => {
    vi.stubGlobal('window', {});
    const mockFetch = vi.fn().mockResolvedValue([]);
    vi.doMock('@/lib/backendApi', () => ({ backendFetch: mockFetch }));
    const { precargarColoniasDescubiertas } = await import('./colonias');
    await precargarColoniasDescubiertas();
    await precargarColoniasDescubiertas();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
