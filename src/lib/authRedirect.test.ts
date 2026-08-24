import { describe, it, expect } from 'vitest';
import { loginRedirectUrl } from './authRedirect';

describe('loginRedirectUrl', () => {
  it('builds a login link with the current path URL-encoded', () => {
    expect(loginRedirectUrl('/favoritos')).toBe('/auth/login?next=%2Ffavoritos');
  });
  it('encodes query params in the current path too', () => {
    expect(loginRedirectUrl('/propiedades?operacion=renta')).toBe(
      '/auth/login?next=%2Fpropiedades%3Foperacion%3Drenta',
    );
  });
});
