'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Property } from '@/types/property';
import type { SearchFilters } from '@/types/search';
import { applyFilters } from '@/lib/filters';

const PER_PAGE = 12;

export function useSearch(allProperties: Property[], filters: SearchFilters) {
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
  }, [allProperties, filters]);

  const loadMore = useCallback(() => setDisplayCount((c) => c + PER_PAGE), []);

  const total        = allFiltered.length;
  const hasMore      = displayCount < total;
  const results      = allFiltered.slice(0, displayCount);

  return { results, allResults: allFiltered, total, hasMore, loadMore, isLoading };
}
