import { describe, it, expect } from 'vitest';
import { publishSchema, construirAgenteContacto } from './publishSchema';

const baseValid = {
  tipo: 'casa',
  operacion: 'venta',
  precio: 1_200_000,
  municipio: 'Centro',
  colonia: 'Centro',
  titulo: 'Casa amplia en venta',
  descripcion: 'Una descripción con más de treinta caracteres de verdad.',
  riesgoInundacion: 'bajo' as const,
  nombreContacto: 'Juan Pérez',
  metodoContacto: 'telefono' as const,
  telefonoContacto: '9931234567',
  aceptaTerminos: true,
};

describe('publishSchema — required fields', () => {
  it('accepts a fully valid payload', () => {
    expect(publishSchema.safeParse(baseValid).success).toBe(true);
  });
  it('rejects a precio of 0 or negative', () => {
    expect(publishSchema.safeParse({ ...baseValid, precio: 0 }).success).toBe(false);
    expect(publishSchema.safeParse({ ...baseValid, precio: -100 }).success).toBe(false);
  });
  it('rejects an absurdly large precio (> 500 million)', () => {
    expect(publishSchema.safeParse({ ...baseValid, precio: 600_000_000 }).success).toBe(false);
  });
  it('rejects a titulo under 10 characters', () => {
    expect(publishSchema.safeParse({ ...baseValid, titulo: 'Casa' }).success).toBe(false);
  });
  it('rejects a descripcion under 30 characters', () => {
    expect(publishSchema.safeParse({ ...baseValid, descripcion: 'Muy corta' }).success).toBe(false);
  });
  it('rejects aceptaTerminos: false', () => {
    expect(publishSchema.safeParse({ ...baseValid, aceptaTerminos: false }).success).toBe(false);
  });
  it('rejects an invalid riesgoInundacion value', () => {
    expect(publishSchema.safeParse({ ...baseValid, riesgoInundacion: 'extremo' }).success).toBe(false);
  });
  it('rejects operacion/tipo as empty string (radio group with no selection)', () => {
    expect(publishSchema.safeParse({ ...baseValid, tipo: '' }).success).toBe(false);
    expect(publishSchema.safeParse({ ...baseValid, operacion: '' }).success).toBe(false);
  });
});

describe('publishSchema — metodoContacto conditional requirements', () => {
  it('telefono requires telefonoContacto, not emailContacto', () => {
    expect(publishSchema.safeParse({ ...baseValid, metodoContacto: 'telefono', telefonoContacto: '9931234567' }).success).toBe(true);
    expect(publishSchema.safeParse({ ...baseValid, metodoContacto: 'telefono', telefonoContacto: undefined }).success).toBe(false);
  });
  it('whatsapp requires telefonoContacto too (same 10-digit field, different storage downstream)', () => {
    expect(publishSchema.safeParse({ ...baseValid, metodoContacto: 'whatsapp', telefonoContacto: '9931234567' }).success).toBe(true);
    expect(publishSchema.safeParse({ ...baseValid, metodoContacto: 'whatsapp', telefonoContacto: undefined }).success).toBe(false);
  });
  it('correo requires emailContacto, NOT telefonoContacto', () => {
    expect(publishSchema.safeParse({ ...baseValid, telefonoContacto: undefined, metodoContacto: 'correo', emailContacto: 'a@b.com' }).success).toBe(true);
    expect(publishSchema.safeParse({ ...baseValid, telefonoContacto: undefined, metodoContacto: 'correo', emailContacto: undefined }).success).toBe(false);
  });
  it('ambos requires BOTH telefonoContacto and emailContacto', () => {
    expect(publishSchema.safeParse({
      ...baseValid, metodoContacto: 'ambos', telefonoContacto: '9931234567', emailContacto: 'a@b.com',
    }).success).toBe(true);
    expect(publishSchema.safeParse({
      ...baseValid, metodoContacto: 'ambos', telefonoContacto: '9931234567', emailContacto: undefined,
    }).success).toBe(false);
  });
  it('rejects a phone number that is not exactly 10 digits', () => {
    expect(publishSchema.safeParse({ ...baseValid, telefonoContacto: '123' }).success).toBe(false);
    expect(publishSchema.safeParse({ ...baseValid, telefonoContacto: '+529931234567' }).success).toBe(false);
  });
  it('tolerates spaces in the phone number (stripped before the digit-count check)', () => {
    expect(publishSchema.safeParse({ ...baseValid, telefonoContacto: '993 123 4567' }).success).toBe(true);
  });
  it('rejects a malformed email', () => {
    expect(publishSchema.safeParse({ ...baseValid, telefonoContacto: undefined, metodoContacto: 'correo', emailContacto: 'no-es-correo' }).success).toBe(false);
  });
});

describe('construirAgenteContacto', () => {
  it('telefono: sets both tel and whatsapp to the same number, no email', () => {
    const r = construirAgenteContacto('Juan', 'telefono', '9931234567', 'a@b.com');
    expect(r).toEqual({ nombre: 'Juan', tel: '9931234567', whatsapp: '9931234567' });
  });

  it('whatsapp: sets ONLY whatsapp, never tel — the whole point of this option', () => {
    // Real bug fixed 2026-08-21: choosing "Teléfono" saved the same number
    // into BOTH tel and whatsapp, so AgentCard.tsx always rendered a
    // "Llamar" button too — there was no way to say "only message me".
    const r = construirAgenteContacto('Juan', 'whatsapp', '9931234567', 'a@b.com');
    expect(r.whatsapp).toBe('9931234567');
    expect(r.tel).toBeUndefined();
  });

  it('correo: sets only email, no tel/whatsapp even if a phone was passed in', () => {
    const r = construirAgenteContacto('Juan', 'correo', '9931234567', 'a@b.com');
    expect(r).toEqual({ nombre: 'Juan', email: 'a@b.com' });
  });

  it('ambos: sets tel, whatsapp, AND email', () => {
    const r = construirAgenteContacto('Juan', 'ambos', '9931234567', 'a@b.com');
    expect(r).toEqual({ nombre: 'Juan', tel: '9931234567', whatsapp: '9931234567', email: 'a@b.com' });
  });

  it('omits tel/whatsapp entirely when telefono is undefined, even for a método that needs it', () => {
    const r = construirAgenteContacto('Juan', 'telefono', undefined, undefined);
    expect(r).toEqual({ nombre: 'Juan' });
  });

  it('never leaks the un-chosen channel — telefono method never includes email even if one was passed', () => {
    const r = construirAgenteContacto('Juan', 'telefono', '9931234567', 'a@b.com');
    expect(r.email).toBeUndefined();
  });
});
