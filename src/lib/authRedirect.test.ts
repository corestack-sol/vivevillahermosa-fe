import { describe, it, expect } from 'vitest';
import { loginRedirectUrl, publicarHref } from './authRedirect';

describe('loginRedirectUrl', () => {
  it('builds a login link with the current path URL-encoded', () => {
    expect(loginRedirectUrl('/favoritos')).toBe('/auth/login?next=%2Ffavoritos');
  });
  it('encodes query params in the current path too', () => {
    expect(loginRedirectUrl('/propiedades?operacion=renta')).toBe(
      '/auth/login?next=%2Fpropiedades%3Foperacion%3Drenta',
    );
  });

  it('desde una página de /auth no manda next (evita volver al login ya logueado)', () => {
    expect(loginRedirectUrl('/auth/login')).toBe('/auth/login');
    expect(loginRedirectUrl('/auth/registro')).toBe('/auth/login');
  });
});

describe('publicarHref', () => {
  it('sin sesión (ya cargada) va directo al login con next=/publicar', () => {
    expect(publicarHref(false, false)).toBe('/auth/login?next=%2Fpublicar');
  });
  it('con sesión va a /publicar', () => {
    expect(publicarHref(false, true)).toBe('/publicar');
  });
  it('mientras la sesión carga asume que sí hay una (no manda a login por error)', () => {
    expect(publicarHref(true, false)).toBe('/publicar');
  });
});
