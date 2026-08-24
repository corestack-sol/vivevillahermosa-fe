// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readJson, writeJson } from './localStore';

describe('readJson / writeJson', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the fallback when the key does not exist', () => {
    expect(readJson('missing-key', { a: 1 })).toEqual({ a: 1 });
  });

  it('round-trips a value written then read', () => {
    writeJson('my-key', { hello: 'world', n: 42 });
    expect(readJson('my-key', null)).toEqual({ hello: 'world', n: 42 });
  });

  it('returns the fallback (not a throw) when stored JSON is malformed', () => {
    localStorage.setItem('bad-key', '{not valid json');
    expect(readJson('bad-key', 'fallback-value')).toBe('fallback-value');
  });

  it('overwrites a previously stored value', () => {
    writeJson('k', [1, 2, 3]);
    writeJson('k', [4, 5]);
    expect(readJson<number[]>('k', [])).toEqual([4, 5]);
  });
});
