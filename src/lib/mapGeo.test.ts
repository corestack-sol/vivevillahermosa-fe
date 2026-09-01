import { describe, it, expect } from 'vitest';
import { shortPrice, circlePolygon, toMaplibreBounds, estaEnBounds } from './mapGeo';
import { distanciaKm } from './landmarks';

describe('shortPrice', () => {
  it('millones exactos: sin decimal', () => {
    expect(shortPrice(2_000_000, 'venta')).toBe('$2M');
  });
  it('millones con residuo: 1 decimal', () => {
    expect(shortPrice(1_500_000, 'venta')).toBe('$1.5M');
  });
  it('miles: redondeado a k, sin decimales', () => {
    expect(shortPrice(7_000, 'renta')).toBe('$7k/mo');
    expect(shortPrice(7_499, 'renta')).toBe('$7k/mo');
  });
  it('menos de mil: número tal cual', () => {
    expect(shortPrice(500, 'venta')).toBe('$500');
  });
  it('renta agrega "/mo", venta no', () => {
    expect(shortPrice(928_000, 'venta')).toBe('$928k');
    expect(shortPrice(928_000, 'renta')).toBe('$928k/mo');
  });
  it('límite exacto 1,000,000: cuenta como millón, no como 1000k', () => {
    expect(shortPrice(1_000_000, 'venta')).toBe('$1M');
  });
  it('límite exacto 1,000: cuenta como k, no como el número completo', () => {
    expect(shortPrice(1_000, 'venta')).toBe('$1k');
  });
});

describe('circlePolygon', () => {
  it('devuelve un anillo cerrado (primer y último punto iguales) — requisito de GeoJSON Polygon', () => {
    const f = circlePolygon(17.9869, -92.9303, 350);
    const ring = f.geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('tiene points+1 vértices', () => {
    const f = circlePolygon(17.9869, -92.9303, 350, 8);
    expect(f.geometry.coordinates[0]).toHaveLength(9);
  });

  it('cada vértice queda a ~radiusMeters del centro (distancia real, tolerancia 5%)', () => {
    const lat = 17.9869, lng = -92.9303;
    const radiusMeters = 500;
    const f = circlePolygon(lat, lng, radiusMeters, 32);
    for (const [vLng, vLat] of f.geometry.coordinates[0]) {
      const dKm = distanciaKm(lat, lng, vLat, vLng);
      expect(dKm * 1000).toBeGreaterThan(radiusMeters * 0.95);
      expect(dKm * 1000).toBeLessThan(radiusMeters * 1.05);
    }
  });

  it('es un Feature GeoJSON válido (type/geometry.type)', () => {
    const f = circlePolygon(17.9869, -92.9303, 100);
    expect(f.type).toBe('Feature');
    expect(f.geometry.type).toBe('Polygon');
  });
});

describe('toMaplibreBounds', () => {
  it('reordena [[southLat,westLng],[northLat,eastLng]] a [[westLng,southLat],[eastLng,northLat]]', () => {
    const leaflet: [[number, number], [number, number]] = [[17.10, -94.28], [18.80, -90.84]];
    expect(toMaplibreBounds(leaflet)).toEqual([[-94.28, 17.10], [-90.84, 18.80]]);
  });
});

describe('estaEnBounds', () => {
  const bounds = { north: 18, south: 17, east: -92, west: -93 };
  it('dentro de los límites: true', () => {
    expect(estaEnBounds({ latPublico: 17.5, lngPublico: -92.5 }, bounds)).toBe(true);
  });
  it('fuera de los límites (norte): false', () => {
    expect(estaEnBounds({ latPublico: 18.5, lngPublico: -92.5 }, bounds)).toBe(false);
  });
  it('fuera de los límites (oeste): false', () => {
    expect(estaEnBounds({ latPublico: 17.5, lngPublico: -93.5 }, bounds)).toBe(false);
  });
  it('justo en el borde: inclusivo (true)', () => {
    expect(estaEnBounds({ latPublico: 18, lngPublico: -92 }, bounds)).toBe(true);
  });
});
