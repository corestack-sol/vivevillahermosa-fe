import { describe, it, expect } from 'vitest';
import { whatsappUrl } from './phone';

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
