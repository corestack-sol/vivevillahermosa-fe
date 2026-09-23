import { describe, it, expect } from 'vitest';
import { construirCuerpoAlerta, validarFiltrosAlerta, alertaSinFiltros, etiquetaAlerta, ALERTAS_POR_COLONIA_DISPONIBLE } from './alertas';

const base = { dosBocas: false, sinRiesgo: false };

describe('construirCuerpoAlerta', () => {
  // Verificado en vivo 2026-09-23: el backend responde 400 si el body trae
  // `colonia` — mientras no la soporte, NUNCA debe viajar.
  it('con colonia deshabilitada (estado actual del backend) jamás manda `colonia`', () => {
    const c = construirCuerpoAlerta({ ...base, municipio: 'Centro', colonia: 'Tabasco 2000' }, { coloniaHabilitada: false });
    expect(c).not.toHaveProperty('colonia');
    expect(c.municipio).toBe('Centro');
  });

  it('la constante de producción sigue en false hasta que el backend confirme el contrato', () => {
    expect(ALERTAS_POR_COLONIA_DISPONIBLE).toBe(false);
  });

  it('con colonia habilitada, manda colonia recortada junto al municipio', () => {
    const c = construirCuerpoAlerta({ ...base, municipio: 'Centro', colonia: '  Tabasco 2000 ' }, { coloniaHabilitada: true });
    expect(c.colonia).toBe('Tabasco 2000');
  });

  it('con colonia habilitada pero sin municipio, no manda colonia (evita alertar en cualquier municipio)', () => {
    const c = construirCuerpoAlerta({ ...base, colonia: 'Centro' }, { coloniaHabilitada: true });
    expect(c).not.toHaveProperty('colonia');
  });

  it('colonia vacía o solo espacios no se manda', () => {
    const c = construirCuerpoAlerta({ ...base, municipio: 'Centro', colonia: '   ' }, { coloniaHabilitada: true });
    expect(c).not.toHaveProperty('colonia');
  });

  it('convierte precioMax a número y descarta vacío/0/negativo', () => {
    expect(construirCuerpoAlerta({ ...base, precioMax: '1500000' }).precioMax).toBe(1_500_000);
    expect(construirCuerpoAlerta({ ...base, precioMax: '' }).precioMax).toBeUndefined();
    expect(construirCuerpoAlerta({ ...base, precioMax: '0' }).precioMax).toBeUndefined();
    expect(construirCuerpoAlerta({ ...base, precioMax: '-5' }).precioMax).toBeUndefined();
  });

  it('strings vacíos de selects "Cualquiera" quedan como undefined', () => {
    const c = construirCuerpoAlerta({ ...base, municipio: '', tipo: '', operacion: '' });
    expect(c.municipio).toBeUndefined();
    expect(c.tipo).toBeUndefined();
    expect(c.operacion).toBeUndefined();
  });
});

describe('validarFiltrosAlerta', () => {
  it('colonia sin municipio es error cuando la función está habilitada', () => {
    expect(validarFiltrosAlerta({ colonia: 'Centro' }, { coloniaHabilitada: true })).toMatch(/municipio/i);
  });
  it('colonia con municipio es válida', () => {
    expect(validarFiltrosAlerta({ municipio: 'Centro', colonia: 'Centro' }, { coloniaHabilitada: true })).toBeNull();
  });
  it('sin colonia siempre es válido; deshabilitada nunca estorba', () => {
    expect(validarFiltrosAlerta({}, { coloniaHabilitada: true })).toBeNull();
    expect(validarFiltrosAlerta({ colonia: 'Centro' }, { coloniaHabilitada: false })).toBeNull();
  });
});

describe('alertaSinFiltros / etiquetaAlerta', () => {
  it('detecta la alerta que coincidiría con TODO', () => {
    expect(alertaSinFiltros(construirCuerpoAlerta(base))).toBe(true);
    expect(alertaSinFiltros(construirCuerpoAlerta({ ...base, tipo: 'casa' }))).toBe(false);
  });

  it('una alerta solo con colonia habilitada ya cuenta como filtro', () => {
    expect(alertaSinFiltros({ colonia: 'X', dosBocas: false, sinRiesgo: false })).toBe(false);
  });

  it('la etiqueta incluye la colonia antes del municipio', () => {
    expect(etiquetaAlerta({ operacion: 'renta', colonia: 'Tabasco 2000', municipio: 'Centro', dosBocas: false, sinRiesgo: false }))
      .toBe('Renta · Tabasco 2000 · Villahermosa');
  });

  it('sin filtros dice "Todas las propiedades"', () => {
    expect(etiquetaAlerta({ dosBocas: false, sinRiesgo: false })).toBe('Todas las propiedades');
  });
});
