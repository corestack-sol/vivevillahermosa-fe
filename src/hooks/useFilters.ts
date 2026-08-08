'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { SearchFilters, SortOption } from '@/types/search';
import type { PropertyType, OperationType, FloodRisk } from '@/types/property';

function buildQuery(filters: SearchFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.operacion) params.set('operacion', filters.operacion);
  if (filters.municipio) params.set('municipio', filters.municipio);
  if (filters.colonia) params.set('colonia', filters.colonia);
  if (filters.precioMin) params.set('precioMin', String(filters.precioMin));
  if (filters.precioMax) params.set('precioMax', String(filters.precioMax));
  if (filters.recamaras) params.set('recamaras', String(filters.recamaras));
  if (filters.recamarasMax) params.set('recamarasMax', String(filters.recamarasMax));
  if (filters.banos) params.set('banos', String(filters.banos));
  if (filters.m2Min) params.set('m2Min', String(filters.m2Min));
  if (filters.m2Max) params.set('m2Max', String(filters.m2Max));
  if (filters.amenidad) params.set('amenidad', filters.amenidad);
  if (filters.riesgoInundacion) params.set('riesgo', filters.riesgoInundacion);
  if (filters.cercaDosoBocas) params.set('dosabocas', '1');
  if (filters.landmark) params.set('cerca', filters.landmark);
  if (filters.categoriaLandmark) params.set('cercaTipo', filters.categoriaLandmark);
  if (filters.zonaDestacada) params.set('zona', filters.zonaDestacada);
  if (filters.sort && filters.sort !== 'relevancia') params.set('sort', filters.sort);
  if (filters.limite) params.set('limite', String(filters.limite));
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}

export function parseFiltersFromSearchParams(params: URLSearchParams): SearchFilters {
  return {
    q: params.get('q') ?? '',
    tipo: (params.get('tipo') as PropertyType) ?? '',
    operacion: (params.get('operacion') as OperationType) ?? '',
    municipio: params.get('municipio') ?? '',
    colonia: params.get('colonia') ?? '',
    precioMin: Number(params.get('precioMin')) || 0,
    precioMax: Number(params.get('precioMax')) || 0,
    recamaras: Number(params.get('recamaras')) || 0,
    recamarasMax: Number(params.get('recamarasMax')) || 0,
    banos: Number(params.get('banos')) || 0,
    m2Min: Number(params.get('m2Min')) || 0,
    m2Max: Number(params.get('m2Max')) || 0,
    amenidad: params.get('amenidad') ?? '',
    riesgoInundacion: (params.get('riesgo') as FloodRisk) ?? '',
    cercaDosoBocas: params.get('dosabocas') === '1',
    landmark: params.get('cerca') ?? '',
    categoriaLandmark: params.get('cercaTipo') ?? '',
    zonaDestacada: params.get('zona') ?? '',
    sort: (params.get('sort') as SortOption) ?? 'relevancia',
    limite: Number(params.get('limite')) || 0,
    page: Number(params.get('page')) || 1,
  };
}

export function useFilters(initialFilters?: SearchFilters) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<SearchFilters>(
    initialFilters ?? parseFiltersFromSearchParams(searchParams)
  );

  useEffect(() => {
    function sincronizarDesdeUrl() {
      if (!initialFilters) {
        setFilters(parseFiltersFromSearchParams(searchParams));
      }
    }
    sincronizarDesdeUrl();
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilters = useCallback(
    (updates: Partial<SearchFilters>) => {
      const next = { ...filters, ...updates, page: 1 };
      setFilters(next);
      const query = buildQuery(next);
      router.push(`${pathname}?${query}`);
    },
    [filters, pathname, router]
  );

  const clearFilters = useCallback(() => {
    const empty: SearchFilters = { sort: 'relevancia', page: 1 };
    setFilters(empty);
    router.push(pathname);
  }, [pathname, router]);

  const activeCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'sort' || key === 'page') return false;
    return val !== '' && val !== 0 && val !== false && val !== undefined;
  }).length;

  return { filters, updateFilters, clearFilters, activeCount };
}
