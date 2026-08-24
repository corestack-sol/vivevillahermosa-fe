import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from './safeRedirect';

describe('safeRedirectPath', () => {
  it('accepts a normal internal path', () => {
    expect(safeRedirectPath('/propiedades/casa-en-centro')).toBe('/propiedades/casa-en-centro');
  });
  it('falls back to /dashboard when null/undefined/empty', () => {
    expect(safeRedirectPath(null)).toBe('/dashboard');
    expect(safeRedirectPath(undefined)).toBe('/dashboard');
    expect(safeRedirectPath('')).toBe('/dashboard');
  });
  it('honors a custom fallback', () => {
    expect(safeRedirectPath(null, '/favoritos')).toBe('/favoritos');
  });
  it('rejects a path not starting with /', () => {
    expect(safeRedirectPath('evil.com')).toBe('/dashboard');
  });
  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/dashboard');
  });
  it('rejects an absolute URL with a scheme', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/dashboard');
    expect(safeRedirectPath('/redirect?to=https://evil.com')).toBe('/dashboard');
  });
  it('rejects backslash-based bypass attempts (browser normalizes \\ to /)', () => {
    expect(safeRedirectPath('/\\evil.com')).toBe('/dashboard');
    expect(safeRedirectPath('\\\\evil.com')).toBe('/dashboard');
  });
  it('accepts a path with query params and hash', () => {
    expect(safeRedirectPath('/propiedades?operacion=renta#top')).toBe('/propiedades?operacion=renta#top');
  });
});
