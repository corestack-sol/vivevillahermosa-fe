'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Property } from '@/types/property';
import type { SearchFilters } from '@/types/search';
import { applyFilters } from '@/lib/filters';

const PER_PAGE = 12;

// `extraDeps` — sin esto, un filtro basado en un catálogo cargado async
// (landmarks, colonias descubiertas — ambos módulos con cache fuera de
// React, ver landmarks.ts/colonias.ts) podía correr una sola vez con el
// cache todavía vacío y nunca reevaluarse cuando el catálogo real
// terminara de cargar: `allProperties`/`filters` no cambian solo porque
// un fetch en segundo plano resolvió. Bug real reportado 2026-08-20
// ("cerca del hospital rovirosa" devolvía una propiedad a 48km" — el
// filtro corrió antes de que /landmarks cargara). Quien pase un flag de
// "catálogo listo" aquí fuerza la reevaluación en cuanto cambia.
export function useSearch(allProperties: Property[], filters: SearchFilters, extraDeps: unknown[] = []) {
  const [allFiltered, setAllFiltered] = useState<Property[]>([]);
  const [displayCount, setDisplayCount] = useState(PER_PAGE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function iniciarBusqueda() {
      setIsLoading(true);
    }
    iniciarBusqueda();
    const id = setTimeout(() => {
      const filtered = applyFilters(allProperties, filters);
      setAllFiltered(filtered);
      setDisplayCount(PER_PAGE);
      setIsLoading(false);
    }, 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProperties, filters, ...extraDeps]);

  const loadMore = useCallback(() => setDisplayCount((c) => c + PER_PAGE), []);

  const total        = allFiltered.length;
  const hasMore      = displayCount < total;
  const results      = allFiltered.slice(0, displayCount);

  return { results, allResults: allFiltered, total, hasMore, loadMore, isLoading };
}
