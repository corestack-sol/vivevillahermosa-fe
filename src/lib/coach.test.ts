import { describe, it, expect } from 'vitest';
import type { Property } from '@/types/property';
import type { EstadoPublicacion, MiPropiedad } from '@/lib/misPropiedades';
import { evaluarPropiedad, evaluarCartera } from './coach';

function mkProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1', slug: 'casa-1', titulo: 'Casa', descripcion: 'a'.repeat(150), tipo: 'casa', operacion: 'venta',
    precio: 1_000_000, moneda: 'MXN', m2Construidos: 120, m2Terreno: 150, recamaras: 2, banos: 2, mediosBanos: 0,
    estacionamientos: 1, antiguedad: 5, amenidades: ['Alberca'], servicios: [], fotos: ['a.jpg', 'b.jpg', 'c.jpg'],
    municipio: 'Centro', colonia: 'Centro', direccion: 'x', lat: 17.98, lng: -92.93, latPublico: 17.98, lngPublico: -92.93,
    riesgoInundacion: 'bajo', zonaEcologica: false, cercaDosoBocas: false, featured: false,
    agente: { nombre: 'x', foto: '' }, fechaPublicacion: new Date().toISOString(), activa: true,
    ...overrides,
  };
}

function mkMiPropiedad(propOverrides: Partial<Property> = {}, estado: EstadoPublicacion = 'activa'): MiPropiedad {
  return { property: mkProperty(propOverrides), estado, vistas: 0, contactos: 0, favoritos: 0, publicadaHace: 'hoy' };
}

describe('evaluarPropiedad', () => {
  it('returns no reasons for a complete, healthy, freshly-published listing', () => {
    expect(evaluarPropiedad(mkProperty(), 'activa')).toEqual([]);
  });

  it('returns [] for vendida/rentada/vencida — the coach only applies to activa/pausada', () => {
    expect(evaluarPropiedad(mkProperty({ fotos: [] }), 'vendida')).toEqual([]);
    expect(evaluarPropiedad(mkProperty({ fotos: [] }), 'rentada')).toEqual([]);
    expect(evaluarPropiedad(mkProperty({ fotos: [] }), 'vencida')).toEqual([]);
  });

  it('flags pocas-fotos under the 3-photo threshold, with a distinct message for zero photos', () => {
    const zero = evaluarPropiedad(mkProperty({ fotos: [] }), 'activa');
    expect(zero.find((r) => r.clave === 'pocas-fotos')?.mensaje).toMatch(/No tiene fotos/);

    const two = evaluarPropiedad(mkProperty({ fotos: ['a.jpg', 'b.jpg'] }), 'activa');
    expect(two.find((r) => r.clave === 'pocas-fotos')?.mensaje).toMatch(/Solo tiene 2 foto/);
  });

  it('does NOT flag pocas-fotos at exactly the threshold (3)', () => {
    const result = evaluarPropiedad(mkProperty({ fotos: ['a.jpg', 'b.jpg', 'c.jpg'] }), 'activa');
    expect(result.find((r) => r.clave === 'pocas-fotos')).toBeUndefined();
  });

  it('flags descripcion-corta under 120 characters', () => {
    const result = evaluarPropiedad(mkProperty({ descripcion: 'Descripción breve.' }), 'activa');
    expect(result.some((r) => r.clave === 'descripcion-corta')).toBe(true);
  });

  it('does not flag descripcion-corta at exactly 120 characters', () => {
    const result = evaluarPropiedad(mkProperty({ descripcion: 'a'.repeat(120) }), 'activa');
    expect(result.find((r) => r.clave === 'descripcion-corta')).toBeUndefined();
  });

  it('trims the descripcion before measuring length (whitespace does not count toward the minimum)', () => {
    const result = evaluarPropiedad(mkProperty({ descripcion: '   ' + 'a'.repeat(115) + '   ' }), 'activa');
    expect(result.some((r) => r.clave === 'descripcion-corta')).toBe(true);
  });

  it('flags sin-amenidades when the list is empty, except for terreno', () => {
    const casa = evaluarPropiedad(mkProperty({ tipo: 'casa', amenidades: [] }), 'activa');
    expect(casa.some((r) => r.clave === 'sin-amenidades')).toBe(true);

    const terreno = evaluarPropiedad(mkProperty({ tipo: 'terreno', amenidades: [] }), 'activa');
    expect(terreno.some((r) => r.clave === 'sin-amenidades')).toBe(false);
  });

  it('flags estancada only for activa (not pausada) at 60+ days since publication', () => {
    const oldDate = new Date(Date.now() - 61 * 86_400_000).toISOString();
    const activa = evaluarPropiedad(mkProperty({ fechaPublicacion: oldDate }), 'activa');
    expect(activa.some((r) => r.clave === 'estancada')).toBe(true);

    const pausada = evaluarPropiedad(mkProperty({ fechaPublicacion: oldDate }), 'pausada');
    expect(pausada.some((r) => r.clave === 'estancada')).toBe(false);
  });

  it('does not flag estancada for a recently published listing', () => {
    const recent = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const result = evaluarPropiedad(mkProperty({ fechaPublicacion: recent }), 'activa');
    expect(result.some((r) => r.clave === 'estancada')).toBe(false);
  });

  it('can return multiple reasons at once for a genuinely incomplete listing', () => {
    const result = evaluarPropiedad(mkProperty({ fotos: [], descripcion: 'corta', amenidades: [] }), 'activa');
    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});

describe('evaluarCartera', () => {
  it('filters out properties with zero reasons, keeps only those that need attention', () => {
    const healthy = mkMiPropiedad({ id: 'prop-healthy' });
    const needsWork = mkMiPropiedad({ id: 'prop-needs-work', fotos: [] });
    const result = evaluarCartera([healthy, needsWork]);
    expect(result).toHaveLength(1);
    expect(result[0].propiedad.property.id).toBe(needsWork.property.id);
  });

  it('returns an empty array when the whole portfolio is healthy', () => {
    expect(evaluarCartera([mkMiPropiedad(), mkMiPropiedad()])).toEqual([]);
  });
});
