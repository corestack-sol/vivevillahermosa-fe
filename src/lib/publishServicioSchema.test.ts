import { describe, it, expect } from 'vitest';
import { publishServicioSchema, trabajoServicioSchema, categoriaServicioLabel } from './publishServicioSchema';

const base = {
  categoria: 'plomeria',
  nombre: 'Juan Pérez',
  descripcion: 'Servicio de plomería con más de veinte caracteres de descripción.',
  municipio: 'Centro',
  telefono: '9931234567',
};

describe('publishServicioSchema', () => {
  it('accepts a fully valid payload', () => {
    expect(publishServicioSchema.safeParse(base).success).toBe(true);
  });
  it('rejects a categoria not in the catalog', () => {
    expect(publishServicioSchema.safeParse({ ...base, categoria: 'brujeria' }).success).toBe(false);
  });
  it('rejects a nombre under 2 characters', () => {
    expect(publishServicioSchema.safeParse({ ...base, nombre: 'A' }).success).toBe(false);
  });
  it('rejects a descripcion under 20 characters', () => {
    expect(publishServicioSchema.safeParse({ ...base, descripcion: 'Muy corta' }).success).toBe(false);
  });
  it('rejects a phone not exactly 10 digits', () => {
    expect(publishServicioSchema.safeParse({ ...base, telefono: '123' }).success).toBe(false);
  });
  it('email is optional — empty string and undefined both valid', () => {
    expect(publishServicioSchema.safeParse({ ...base, email: '' }).success).toBe(true);
    expect(publishServicioSchema.safeParse({ ...base }).success).toBe(true);
  });
  it('rejects a malformed non-empty email', () => {
    expect(publishServicioSchema.safeParse({ ...base, email: 'no-es-un-correo' }).success).toBe(false);
  });
});

describe('trabajoServicioSchema', () => {
  const pngDataUrl = 'data:image/png;base64,aGVsbG8=';
  it('accepts a valid PNG/JPG/WebP data URL', () => {
    expect(trabajoServicioSchema.safeParse({ imagenDataUrl: pngDataUrl }).success).toBe(true);
    expect(trabajoServicioSchema.safeParse({ imagenDataUrl: 'data:image/jpeg;base64,aGVsbG8=' }).success).toBe(true);
  });
  it('rejects a non-image data URL (e.g. a PDF slipped through)', () => {
    expect(trabajoServicioSchema.safeParse({ imagenDataUrl: 'data:application/pdf;base64,aGVsbG8=' }).success).toBe(false);
  });
  it('rejects an empty imagenDataUrl', () => {
    expect(trabajoServicioSchema.safeParse({ imagenDataUrl: '' }).success).toBe(false);
  });
  it('descripcion is optional but capped at 700 characters', () => {
    expect(trabajoServicioSchema.safeParse({ imagenDataUrl: pngDataUrl }).success).toBe(true);
    expect(trabajoServicioSchema.safeParse({ imagenDataUrl: pngDataUrl, descripcion: 'a'.repeat(701) }).success).toBe(false);
    expect(trabajoServicioSchema.safeParse({ imagenDataUrl: pngDataUrl, descripcion: 'a'.repeat(700) }).success).toBe(true);
  });
});

describe('categoriaServicioLabel', () => {
  it('returns the human label for a known category', () => {
    expect(categoriaServicioLabel('plomeria')).toBe('Plomería');
  });
  it('falls back to the raw value for an unknown category instead of throwing', () => {
    expect(categoriaServicioLabel('algo-inventado')).toBe('algo-inventado');
  });
});
