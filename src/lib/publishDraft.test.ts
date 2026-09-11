// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { guardarBorrador, leerBorrador, borrarBorrador, borradorTieneContenido, type PublishDraft } from './publishDraft';

const VACIO: Omit<PublishDraft, 'guardadoEn'> = {
  valores: {},
  amenidades: [],
  servicios: [],
  coords: null,
  step: 0,
};

describe('publishDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('no hay borrador al inicio', () => {
    expect(leerBorrador('user-a')).toBeNull();
  });

  it('guarda y lee un borrador de vuelta', () => {
    guardarBorrador('user-a', { ...VACIO, valores: { titulo: 'Casa en renta' }, step: 2 });
    const leido = leerBorrador('user-a');
    expect(leido?.valores.titulo).toBe('Casa en renta');
    expect(leido?.step).toBe(2);
  });

  it('separa el borrador por cuenta — no se mezclan', () => {
    guardarBorrador('user-a', { ...VACIO, valores: { titulo: 'De A' } });
    guardarBorrador('user-b', { ...VACIO, valores: { titulo: 'De B' } });
    expect(leerBorrador('user-a')?.valores.titulo).toBe('De A');
    expect(leerBorrador('user-b')?.valores.titulo).toBe('De B');
  });

  it('el balde anónimo (null) es independiente de cualquier cuenta real', () => {
    guardarBorrador(null, { ...VACIO, valores: { titulo: 'Anónimo' } });
    guardarBorrador('user-a', { ...VACIO, valores: { titulo: 'De A' } });
    expect(leerBorrador(null)?.valores.titulo).toBe('Anónimo');
    expect(leerBorrador('user-a')?.valores.titulo).toBe('De A');
  });

  it('un userId nuevo nunca hereda el borrador de otra cuenta', () => {
    guardarBorrador('user-a', { ...VACIO, valores: { titulo: 'De A' } });
    expect(leerBorrador('user-b')).toBeNull();
  });

  it('borrarBorrador lo elimina de verdad', () => {
    guardarBorrador('user-a', { ...VACIO, valores: { titulo: 'X' } });
    borrarBorrador('user-a');
    expect(leerBorrador('user-a')).toBeNull();
  });

  it('un borrador de más de 7 días se considera expirado', () => {
    const viejo: PublishDraft = { ...VACIO, guardadoEn: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() };
    localStorage.setItem('publishDraft:user-a', JSON.stringify(viejo));
    expect(leerBorrador('user-a')).toBeNull();
  });

  it('un borrador de menos de 7 días sigue vigente', () => {
    const reciente: PublishDraft = { ...VACIO, valores: { titulo: 'Vigente' }, guardadoEn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() };
    localStorage.setItem('publishDraft:user-a', JSON.stringify(reciente));
    expect(leerBorrador('user-a')?.valores.titulo).toBe('Vigente');
  });

  it('JSON corrupto en localStorage no lanza, solo devuelve null', () => {
    localStorage.setItem('publishDraft:user-a', '{esto no es json valido');
    expect(leerBorrador('user-a')).toBeNull();
  });
});

describe('borradorTieneContenido', () => {
  it('un borrador totalmente vacío no vale la pena ofrecer', () => {
    const vacio: PublishDraft = { ...VACIO, guardadoEn: new Date().toISOString() };
    expect(borradorTieneContenido(vacio)).toBe(false);
  });

  it('con un título escrito, sí vale la pena', () => {
    const conTitulo: PublishDraft = { ...VACIO, valores: { titulo: 'Casa' }, guardadoEn: new Date().toISOString() };
    expect(borradorTieneContenido(conTitulo)).toBe(true);
  });

  it('con solo amenidades marcadas, sí vale la pena', () => {
    const conAmenidades: PublishDraft = { ...VACIO, amenidades: ['Alberca'], guardadoEn: new Date().toISOString() };
    expect(borradorTieneContenido(conAmenidades)).toBe(true);
  });

  it('con solo un pin puesto en el mapa, sí vale la pena', () => {
    const conPin: PublishDraft = { ...VACIO, coords: { lat: 17.99, lng: -92.93 }, guardadoEn: new Date().toISOString() };
    expect(borradorTieneContenido(conPin)).toBe(true);
  });

  it('un título con solo espacios en blanco no cuenta', () => {
    const soloEspacios: PublishDraft = { ...VACIO, valores: { titulo: '   ' }, guardadoEn: new Date().toISOString() };
    expect(borradorTieneContenido(soloEspacios)).toBe(false);
  });
});
