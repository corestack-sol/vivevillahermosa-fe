import { describe, it, expect } from 'vitest';
import { formatPrice, formatPriceShort, formatPropertyCount, formatArea, formatRelativeDate, slugify } from './format';

describe('formatPrice', () => {
  it('formats venta without suffix, no decimals', () => {
    expect(formatPrice(1200000, 'venta')).toBe('$1,200,000');
  });
  it('formats renta with /mes suffix, no decimals', () => {
    expect(formatPrice(8500, 'renta')).toBe('$8,500/mes');
  });
  it('rounds to whole pesos even with a fractional input', () => {
    expect(formatPrice(1200000.75, 'venta')).toBe('$1,200,001');
  });
});

describe('formatPriceShort', () => {
  it('formats millions with one decimal', () => {
    expect(formatPriceShort(2_500_000)).toBe('$2.5M');
  });
  it('formats thousands with no decimal', () => {
    expect(formatPriceShort(8_500)).toBe('$9K');
  });
  it('formats sub-1000 as-is', () => {
    expect(formatPriceShort(850)).toBe('$850');
  });
  it('handles exact boundary at 1,000,000', () => {
    expect(formatPriceShort(1_000_000)).toBe('$1.0M');
  });
  it('handles exact boundary at 1,000', () => {
    expect(formatPriceShort(1_000)).toBe('$1K');
  });
  it('handles zero', () => {
    expect(formatPriceShort(0)).toBe('$0');
  });
});

describe('formatPropertyCount', () => {
  it('shows exact count under 50', () => {
    expect(formatPropertyCount(0)).toBe('0+');
    expect(formatPropertyCount(49)).toBe('49+');
  });
  it('rounds down to nearest 50 between 50 and 999', () => {
    expect(formatPropertyCount(50)).toBe('50+');
    expect(formatPropertyCount(99)).toBe('50+');
    expect(formatPropertyCount(149)).toBe('100+');
    expect(formatPropertyCount(999)).toBe('950+');
  });
  it('formats in k with one decimal between 1,000 and 999,999', () => {
    expect(formatPropertyCount(1_000)).toBe('1k+');
    expect(formatPropertyCount(1_249)).toBe('1.2k+');
    expect(formatPropertyCount(999_999)).toBe('999.9k+');
  });
  it('formats in m with one decimal from 1,000,000', () => {
    expect(formatPropertyCount(1_000_000)).toBe('1m+');
    expect(formatPropertyCount(2_340_000)).toBe('2.3m+');
  });
  it('never rounds UP (the "+" must never overstate the real count)', () => {
    // 1,299 real properties should never claim "1.3k+" (overstating) — must
    // floor to 1.2k+.
    expect(formatPropertyCount(1_299)).toBe('1.2k+');
  });
});

describe('formatArea', () => {
  it('appends m² with es-MX thousands separator', () => {
    expect(formatArea(1500)).toBe('1,500 m²');
  });
  it('handles small values without separator', () => {
    expect(formatArea(80)).toBe('80 m²');
  });
});

describe('formatRelativeDate', () => {
  it('returns "Hoy" for the current date', () => {
    expect(formatRelativeDate(new Date().toISOString())).toBe('Hoy');
  });
  it('returns "Ayer" for exactly 1 day ago', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(yesterday)).toBe('Ayer');
  });
  it('returns days for 2-6 days ago', () => {
    const d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(d)).toBe('Hace 3 días');
  });
  it('returns weeks starting at exactly 7 days', () => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(d)).toBe('Hace 1 semanas');
  });
  it('falls back to full date at 30+ days', () => {
    const d = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeDate(d);
    expect(result).not.toMatch(/Hace|Hoy|Ayer/);
  });
});

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Casa en Venta')).toBe('casa-en-venta');
  });
  it('strips accents (NFD normalization)', () => {
    expect(slugify('Colonia Reforma Peñón')).toBe('colonia-reforma-penon');
  });
  it('strips leading/trailing hyphens produced by punctuation', () => {
    expect(slugify('¡Oferta especial!')).toBe('oferta-especial');
  });
  it('collapses multiple non-alphanumeric runs into one hyphen', () => {
    expect(slugify('Casa   con,  alberca')).toBe('casa-con-alberca');
  });
  it('handles empty string without throwing', () => {
    expect(slugify('')).toBe('');
  });
});
