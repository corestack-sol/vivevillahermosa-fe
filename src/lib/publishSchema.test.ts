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
  metodoContacto: 'whatsapp' as const,
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
  // "Teléfono" (llamada real) se quitó del enum 2026-09-07 — nunca fue
  // parte del plan original, solo quedan whatsapp/correo/ambos.
  it('rejects "telefono" — ya no es un valor válido del enum', () => {
    expect(publishSchema.safeParse({ ...baseValid, metodoContacto: 'telefono' }).success).toBe(false);
  });
  it('whatsapp requires telefonoContacto, not emailContacto', () => {
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
  // "Teléfono" (llamada real, botón "Llamar" en AgentCard.tsx) se quitó
  // del todo 2026-09-07 — nunca fue parte del plan original ("solo
  // WhatsApp o correo o ambos"). Ninguno de los 3 métodos que quedan
  // escribe `tel`.
  it('whatsapp: sets ONLY whatsapp, never tel', () => {
    const r = construirAgenteContacto('Juan', 'whatsapp', '9931234567', 'a@b.com');
    expect(r).toEqual({ nombre: 'Juan', whatsapp: '9931234567' });
  });

  it('correo: sets only email, no whatsapp even if a phone was passed in', () => {
    const r = construirAgenteContacto('Juan', 'correo', '9931234567', 'a@b.com');
    expect(r).toEqual({ nombre: 'Juan', email: 'a@b.com' });
  });

  it('ambos: sets whatsapp AND email, never tel — "Ambos" es WhatsApp + Correo, no llamada', () => {
    const r = construirAgenteContacto('Juan', 'ambos', '9931234567', 'a@b.com');
    expect(r).toEqual({ nombre: 'Juan', whatsapp: '9931234567', email: 'a@b.com' });
  });

  it('omits whatsapp entirely when telefono is undefined, even for a método that needs it', () => {
    const r = construirAgenteContacto('Juan', 'whatsapp', undefined, undefined);
    expect(r).toEqual({ nombre: 'Juan' });
  });

  it('never leaks the un-chosen channel — whatsapp method never includes email even if one was passed', () => {
    const r = construirAgenteContacto('Juan', 'whatsapp', '9931234567', 'a@b.com');
    expect(r.email).toBeUndefined();
  });
});
