import { describe, it, expect } from 'vitest';
import { redactarUrl, redactarPropiedades } from './redactarUrl';

describe('redactarUrl', () => {
  it('censura el token de una query string', () => {
    expect(redactarUrl('https://x.com/cuenta/confirmar-cambio-correo?token=abc123'))
      .toBe('https://x.com/cuenta/confirmar-cambio-correo?token=[redacted]');
  });
  it('censura el token cuando no es el primer parámetro y conserva los demás', () => {
    expect(redactarUrl('/a?x=1&token=secreto&y=2')).toBe('/a?x=1&token=[redacted]&y=2');
  });
  it('censura el token en el fragmento (#token=)', () => {
    expect(redactarUrl('/a#token=secreto')).toBe('/a#token=[redacted]');
  });
  it('censura codigo y code, sin distinguir mayúsculas', () => {
    expect(redactarUrl('/a?CODIGO=123456&code=987')).toBe('/a?CODIGO=[redacted]&code=[redacted]');
  });
  it('no toca URLs sin secretos ni parámetros parecidos', () => {
    expect(redactarUrl('/propiedades?tokenizado=1&municipio=Centro')).toBe('/propiedades?tokenizado=1&municipio=Centro');
    expect(redactarUrl('/propiedades?municipio=Centro')).toBe('/propiedades?municipio=Centro');
  });
  it('un token vacío también queda marcado y no rompe', () => {
    expect(redactarUrl('/a?token=')).toBe('/a?token=[redacted]');
  });
});

describe('redactarPropiedades', () => {
  it('censura solo las propiedades string que contienen un secreto', () => {
    const r = redactarPropiedades({
      $current_url: 'https://x.com/c?token=abc',
      $referrer: 'https://google.com',
      $screen_width: 1280,
    });
    expect(r.$current_url).toBe('https://x.com/c?token=[redacted]');
    expect(r.$referrer).toBe('https://google.com');
    expect(r.$screen_width).toBe(1280);
  });
  it('no muta el objeto original', () => {
    const original = { $current_url: '/a?token=abc' };
    redactarPropiedades(original);
    expect(original.$current_url).toBe('/a?token=abc');
  });
});
