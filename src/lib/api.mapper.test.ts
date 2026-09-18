import { describe, it, expect } from 'vitest';
import { mapBackendProperty, type BackendPublicProperty } from './api';

function base(over: Partial<BackendPublicProperty> = {}): BackendPublicProperty {
  return {
    id: 'p1', slug: 'casa-en-centro', titulo: 'Casa', descripcion: 'Desc',
    tipo: 'casa', operacion: 'venta', precio: 1_500_000,
    m2Construidos: 120, m2Terreno: 200, recamaras: 3, banos: 2, mediosBanos: 1,
    estacionamientos: 2, antiguedad: 5,
    amenidades: ['alberca'], servicios: ['agua'], fotos: ['a.jpg'],
    municipio: 'Centro', colonia: 'Tabasco 2000', direccion: 'Calle 1',
    latPublico: 17.99, lngPublico: -92.93,
    riesgoInundacion: 'bajo', zonaEcologica: false, cercaDosoBocas: false,
    featured: false, featuredHasta: null, estado: 'activa', activa: true,
    agente: { nombre: 'Ana', foto: null, verificado: true, enRevision: false },
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
    ...over,
  };
}

describe('mapBackendProperty', () => {
  it('campos numéricos null del backend se vuelven 0, nunca null/NaN', () => {
    const p = mapBackendProperty(base({
      m2Construidos: null, m2Terreno: null, recamaras: null, banos: null,
      mediosBanos: null, estacionamientos: null, antiguedad: null,
    }));
    expect([p.m2Construidos, p.m2Terreno, p.recamaras, p.banos, p.mediosBanos, p.estacionamientos, p.antiguedad])
      .toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('un 0 real del backend se conserva (no lo confunde con "sin dato")', () => {
    expect(mapBackendProperty(base({ recamaras: 0, antiguedad: 0 })).recamaras).toBe(0);
  });

  it('vista pública: lat/lng caen al punto público (nunca más preciso)', () => {
    const p = mapBackendProperty(base({ lat: undefined, lng: undefined }));
    expect(p.lat).toBe(17.99);
    expect(p.lng).toBe(-92.93);
  });

  it('vista del dueño: lat/lng reales ganan sobre el punto público', () => {
    const p = mapBackendProperty(base({ lat: 18.0012, lng: -92.9301 }));
    expect(p.lat).toBe(18.0012);
    expect(p.lng).toBe(-92.9301);
    expect(p.latPublico).toBe(17.99);
  });

  it('lat 0 real del dueño no se descarta por ser "falsy"', () => {
    expect(mapBackendProperty(base({ lat: 0, lng: 0 })).lat).toBe(0);
  });

  it('agente sin foto usa cadena vacía; contactos null quedan undefined', () => {
    const p = mapBackendProperty(base({ agenteTel: null, agenteEmail: null, agenteWhatsapp: null }));
    expect(p.agente.foto).toBe('');
    expect(p.agente.tel).toBeUndefined();
    expect(p.agente.email).toBeUndefined();
    expect(p.agente.whatsapp).toBeUndefined();
  });

  it('alertaFraude null se vuelve undefined; con señales se conserva', () => {
    expect(mapBackendProperty(base({ alertaFraude: null })).alertaFraude).toBeUndefined();
    expect(mapBackendProperty(base({ alertaFraude: { señales: ['precio bajo'] } })).alertaFraude)
      .toEqual({ señales: ['precio bajo'] });
  });

  it('featuredHasta se pasa tal cual (null cuando no está destacada)', () => {
    expect(mapBackendProperty(base()).featuredHasta).toBeNull();
    expect(mapBackendProperty(base({ featured: true, featuredHasta: '2026-10-01T00:00:00.000Z' })).featuredHasta)
      .toBe('2026-10-01T00:00:00.000Z');
  });

  it('moneda siempre MXN y fechaPublicacion sale de createdAt', () => {
    const p = mapBackendProperty(base());
    expect(p.moneda).toBe('MXN');
    expect(p.fechaPublicacion).toBe('2026-09-01T00:00:00.000Z');
  });

  it('propiedad sin fotos no rompe el mapeo (arreglo vacío)', () => {
    expect(mapBackendProperty(base({ fotos: [] })).fotos).toEqual([]);
  });
});
