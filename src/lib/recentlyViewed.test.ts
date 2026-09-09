// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentlyViewedIds, addRecentlyViewed, getViewedCount } from './recentlyViewed';

describe('recentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(getRecentlyViewedIds()).toEqual([]);
  });

  it('adds an id to the front', () => {
    addRecentlyViewed('prop-1');
    expect(getRecentlyViewedIds()).toEqual(['prop-1']);
  });

  it('moves a re-viewed property to the front instead of duplicating it', () => {
    addRecentlyViewed('prop-1');
    addRecentlyViewed('prop-2');
    addRecentlyViewed('prop-1');
    const result = getRecentlyViewedIds();
    expect(result).toEqual(['prop-1', 'prop-2']);
  });

  it('caps at 8 entries, dropping the oldest', () => {
    for (let i = 1; i <= 10; i++) addRecentlyViewed(`prop-${i}`);
    const result = getRecentlyViewedIds();
    expect(result).toHaveLength(8);
    expect(result[0]).toBe('prop-10');
    expect(result).not.toContain('prop-1');
    expect(result).not.toContain('prop-2');
  });

  it('ignores an empty propertyId', () => {
    addRecentlyViewed('');
    expect(getRecentlyViewedIds()).toEqual([]);
  });

  describe('getViewedCount', () => {
    it('starts at 0', () => {
      expect(getViewedCount()).toBe(0);
    });

    it('keeps growing past the 8-entry cap of the recent list', () => {
      for (let i = 1; i <= 10; i++) addRecentlyViewed(`prop-${i}`);
      expect(getRecentlyViewedIds()).toHaveLength(8);
      expect(getViewedCount()).toBe(10);
    });

    it('does not double-count a re-viewed property', () => {
      addRecentlyViewed('prop-1');
      addRecentlyViewed('prop-2');
      addRecentlyViewed('prop-1');
      expect(getViewedCount()).toBe(2);
    });

    // Bug real reportado 2026-09-09: cuentas con historial de ANTES de que
    // KEY_TOTAL existiera (2026-09-08) veían "3 propiedades vistas" en el
    // dashboard pero 8 tarjetas reales al entrar al carrusel — KEY_TOTAL
    // arrancaba en 0 sin importar cuánto historial ya hubiera en KEY.
    it('backfills from the pre-existing recent list, never counting less than what is already visible', () => {
      // Simula el localStorage viejo: solo KEY tiene datos (8 propiedades
      // reales de antes del 2026-09-08), KEY_TOTAL nunca existió para esta
      // cuenta.
      localStorage.setItem(
        'recentlyViewedProperties',
        JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']),
      );
      expect(getViewedCount()).toBe(8);
    });

    it('merges old and new sources without double-counting overlapping ids', () => {
      localStorage.setItem('recentlyViewedProperties', JSON.stringify(['a', 'b']));
      addRecentlyViewed('a'); // ya estaba en la lista vieja — no debe sumar de más
      addRecentlyViewed('c');
      expect(getViewedCount()).toBe(3); // a, b, c
    });
  });
});
