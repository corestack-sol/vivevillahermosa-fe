// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentlyViewedIds, addRecentlyViewed } from './recentlyViewed';

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
});
