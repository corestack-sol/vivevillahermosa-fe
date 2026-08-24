// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentSearches, addRecentSearch, clearRecentSearches } from './recentSearches';

describe('recentSearches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(getRecentSearches()).toEqual([]);
  });

  it('adds a search to the front', () => {
    addRecentSearch('casa en Centro');
    expect(getRecentSearches()).toEqual(['casa en Centro']);
  });

  it('moves a re-searched (case-insensitive) query to the front instead of duplicating it', () => {
    addRecentSearch('casa en Centro');
    addRecentSearch('depa en Tabasco 2000');
    addRecentSearch('CASA EN CENTRO');
    const result = getRecentSearches();
    expect(result).toEqual(['CASA EN CENTRO', 'depa en Tabasco 2000']);
    expect(result).toHaveLength(2); // not 3 — the case-insensitive dupe was removed, not appended
  });

  it('caps at 5 entries, dropping the oldest', () => {
    for (let i = 1; i <= 7; i++) addRecentSearch(`busqueda ${i}`);
    const result = getRecentSearches();
    expect(result).toHaveLength(5);
    expect(result[0]).toBe('busqueda 7'); // most recent first
    expect(result).not.toContain('busqueda 1'); // oldest dropped
    expect(result).not.toContain('busqueda 2');
  });

  it('trims whitespace and ignores an empty/whitespace-only query', () => {
    addRecentSearch('   ');
    expect(getRecentSearches()).toEqual([]);
    addRecentSearch('  casa  ');
    expect(getRecentSearches()).toEqual(['casa']);
  });

  it('clearRecentSearches empties the list', () => {
    addRecentSearch('algo');
    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });

  it('does not throw if localStorage contains malformed JSON', () => {
    localStorage.setItem('recentSearches', '{not valid json');
    expect(() => getRecentSearches()).not.toThrow();
    expect(getRecentSearches()).toEqual([]);
  });
});
