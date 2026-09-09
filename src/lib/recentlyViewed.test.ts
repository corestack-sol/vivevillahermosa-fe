// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentlyViewedIds, addRecentlyViewed, getViewedCount } from './recentlyViewed';

const USER_A = 'user-a';
const USER_B = 'user-b';

describe('recentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(getRecentlyViewedIds(USER_A)).toEqual([]);
  });

  it('adds an id to the front', () => {
    addRecentlyViewed('prop-1', USER_A);
    expect(getRecentlyViewedIds(USER_A)).toEqual(['prop-1']);
  });

  it('moves a re-viewed property to the front instead of duplicating it', () => {
    addRecentlyViewed('prop-1', USER_A);
    addRecentlyViewed('prop-2', USER_A);
    addRecentlyViewed('prop-1', USER_A);
    const result = getRecentlyViewedIds(USER_A);
    expect(result).toEqual(['prop-1', 'prop-2']);
  });

  it('caps at 8 entries, dropping the oldest', () => {
    for (let i = 1; i <= 10; i++) addRecentlyViewed(`prop-${i}`, USER_A);
    const result = getRecentlyViewedIds(USER_A);
    expect(result).toHaveLength(8);
    expect(result[0]).toBe('prop-10');
    expect(result).not.toContain('prop-1');
    expect(result).not.toContain('prop-2');
  });

  it('ignores an empty propertyId', () => {
    addRecentlyViewed('', USER_A);
    expect(getRecentlyViewedIds(USER_A)).toEqual([]);
  });

  describe('getViewedCount', () => {
    it('starts at 0', () => {
      expect(getViewedCount(USER_A)).toBe(0);
    });

    it('keeps growing past the 8-entry cap of the recent list', () => {
      for (let i = 1; i <= 10; i++) addRecentlyViewed(`prop-${i}`, USER_A);
      expect(getRecentlyViewedIds(USER_A)).toHaveLength(8);
      expect(getViewedCount(USER_A)).toBe(10);
    });

    it('does not double-count a re-viewed property', () => {
      addRecentlyViewed('prop-1', USER_A);
      addRecentlyViewed('prop-2', USER_A);
      addRecentlyViewed('prop-1', USER_A);
      expect(getViewedCount(USER_A)).toBe(2);
    });
  });

  // Bug real reportado 2026-09-09: al eliminar una cuenta y registrar una
  // nueva en el mismo navegador, "Mi panel" mostraba el historial de la
  // cuenta anterior. Las claves ahora van por userId — cada cuenta arranca
  // en 0 sin importar qué haya en cualquier otra cuenta o en el balde
  // anónimo.
  describe('separación por cuenta', () => {
    it('a fresh userId always starts empty, regardless of other accounts', () => {
      addRecentlyViewed('prop-1', USER_A);
      addRecentlyViewed('prop-2', USER_A);
      expect(getViewedCount(USER_A)).toBe(2);

      expect(getRecentlyViewedIds(USER_B)).toEqual([]);
      expect(getViewedCount(USER_B)).toBe(0);
    });

    it('keeps two accounts fully isolated from each other', () => {
      addRecentlyViewed('prop-1', USER_A);
      addRecentlyViewed('prop-2', USER_B);
      addRecentlyViewed('prop-3', USER_B);

      expect(getRecentlyViewedIds(USER_A)).toEqual(['prop-1']);
      expect(getRecentlyViewedIds(USER_B)).toEqual(['prop-3', 'prop-2']);
      expect(getViewedCount(USER_A)).toBe(1);
      expect(getViewedCount(USER_B)).toBe(2);
    });

    it('keeps the anonymous (null) bucket separate from any real account', () => {
      addRecentlyViewed('prop-1', null);
      addRecentlyViewed('prop-2', USER_A);

      expect(getRecentlyViewedIds(null)).toEqual(['prop-1']);
      expect(getRecentlyViewedIds(USER_A)).toEqual(['prop-2']);
      expect(getViewedCount(null)).toBe(1);
      expect(getViewedCount(USER_A)).toBe(1);
    });
  });
});
