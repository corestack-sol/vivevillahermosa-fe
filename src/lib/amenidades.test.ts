import { describe, it, expect } from 'vitest';
import { AMENIDADES_OPTIONS, AMENIDADES_MAP } from './amenidades';

describe('AMENIDADES_OPTIONS / AMENIDADES_MAP', () => {
  it('every key is unique', () => {
    const keys = AMENIDADES_OPTIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('every label is unique — AMENIDADES_MAP is keyed by label, a collision would silently drop an entry', () => {
    const labels = AMENIDADES_OPTIONS.map((a) => a.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(AMENIDADES_MAP.size).toBe(AMENIDADES_OPTIONS.length);
  });
  it('AMENIDADES_MAP looks up correctly by label (not by key)', () => {
    expect(AMENIDADES_MAP.get('Alberca')?.key).toBe('alberca');
    expect(AMENIDADES_MAP.get('alberca')).toBeUndefined(); // lowercase key must NOT resolve
  });
});
