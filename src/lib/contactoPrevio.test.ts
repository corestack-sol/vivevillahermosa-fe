import { describe, it, expect } from 'vitest';
import { contactoDeUltimaPropiedad } from './contactoPrevio';

describe('contactoDeUltimaPropiedad', () => {
  it('sin propiedades o sin datos de contacto: null (primera vez publicando)', () => {
    expect(contactoDeUltimaPropiedad([])).toBeNull();
    expect(contactoDeUltimaPropiedad([{ createdAt: '2026-01-01', agenteWhatsapp: null, agenteEmail: '' }])).toBeNull();
  });

  it('toma la propiedad MÁS RECIENTE, sin importar el orden en que llegan', () => {
    const r = contactoDeUltimaPropiedad([
      { createdAt: '2026-09-01T10:00:00Z', agenteWhatsapp: '9931111111', agenteEmail: 'a@x.com' },
      { createdAt: '2026-09-20T10:00:00Z', agenteWhatsapp: '9932222222', agenteEmail: null },
      { createdAt: '2026-08-01T10:00:00Z', agenteWhatsapp: '9933333333', agenteEmail: 'c@x.com' },
    ]);
    expect(r?.whatsapp).toBe('9932222222');
  });

  it('deduce el método de contacto de lo que la propiedad sí tenía', () => {
    expect(contactoDeUltimaPropiedad([{ agenteWhatsapp: '9931234567', agenteEmail: 'a@x.com' }])?.metodo).toBe('ambos');
    expect(contactoDeUltimaPropiedad([{ agenteWhatsapp: '9931234567', agenteEmail: null }])?.metodo).toBe('whatsapp');
    expect(contactoDeUltimaPropiedad([{ agenteWhatsapp: null, agenteEmail: 'a@x.com' }])?.metodo).toBe('correo');
  });

  it('conserva la preferencia de "mensaje primero" (privacidad)', () => {
    expect(contactoDeUltimaPropiedad([{ agenteWhatsapp: '9931234567', requiereMensajePrimero: true }])?.requiereMensajePrimero).toBe(true);
    expect(contactoDeUltimaPropiedad([{ agenteWhatsapp: '9931234567' }])?.requiereMensajePrimero).toBe(false);
  });
});
