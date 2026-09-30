import { describe, it, expect } from 'vitest';
import { esDescripcionDemo } from './ads';

describe('esDescripcionDemo', () => {
  it('detecta el marcador exacto del catálogo de demostración', () => {
    expect(esDescripcionDemo('Anuncio de demostración para revisar el catálogo del sitio. Contacta al agente para más información.')).toBe(true);
  });
  it('detecta el marcador aunque venga rodeado de otro texto', () => {
    expect(esDescripcionDemo('Casa en venta en Reforma, Centro, Tabasco. Anuncio de demostración para revisar el catálogo del sitio.')).toBe(true);
  });
  it('no marca una descripción real como demo', () => {
    expect(esDescripcionDemo('¡Hola! Buscas la casa perfecta en Tabasco? Te ofrezco esta increíble casa en renta.')).toBe(false);
    expect(esDescripcionDemo('Casa de 3 recámaras con alberca y jardín amplio, a 10 minutos del centro.')).toBe(false);
  });
  it('descripción vacía no es demo', () => {
    expect(esDescripcionDemo('')).toBe(false);
  });
});
