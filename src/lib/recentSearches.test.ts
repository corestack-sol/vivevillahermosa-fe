// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentSearches, addRecentSearch, clearRecentSearches } from './recentSearches';

describe('recentSearches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(getRecentSearches(null)).toEqual([]);
  });

  it('adds a search to the front', () => {
    addRecentSearch('casa en Centro', null);
    expect(getRecentSearches(null)).toEqual(['casa en Centro']);
  });

  it('moves a re-searched (case-insensitive) query to the front instead of duplicating it', () => {
    addRecentSearch('casa en Centro', null);
    addRecentSearch('depa en Tabasco 2000', null);
    addRecentSearch('CASA EN CENTRO', null);
    const result = getRecentSearches(null);
    expect(result).toEqual(['CASA EN CENTRO', 'depa en Tabasco 2000']);
    expect(result).toHaveLength(2); // not 3 — the case-insensitive dupe was removed, not appended
  });

  it('caps at 5 entries, dropping the oldest', () => {
    for (let i = 1; i <= 7; i++) addRecentSearch(`busqueda ${i}`, null);
    const result = getRecentSearches(null);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe('busqueda 7'); // most recent first
    expect(result).not.toContain('busqueda 1'); // oldest dropped
    expect(result).not.toContain('busqueda 2');
  });

  it('trims whitespace and ignores an empty/whitespace-only query', () => {
    addRecentSearch('   ', null);
    expect(getRecentSearches(null)).toEqual([]);
    addRecentSearch('  casa  ', null);
    expect(getRecentSearches(null)).toEqual(['casa']);
  });

  it('clearRecentSearches empties the list', () => {
    addRecentSearch('algo', null);
    clearRecentSearches(null);
    expect(getRecentSearches(null)).toEqual([]);
  });

  it('does not throw if localStorage contains malformed JSON', () => {
    localStorage.setItem('recentSearches:anon', '{not valid json');
    expect(() => getRecentSearches(null)).not.toThrow();
    expect(getRecentSearches(null)).toEqual([]);
  });

  // Bug real corregido 2026-09-11 (auditoría): antes la clave de
  // localStorage era global, sin cuenta — cerrar sesión en una
  // computadora compartida dejaba las búsquedas de una persona visibles
  // para la siguiente que usara el mismo navegador.
  it('separates searches by account — no mixing between users, and anon is independent', () => {
    addRecentSearch('busca de user-a', 'user-a');
    addRecentSearch('busca de user-b', 'user-b');
    addRecentSearch('busca anonima', null);
    expect(getRecentSearches('user-a')).toEqual(['busca de user-a']);
    expect(getRecentSearches('user-b')).toEqual(['busca de user-b']);
    expect(getRecentSearches(null)).toEqual(['busca anonima']);
  });

  it('a fresh userId never inherits another account\'s searches', () => {
    addRecentSearch('algo de user-a', 'user-a');
    expect(getRecentSearches('user-b')).toEqual([]);
  });

  it('clearRecentSearches only clears the given account, not others', () => {
    addRecentSearch('de A', 'user-a');
    addRecentSearch('de B', 'user-b');
    clearRecentSearches('user-a');
    expect(getRecentSearches('user-a')).toEqual([]);
    expect(getRecentSearches('user-b')).toEqual(['de B']);
  });
});
