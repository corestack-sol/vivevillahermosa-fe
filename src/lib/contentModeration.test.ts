import { describe, it, expect } from 'vitest';
import { detectarLenguajeSensible } from './contentModeration';

describe('detectarLenguajeSensible', () => {
  it('returns an empty array for clean text', () => {
    expect(detectarLenguajeSensible('Casa amplia con jardín y alberca, cerca del centro.')).toEqual([]);
  });
  it('detects an exact-case match', () => {
    expect(detectarLenguajeSensible('Se renta departamento, no niños por favor')).toContain('no niños');
  });
  it('is case-insensitive', () => {
    expect(detectarLenguajeSensible('SOLO MEXICANOS pueden aplicar')).toContain('solo mexicanos');
  });
  it('is accent-insensitive in both the input and the phrase list', () => {
    // "indígenas" in the phrase list has an accent; typed text often won't.
    expect(detectarLenguajeSensible('no se aceptan indigenas en este lugar')).toContain('no se aceptan indígenas');
  });
  it('matches as a substring anywhere in the text, not just whole-sentence', () => {
    expect(detectarLenguajeSensible('Departamento moderno, unicamente adultos, excelente ubicación'))
      .toContain('únicamente adultos');
  });
  it('returns multiple matches when several flagged phrases are present', () => {
    const result = detectarLenguajeSensible('No niños, no extranjeros, solo adultos');
    expect(result.length).toBeGreaterThanOrEqual(3);
  });
  it('does not false-positive on an unrelated word that merely contains letters from a phrase', () => {
    // "niños" is flagged via "sin niños"/"no niños" — a sentence that
    // legitimately mentions children without exclusionary framing should
    // not trip on partial letter overlap alone.
    expect(detectarLenguajeSensible('Hay una escuela cerca, ideal para familias')).toEqual([]);
  });
  it('handles empty string without throwing', () => {
    expect(detectarLenguajeSensible('')).toEqual([]);
  });
});
