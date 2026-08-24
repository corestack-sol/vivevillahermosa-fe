'use client';

import { useState, useEffect, useRef } from 'react';
import type { Property } from '@/types/property';
import type { SearchFilters } from '@/types/search';
import { applyFilters } from '@/lib/filters';
import { getAllProperties, searchProperties, type PropertiesSearchParams } from '@/lib/api';
import { matchColonia } from '@/lib/colonias';
import { getLandmark } from '@/lib/landmarks';

const PER_PAGE = 12;

/**
 * Filtros que hoy NO se resuelven en el servidor (ver
 * docs/BACKEND-PROPIEDADES-PAGINACION-23082026.md §4 — zonaDestacada no se
 * reduce a un solo punto, amenidad quedó fuera a propósito de esta primera
 * pasada). Mientras alguno esté activo, se usa el camino de siempre
 * (catálogo completo, filtrado en memoria vía applyFilters) para no perder
 * precisión — más caro, pero correcto, en vez de fingir que el servidor ya
 * lo aplicó.
 */
function necesitaCatalogoCompleto(filters: SearchFilters): boolean {
  return !!(filters.categoriaLandmark || filters.zonaDestacada || filters.amenidad);
}

/**
 * Traduce SearchFilters a los parámetros que el endpoint real entiende —
 * colonia/landmark se resuelven a coordenada+radio AQUÍ, del lado del
 * cliente (únicos catálogos con esa info), nunca se manda el nombre tal
 * cual (ver docs/BACKEND-PROPIEDADES-PAGINACION-23082026.md §3). Mismo
 * orden de prioridad landmark > colonia que ya usa buildTitle() en
 * PropertiesClient.tsx.
 */
function resolverParamsServidor(filters: SearchFilters, page: number): PropertiesSearchParams {
  const params: PropertiesSearchParams = { page, limit: PER_PAGE };
  if (filters.tipo) params.tipo = filters.tipo;
  if (filters.operacion) params.operacion = filters.operacion;
  if (filters.municipio) params.municipio = filters.municipio;
  if (filters.precioMin) params.precioMin = filters.precioMin;
  if (filters.precioMax) params.precioMax = filters.precioMax;
  if (filters.recamaras) params.recamaras = filters.recamaras;
  if (filters.recamarasMax) params.recamarasMax = filters.recamarasMax;
  if (filters.banos) params.banos = filters.banos;
  if (filters.m2Min) params.m2Min = filters.m2Min;
  if (filters.m2Max) params.m2Max = filters.m2Max;
  if (filters.riesgoInundacion) params.riesgoInundacion = filters.riesgoInundacion;
  if (filters.cercaDosoBocas) params.cercaDosoBocas = true;
  // 'relevancia' es el valor por defecto de SearchFilters.sort (nunca
  // undefined, ver useFilters.ts) — no se manda tal cual: significa "sin
  // preferencia de orden explícita", que es justo cuando el backend debe
  // aplicar SU default (municipio-prioridad + destacadas, ver
  // docs/BACKEND-ORDEN-MUNICIPIO-23082026.md), no un valor de sort real.
  if (filters.sort && filters.sort !== 'relevancia') params.sort = filters.sort;

  if (filters.landmark) {
    const landmark = getLandmark(filters.landmark);
    if (landmark) { params.nearLat = landmark.lat; params.nearLng = landmark.lng; params.nearRadiusKm = landmark.radioKm; }
  } else if (filters.colonia) {
    const coord = matchColonia(filters.colonia, filters.municipio);
    if (coord) { params.nearLat = coord.lat; params.nearLng = coord.lng; params.nearRadiusKm = coord.radioKm; }
    // No catalogada — mismo fallback que filters.ts: texto libre.
    else params.q = filters.colonia;
  }
  if (filters.q && !params.q) params.q = filters.q;

  return params;
}

/**
 * `extraDeps` — mismo motivo que antes: un filtro basado en un catálogo
 * cargado async (landmarks, colonias descubiertas) puede correr con el
 * cache todavía vacío; quien pase un flag de "catálogo listo" fuerza la
 * reevaluación en cuanto cambia.
 *
 * ⚠️ 2026-08-23: dejó de tomar `allProperties` como primer parámetro — ya
 * no se filtra en memoria un catálogo pre-cargado, se pide al servidor
 * (paginado, con los filtros que sí entiende) salvo que
 * `necesitaCatalogoCompleto()` diga lo contrario. Ver
 * docs/BACKEND-PROPIEDADES-PAGINACION-23082026.md.
 *
 * `initial` — opcional, para sembrar el primer render con lo que ya vino
 * del servidor (page.tsx, SSR) y no arrancar con la grilla vacía/skeleton
 * mientras se resuelve el primer fetch del efecto de abajo (que corre
 * igual, siempre — esto solo evita el parpadeo de los primeros ~150-300ms
 * en la visita SIN filtros activos, que es el caso común).
 */
export function useSearch(filters: SearchFilters, extraDeps: unknown[] = [], initial?: { results: Property[]; total: number }) {
  const [results, setResults] = useState<Property[]>(initial?.results ?? []);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Solo para el modo "catálogo completo" — el resultado filtrado ya
  // completo se guarda aquí para que loadMore corte una porción más
  // grande sin pedir nada de nuevo (sigue siendo 100% en memoria en ese modo).
  const loadMoreCatalogoRef = useRef<Property[]>([]);

  const modoCompleto = necesitaCatalogoCompleto(filters);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const id = ++requestIdRef.current;

    async function buscar() {
      setIsLoading(true);
      if (modoCompleto) {
        const catalogo = await getAllProperties().catch(() => [] as Property[]);
        if (requestIdRef.current !== id) return;
        const filtrado = applyFilters(catalogo, filters);
        setResults(filtrado.slice(0, PER_PAGE));
        setTotal(filtrado.length);
        // Guarda el catálogo filtrado completo en un ref para que loadMore
        // no tenga que volver a pedirlo — ver loadMoreCatalogoRef abajo.
        loadMoreCatalogoRef.current = filtrado;
      } else {
        const { properties, total: t } = await searchProperties(resolverParamsServidor(filters, 1))
          .catch(() => ({ properties: [] as Property[], total: 0 }));
        if (requestIdRef.current !== id) return;
        setResults(properties);
        setTotal(t);
      }
      setPage(1);
      if (requestIdRef.current === id) setIsLoading(false);
    }

    // Debounce corto — evita disparar una llamada por cada clic cuando se
    // togglean varios filtros seguidos muy rápido (checkboxes, chips).
    debounceRef.current = setTimeout(buscar, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, modoCompleto, ...extraDeps]);

  async function loadMore() {
    if (modoCompleto) {
      const nextCount = results.length + PER_PAGE;
      setResults(loadMoreCatalogoRef.current.slice(0, nextCount));
      return;
    }
    const nextPage = page + 1;
    setIsLoadingMore(true);
    const id = ++requestIdRef.current;
    const { properties } = await searchProperties(resolverParamsServidor(filters, nextPage))
      .catch(() => ({ properties: [] as Property[], total }));
    if (requestIdRef.current === id) {
      setResults((prev) => [...prev, ...properties]);
      setPage(nextPage);
    }
    setIsLoadingMore(false);
  }

  return {
    results,
    // `allResults` — antes era "todo lo que cumple el filtro" (catálogo
    // completo ya filtrado); ahora, en modo servidor, es solo lo YA
    // TRAÍDO (la página actual + lo acumulado por loadMore). Usado por
    // PropertiesClient.tsx para el mapa embebido y "Todo lo demás" —
    // ambos simplificados a propósito para operar sobre esto, ver el doc.
    allResults: results,
    total,
    hasMore: results.length < total,
    loadMore,
    isLoading: isLoading || isLoadingMore,
  };
}
