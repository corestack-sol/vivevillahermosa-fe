import { describe, it, expect } from 'vitest';
import { whatsappUrl, whatsappBaseUrl, formatTelefonoInput } from './phone';

describe('whatsappUrl', () => {
  it('adds the 52 country code to a bare 10-digit number', () => {
    expect(whatsappUrl('9931234567', 'Hola')).toBe('https://wa.me/529931234567?text=Hola');
  });
  it('strips non-digit formatting before checking length', () => {
    expect(whatsappUrl('993 123 4567', 'Hola')).toBe('https://wa.me/529931234567?text=Hola');
    expect(whatsappUrl('(993) 123-4567', 'Hola')).toBe('https://wa.me/529931234567?text=Hola');
  });
  it('does NOT double-prefix a number that already includes 52 (11+ digits)', () => {
    expect(whatsappUrl('529931234567', 'Hola')).toBe('https://wa.me/529931234567?text=Hola');
  });
  it('URL-encodes the message text', () => {
    expect(whatsappUrl('9931234567', 'Hola, ¿está disponible?')).toBe(
      'https://wa.me/529931234567?text=Hola%2C%20%C2%BFest%C3%A1%20disponible%3F',
    );
  });
  it('passes through a non-10-digit number unprefixed (e.g. already malformed input)', () => {
    // Documents actual behavior: only exactly-10-digit numbers get "52"
    // prepended. Anything else (partial, too long) is passed through as-is
    // rather than guessed at.
    expect(whatsappUrl('12345', 'x')).toBe('https://wa.me/12345?text=x');
  });
});

describe('whatsappBaseUrl', () => {
  it('adds the 52 country code, no query string', () => {
    expect(whatsappBaseUrl('9931234567')).toBe('https://wa.me/529931234567');
  });
  it('strips non-digit formatting', () => {
    expect(whatsappBaseUrl('(993) 123-4567')).toBe('https://wa.me/529931234567');
  });
  it('does NOT double-prefix a number that already includes 52', () => {
    expect(whatsappBaseUrl('529931234567')).toBe('https://wa.me/529931234567');
  });
});

describe('formatTelefonoInput', () => {
  it('groups a complete 10-digit number as XXX XXX XXXX', () => {
    expect(formatTelefonoInput('9931234567')).toBe('993 123 4567');
  });
  it('groups progressively while typing', () => {
    expect(formatTelefonoInput('9')).toBe('9');
    expect(formatTelefonoInput('993')).toBe('993');
    expect(formatTelefonoInput('9931')).toBe('993 1');
    expect(formatTelefonoInput('993123')).toBe('993 123');
    expect(formatTelefonoInput('9931234')).toBe('993 123 4');
  });
  it('strips letters and symbols, keeping only digits', () => {
    expect(formatTelefonoInput('993-123-4567')).toBe('993 123 4567');
    expect(formatTelefonoInput('abc9931234567xyz')).toBe('993 123 4567');
  });
  it('hard-caps at 10 digits, ignoring anything typed past that', () => {
    expect(formatTelefonoInput('99312345678999')).toBe('993 123 4567');
  });
  it('re-formats a value that already has the grouping spaces (re-render safe)', () => {
    expect(formatTelefonoInput('993 123 4567')).toBe('993 123 4567');
  });
});
