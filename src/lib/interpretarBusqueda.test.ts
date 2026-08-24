import { describe, it, expect, vi, beforeEach } from 'vitest';
import { interpretarBusqueda, esOracionLarga, MAX_QUERY_LENGTH } from './interpretarBusqueda';
import { backendFetch, BackendApiError } from '@/lib/backendApi';

vi.mock('@/lib/backendApi', () => ({
  backendFetch: vi.fn(),
  BackendApiError: class BackendApiError extends Error {
    constructor(public status: number, public body: unknown) {
      super('mock error');
    }
  },
}));

describe('esOracionLarga', () => {
  it('is false for a short term (1-4 words)', () => {
    expect(esOracionLarga('Reforma')).toBe(false);
    expect(esOracionLarga('casa en Reforma')).toBe(false);
    expect(esOracionLarga('casa en col Reforma')).toBe(false);
  });
  it('is true at exactly the 5-word boundary', () => {
    expect(esOracionLarga('casa en col Reforma centro')).toBe(true);
  });
  it('collapses repeated whitespace when counting words', () => {
    expect(esOracionLarga('casa   en    col')).toBe(false); // 3 real words
  });
  it('trims leading/trailing whitespace before counting', () => {
    expect(esOracionLarga('  a b c d  ')).toBe(false); // 4 words
    expect(esOracionLarga('  a b c d e  ')).toBe(true); // 5 words
  });
  it('is false for an empty string', () => {
    expect(esOracionLarga('')).toBe(false);
  });
});

describe('interpretarBusqueda', () => {
  const mockFetch = vi.mocked(backendFetch);

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns filtros directly on a successful first call', async () => {
    mockFetch.mockResolvedValueOnce({ municipio: 'Centro' });
    const result = await interpretarBusqueda('casa en Centro');
    expect(result).toEqual({ municipio: 'Centro' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('truncates the query to MAX_QUERY_LENGTH before sending', async () => {
    mockFetch.mockResolvedValueOnce({});
    const huge = 'a'.repeat(500);
    await interpretarBusqueda(huge);
    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
    expect(sentBody.query.length).toBe(MAX_QUERY_LENGTH);
  });

  it('retries once on a network/timeout failure (status undefined)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mockFetch.mockResolvedValueOnce({ tipo: 'casa' });
    const result = await interpretarBusqueda('algo tranquilo que no se inunde');
    expect(result).toEqual({ tipo: 'casa' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on a real backend error (defined HTTP status) — returns {} immediately', async () => {
    mockFetch.mockRejectedValueOnce(new BackendApiError(500, { message: 'server error' }));
    const result = await interpretarBusqueda('algo tranquilo');
    expect(result).toEqual({});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns {} if both the first call and the retry fail', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await interpretarBusqueda('algo tranquilo');
    expect(result).toEqual({});
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
