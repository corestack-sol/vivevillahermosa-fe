import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buscarIA, agruparRespuestaIA, type RespuestaBuscarIA, type PropiedadConCoincidencia } from './buscarIA';
import { backendFetch } from '@/lib/backendApi';
import type { BackendPublicProperty } from '@/lib/api';

vi.mock('@/lib/backendApi', () => ({
  backendFetch: vi.fn(),
  BackendApiError: class BackendApiError extends Error {
    constructor(public status: number, public body: unknown) {
      super('mock error');
    }
  },
}));

function propiedad(id: string, overrides: Partial<BackendPublicProperty> = {}): BackendPublicProperty {
  return {
    id,
    slug: `slug-${id}`,
    titulo: `Propiedad ${id}`,
    descripcion: 'desc',
    tipo: 'casa',
    operacion: 'venta',
    precio: 100000,
    m2Construidos: 80,
    m2Terreno: 100,
    recamaras: 2,
    banos: 1,
    mediosBanos: 0,
    estacionamientos: 1,
    antiguedad: 0,
    amenidades: [],
    servicios: [],
    fotos: [],
    municipio: 'Centro',
    colonia: 'Reforma',
    direccion: 'Calle 1',
    latPublico: 17.98,
    lngPublico: -92.93,
    riesgoInundacion: 'bajo',
    zonaEcologica: false,
    cercaDosoBocas: false,
    featured: false,
    featuredHasta: null,
    estado: 'activa',
    activa: true,
    agente: { nombre: 'Agente', foto: null, verificado: false, enRevision: false },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function match(id: string, tipoCoincidencia: string, score = 10): PropiedadConCoincidencia {
  return { propiedad: propiedad(id), score, tipoCoincidencia, razones: [], faltantes: [] };
}

function respuesta(overrides: Partial<RespuestaBuscarIA> = {}): RespuestaBuscarIA {
  return {
    filtros: {},
    fueraDeCobertura: false,
    coberturaIncierta: false,
    modo: 'exacta',
    totalExactas: 0,
    totalParciales: 0,
    resultados: [],
    parciales: [],
    clasificacion: { requeridos: {}, preferidos: {}, orden: {} },
    ...overrides,
  };
}

describe('agruparRespuestaIA', () => {
  it('usa resultados como principal cuando no está vacío, y arma secundario con lo que sobra', () => {
    const data = respuesta({
      resultados: [match('a', 'EXACTA')],
      parciales: [match('a', 'EXACTA'), match('b', 'PARCIAL'), match('c', 'PARCIAL')],
    });
    const { principal, secundario } = agruparRespuestaIA(data);
    expect(principal.map((r) => r.propiedad.id)).toEqual(['a']);
    // 'a' ya está en principal — no se duplica en secundario.
    expect(secundario.map((r) => r.propiedad.id)).toEqual(['b', 'c']);
  });

  it('cae a altamenteRelevantes cuando resultados viene vacío', () => {
    const data = respuesta({
      resultados: [],
      altamenteRelevantes: [match('x', 'ALTAMENTE_RELEVANTE')],
      parciales: [match('y', 'PARCIAL')],
    });
    const { principal, secundario } = agruparRespuestaIA(data);
    expect(principal.map((r) => r.propiedad.id)).toEqual(['x']);
    expect(secundario.map((r) => r.propiedad.id)).toEqual(['y']);
  });

  it('cae a parciales cuando resultados y altamenteRelevantes vienen vacíos', () => {
    const data = respuesta({ resultados: [], parciales: [match('z', 'PARCIAL')] });
    const { principal, secundario } = agruparRespuestaIA(data);
    expect(principal.map((r) => r.propiedad.id)).toEqual(['z']);
    expect(secundario).toEqual([]);
  });

  it('secundario queda vacío cuando modo=parcial hace que resultados y parciales sean el mismo arreglo', () => {
    const parciales = [match('a', 'PARCIAL'), match('b', 'PARCIAL')];
    const data = respuesta({ modo: 'parcial', resultados: parciales, parciales });
    const { principal, secundario } = agruparRespuestaIA(data);
    expect(principal.map((r) => r.propiedad.id)).toEqual(['a', 'b']);
    expect(secundario).toEqual([]);
  });

  it('sin resultados en ningún grupo devuelve ambos vacíos', () => {
    const { principal, secundario } = agruparRespuestaIA(respuesta());
    expect(principal).toEqual([]);
    expect(secundario).toEqual([]);
  });
});

describe('buscarIA', () => {
  const mockFetch = vi.mocked(backendFetch);

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('éxito: mapea resultados a Property conservando el orden exacto del backend', async () => {
    mockFetch.mockResolvedValue(respuesta({
      modo: 'exacta',
      totalExactas: 2,
      resultados: [match('b', 'EXACTA', 90), match('a', 'EXACTA', 80)],
    }));
    const r = await buscarIA('casas baratas de 3 recámaras cerca del centro');
    expect(r.propiedades.map((p) => p.id)).toEqual(['b', 'a']);
    expect(r.fueraDeCobertura).toBe(false);
  });

  it('vacíos: modo sin-resultados devuelve arreglos vacíos, sin inventar propiedades', async () => {
    mockFetch.mockResolvedValue(respuesta({ modo: 'sin-resultados' }));
    const r = await buscarIA('palacio flotante con helipuerto en la luna');
    expect(r.propiedades).toEqual([]);
    expect(r.todoLoDemas).toEqual([]);
  });

  it('parciales: sin exactas pero con parciales, usa esos como principal', async () => {
    mockFetch.mockResolvedValue(respuesta({
      modo: 'parcial',
      totalParciales: 1,
      resultados: [match('p1', 'PARCIAL')],
      parciales: [match('p1', 'PARCIAL')],
    }));
    const r = await buscarIA('casa con 6 recamaras en Centro');
    expect(r.propiedades.map((p) => p.id)).toEqual(['p1']);
  });

  it('fueraDeCobertura: se propaga tal cual, sin resultados falsos', async () => {
    mockFetch.mockResolvedValue(respuesta({ modo: 'sin-resultados', fueraDeCobertura: true }));
    const r = await buscarIA('casas en cancun');
    expect(r.fueraDeCobertura).toBe(true);
    expect(r.propiedades).toEqual([]);
  });

  it('error: rechaza la promesa cuando el backend falla (para que el llamador haga fallback)', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    await expect(buscarIA('casas en Centro')).rejects.toThrow('network down');
  });
});
