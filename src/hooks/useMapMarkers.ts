'use client';

import { useMemo } from 'react';
import type { Property } from '@/types/property';
import type { SearchFilters } from '@/types/search';
import { applyFilters } from '@/lib/filters';

export function useMapMarkers(allProperties: Property[], filters?: SearchFilters) {
  const markers = useMemo(() => {
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
  }, [allProperties, filters]);

  return markers;
}
