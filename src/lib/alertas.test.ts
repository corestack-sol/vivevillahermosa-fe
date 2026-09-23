import { describe, it, expect } from 'vitest';
import { construirCuerpoAlerta, validarFiltrosAlerta, alertaSinFiltros, etiquetaAlerta, esAlertaDuplicada, ALERTAS_POR_COLONIA_DISPONIBLE } from './alertas';

const base = { dosBocas: false, sinRiesgo: false };

describe('construirCuerpoAlerta', () => {
  // Verificado en vivo 2026-09-23: el backend responde 400 si el body trae
  // `colonia` — mientras no la soporte, NUNCA debe viajar.
  it('con colonia deshabilitada (estado actual del backend) jamás manda `colonia`', () => {
    const c = construirCuerpoAlerta({ ...base, municipio: 'Centro', colonia: 'Tabasco 2000' }, { coloniaHabilitada: false });
    expect(c).not.toHaveProperty('colonia');
    expect(c.municipio).toBe('Centro');
  });

  it('la constante de producción está activa (el backend ya soporta colonia)', () => {
    expect(ALERTAS_POR_COLONIA_DISPONIBLE).toBe(true);
  });

  it('con la constante de producción, la colonia viaja junto al municipio y se recorta', () => {
    const c = construirCuerpoAlerta({ ...base, municipio: 'Centro', colonia: '  Tabasco 2000 ' });
    expect(c.colonia).toBe('Tabasco 2000');
  });

  it('con la constante de producción, una colonia en blanco NO se manda (el backend responde 400)', () => {
    expect(construirCuerpoAlerta({ ...base, municipio: 'Centro', colonia: '   ' })).not.toHaveProperty('colonia');
    expect(construirCuerpoAlerta({ ...base, municipio: 'Centro', colonia: '' })).not.toHaveProperty('colonia');
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
  it('texto escrito sin elegir una sugerencia es error (solo valen las de la lista)', () => {
    expect(validarFiltrosAlerta({ municipio: 'Centro', coloniaEscrita: 'tabasco', colonia: '' }, { coloniaHabilitada: true })).toMatch(/lista de sugerencias/);
    expect(validarFiltrosAlerta({ municipio: 'Centro', coloniaEscrita: 'Tabasco 2000', colonia: 'Tabasco 2000' }, { coloniaHabilitada: true })).toBeNull();
    expect(validarFiltrosAlerta({ municipio: 'Centro', coloniaEscrita: '', colonia: '' }, { coloniaHabilitada: true })).toBeNull();
  });

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

describe('esAlertaDuplicada', () => {
  const existente = { municipio: 'Centro', tipo: null, operacion: 'renta', precioMax: null, dosBocas: false, sinRiesgo: false };

  it('detecta una alerta idéntica (null, undefined y "" cuentan igual)', () => {
    expect(esAlertaDuplicada([existente], construirCuerpoAlerta({ municipio: 'Centro', operacion: 'renta', tipo: '', precioMax: '', dosBocas: false, sinRiesgo: false }))).toBe(true);
  });
  it('no distingue mayúsculas ni espacios sobrantes', () => {
    expect(esAlertaDuplicada([existente], { municipio: ' centro ', operacion: 'RENTA', dosBocas: false, sinRiesgo: false })).toBe(true);
  });
  it('un solo criterio distinto ya es otra alerta', () => {
    expect(esAlertaDuplicada([existente], { municipio: 'Centro', operacion: 'venta', dosBocas: false, sinRiesgo: false })).toBe(false);
    expect(esAlertaDuplicada([existente], { municipio: 'Centro', operacion: 'renta', precioMax: 1_000_000, dosBocas: false, sinRiesgo: false })).toBe(false);
    expect(esAlertaDuplicada([existente], { municipio: 'Centro', operacion: 'renta', dosBocas: true, sinRiesgo: false })).toBe(false);
  });
  it('sin alertas previas nunca es duplicada', () => {
    expect(esAlertaDuplicada([], { dosBocas: false, sinRiesgo: false })).toBe(false);
  });
});
