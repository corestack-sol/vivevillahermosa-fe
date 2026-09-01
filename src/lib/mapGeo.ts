import type { MapBounds } from '@/components/map/MapView';

/**
 * Lógica pura de geometría/formato compartida por MapView.tsx y
 * MapPicker.tsx — extraída para poder probarla sin montar MapLibre GL
 * (que necesita `window`/WebGL, no disponible en el entorno de test de
 * este repo). Migración Leaflet → MapLibre GL, 2026-09-02.
 */

/** "$928k", "$1.5M", "$7k/mo" — mismo formato compacto que ya usaban los pines de Leaflet. */
export function shortPrice(precio: number, operacion: 'venta' | 'renta'): string {
  let s: string;
  if (precio >= 1_000_000)      s = `$${(precio / 1_000_000).toFixed(precio % 1_000_000 === 0 ? 0 : 1)}M`;
  else if (precio >= 1_000)     s = `$${Math.round(precio / 1_000)}k`;
  else                          s = `$${precio}`;
  return operacion === 'renta' ? `${s}/mo` : s;
}

/**
 * Polígono aproximado de un círculo real (metros) — MapLibre no tiene un
 * primitivo "círculo por radio" como `L.circle` de Leaflet, solo capas
 * GeoJSON. Aproximación estándar de grados-por-metro (suficiente para
 * radios de unos cientos de metros, que es todo lo que se dibuja — zona
 * aproximada de privacidad y radio de búsqueda).
 */
export function circlePolygon(lat: number, lng: number, radiusMeters: number, points = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const distLng = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const distLat = radiusMeters / 110_540;
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    coords.push([lng + distLng * Math.cos(theta), lat + distLat * Math.sin(theta)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/**
 * TABASCO_BOUNDS (tabascoBoundary.ts) está en formato Leaflet
 * `[[southLat,westLng],[northLat,eastLng]]` — MapLibre pide
 * `[[west,south],[east,north]]` (orden lng,lat). Mismo dato, solo
 * reordenado — con esto en un solo lugar, MapView.tsx y MapPicker.tsx ya
 * no repiten la misma conversión cada uno por su cuenta.
 */
export function toMaplibreBounds(leafletBounds: readonly [readonly [number, number], readonly [number, number]]): [[number, number], [number, number]] {
  return [
    [leafletBounds[0][1], leafletBounds[0][0]],
    [leafletBounds[1][1], leafletBounds[1][0]],
  ];
}

/**
 * Filtra por el punto PÚBLICO de cada propiedad (latPublico/lngPublico),
 * nunca por lat/lng real — MapaClient.tsx (/mapa) la usa para que el
 * conteo "N propiedades en esta zona" coincida exactamente con los pines
 * que en verdad se dibujan (que también usan el punto público).
 */
export function estaEnBounds(p: { latPublico: number; lngPublico: number }, b: MapBounds): boolean {
  return p.latPublico >= b.south && p.latPublico <= b.north && p.lngPublico >= b.west && p.lngPublico <= b.east;
}
