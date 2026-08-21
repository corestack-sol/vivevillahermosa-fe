'use client';

import type { Property } from '@/types/property';
import type { SearchFilters } from '@/types/search';
import { applyFilters } from '@/lib/filters';

// Sin memoizar a propósito (antes intentaba useMemo con extraDeps de
// spread, pero react-hooks/use-memo exige un array literal — no acepta
// [...extraDeps], a diferencia de useEffect en useSearch.ts). Este hook no
// tiene ningún caller todavía, así que no hay presión de rendimiento real
// que justifique pelear con esa regla; recalcular en cada render es
// correcto y simple.
//
// Ojo si se conecta: `applyFilters` (filters.ts) puede leer landmarksCache/
// coloniasDescubiertasCache (landmarks.ts/colonias.ts), variables de
// módulo llenadas por un fetch fire-and-forget — el caller es quien debe
// disparar precargarLandmarks()/precargarColoniasDescubiertas() y
// re-renderizar cuando resuelvan (ver el patrón landmarksReady/
// coloniasReady ya establecido en PropertiesClient.tsx/MapaClient.tsx), o
// un filtro "cerca de X"/"colonia" corriendo aquí con el catálogo todavía
// vacío se queda fijo (mismo bug real corregido 2026-08-20).
export function useMapMarkers(allProperties: Property[], filters?: SearchFilters) {
  const props = filters ? applyFilters(allProperties, filters) : allProperties;
  return props.map((p) => ({
    id: p.id,
    slug: p.slug,
    lat: p.latPublico,
    lng: p.lngPublico,
    titulo: p.titulo,
    precio: p.precio,
    operacion: p.operacion,
    tipo: p.tipo,
    colonia: p.colonia,
    foto: p.fotos[0] ?? null,
    riesgoInundacion: p.riesgoInundacion,
  }));
}
