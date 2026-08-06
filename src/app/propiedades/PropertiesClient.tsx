'use client';

import { useState, useEffect } from 'react';
import { SlidersHorizontal, X, Map, LayoutGrid, Search, ChevronDown, Loader2 } from 'lucide-react';
import type { Property } from '@/types/property';
import type { SearchFilters } from '@/types/search';
import { useFilters } from '@/hooks/useFilters';
import { useSearch } from '@/hooks/useSearch';
import { FilterPanel } from '@/components/search/FilterPanel';
import { SortSelect } from '@/components/search/SortSelect';
import { ActiveFilters } from '@/components/search/ActiveFilters';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { MapViewDynamic } from '@/components/map/MapViewDynamic';
import { getLandmark, CATEGORIAS_GENERICAS } from '@/lib/landmarks';
import { matchColonia, precargarColoniasDescubiertas } from '@/lib/colonias';
import { interpretarBusqueda } from '@/lib/interpretarBusqueda';
import { aplicarOverridesPublicos, PROPIEDADES_LOCALES_EVENT } from '@/lib/propiedadesLocales';
import { ESTADO_OVERRIDE_EVENT } from '@/lib/estadoOverrides';
import { ExploreZonasCta } from '@/components/search/ExploreZonasCta';

const PER_PAGE = 12;

interface Props {
  allProperties: Property[];
}

const TIPO_PLURAL: Record<string, string> = {
  casa: 'Casas', departamento: 'Departamentos', terreno: 'Terrenos',
  local: 'Locales', oficina: 'Oficinas', bodega: 'Bodegas', habitacion: 'Habitaciones',
};

function buildTitle(filters: SearchFilters): string {
  const tipo  = filters.tipo ? (TIPO_PLURAL[filters.tipo] ?? 'Propiedades') : 'Propiedades';
  const op    = filters.operacion === 'venta' ? 'en venta'
    : filters.operacion === 'renta' ? 'en renta' : '';
  const landmark = filters.landmark ? getLandmark(filters.landmark) : undefined;
  const categoria = !landmark && filters.categoriaLandmark
    ? CATEGORIAS_GENERICAS.find((c) => c.value === filters.categoriaLandmark)
    : undefined;
  const coloniaResuelta = !landmark && !categoria && filters.colonia ? matchColonia(filters.colonia) : undefined;
  const lugar = landmark
    ? `cerca de ${landmark.label}`
    : categoria
      ? `cerca de ${categoria.label}`
      : coloniaResuelta
        ? `cerca de ${coloniaResuelta.label}`
        : filters.colonia
          ? `en ${filters.colonia}`
          : filters.municipio
            ? `en ${filters.municipio === 'Centro' ? 'Villahermosa' : filters.municipio}`
            : 'en Tabasco';
  return [tipo, op, lugar].filter(Boolean).join(' ');
}

export function PropertiesClient({ allProperties }: Props) {
  const { filters, updateFilters, clearFilters, activeCount } = useFilters();
  // Arranca con el catálogo estático que ya vino del servidor (para que el
  // primer render coincida con el de SSR) y se completa con lo publicado/
  // editado/pausado/eliminado en este navegador justo después de montar —
  // localStorage no existe en el servidor, así que no se puede resolver
  // antes. Sin este merge, publicar una propiedad nunca la hacía aparecer
  // aquí, ni para otros usuarios ni para quien la acababa de publicar.
  // ⚠️ BACKEND: deja de hacer falta con `GET /api/propiedades` real — ver
  // el comentario de aplicarOverridesPublicos en propiedadesLocales.ts.
  const [properties, setProperties] = useState(allProperties);
  const { results, allResults, total, hasMore, loadMore, isLoading } = useSearch(properties, filters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [buscandoIA, setBuscandoIA] = useState(false);

  // Trae las colonias descubiertas automáticamente (ver coloniaDiscovery.ts)
  // una sola vez al entrar a la página — sin esto, matchColonia/
  // buscarColoniaEnTexto solo conocerían las 70 del catálogo estático hasta
  // el próximo refresh completo. No bloquea nada: si tarda o falla, la
  // búsqueda sigue funcionando igual con lo que ya había.
  useEffect(() => { precargarColoniasDescubiertas(); }, []);

  useEffect(() => {
    function aplicarOverrides() {
      setProperties(aplicarOverridesPublicos(allProperties));
    }
    aplicarOverrides();
    window.addEventListener(PROPIEDADES_LOCALES_EVENT, aplicarOverrides);
    window.addEventListener(ESTADO_OVERRIDE_EVENT, aplicarOverrides);
    return () => {
      window.removeEventListener(PROPIEDADES_LOCALES_EVENT, aplicarOverrides);
      window.removeEventListener(ESTADO_OVERRIDE_EVENT, aplicarOverrides);
    };
  }, [allProperties]);

  // Interpreta el texto del buscador inline con IA (OpenRouter, vía
  // src/lib/interpretarBusqueda.ts) y lo fusiona sobre los filtros que ya
  // están activos — a diferencia de SearchBar.tsx (Home), aquí no se navega
  // a una página nueva, así que solo se tocan los campos que la IA sí
  // encontró; el resto de lo que el usuario ya eligió en el panel de
  // filtros se queda igual. Se dispara al presionar Enter, no en cada
  // tecleo — el filtro de texto simple (onChange de abajo) ya da feedback
  // instantáneo mientras se escribe.
  async function aplicarBusquedaIA(query: string) {
    const texto = query.trim();
    if (!texto) return;
    setBuscandoIA(true);
    const filtros = await interpretarBusqueda(texto);
    setBuscandoIA(false);

    const hayFiltros = Object.keys(filtros).length > 0;
    const updates: Partial<SearchFilters> = {};
    // Mismo criterio que SearchBar.tsx: `q` es un AND de texto literal
    // contra título/colonia/municipio/descripción — dejar la oración
    // completa junto con filtros estructurados casi siempre da cero
    // resultados, así que se limpia cuando la IA sí encontró algo.
    updates.colonia = filtros.colonia || '';
    if (filtros.colonia) updates.q = '';
    else if (!hayFiltros) updates.q = texto;
    else updates.q = '';
    if (filtros.municipio) updates.municipio = filtros.municipio;
    if (filtros.tipo) updates.tipo = filtros.tipo as SearchFilters['tipo'];
    if (filtros.operacion) updates.operacion = filtros.operacion as SearchFilters['operacion'];
    if (filtros.precioMin) updates.precioMin = filtros.precioMin;
    if (filtros.precioMax) updates.precioMax = filtros.precioMax;
    if (filtros.recamaras) updates.recamaras = filtros.recamaras;
    if (filtros.riesgoInundacion) updates.riesgoInundacion = filtros.riesgoInundacion as SearchFilters['riesgoInundacion'];
    if (filtros.cercaDosoBocas) updates.cercaDosoBocas = true;
    if (filtros.landmark) updates.landmark = filtros.landmark;
    else if (filtros.categoriaLandmark) updates.categoriaLandmark = filtros.categoriaLandmark;
    updateFilters(updates);
  }

  // Se propaga a cada tarjeta para que el enlace a la ficha lleve el mismo
  // landmark buscado — sin esto, alguien que llega a una propiedad desde
  // una búsqueda "cerca de X" no tenía ninguna forma de ver a qué distancia
  // real está, la conexión quedaba invisible en cuanto se hacía clic.
  const coloniaCercana = !filters.landmark && !filters.categoriaLandmark && filters.colonia
    ? matchColonia(filters.colonia)
    : undefined;
  const landmarkQuery = filters.landmark
    ? `?cerca=${filters.landmark}`
    : filters.categoriaLandmark
      ? `?cercaTipo=${filters.categoriaLandmark}`
      : coloniaCercana
        ? `?cercaColonia=${coloniaCercana.key}`
        : '';

  const mapMarkers = allResults.map((p) => ({
    id: p.id, slug: p.slug, lat: p.latPublico, lng: p.lngPublico,
    titulo: p.titulo, precio: p.precio, operacion: p.operacion,
    tipo: p.tipo, colonia: p.colonia, foto: p.fotos[0] ?? null,
    riesgoInundacion: p.riesgoInundacion,
  }));

  const skeletonCount = Math.min(total || PER_PAGE, PER_PAGE);

  return (
    <div className="min-h-screen bg-page">

      {/* ── Page header ── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

          {/* Row 1: title + controls */}
          <div className="flex items-start sm:items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-black text-gray-900 leading-tight truncate" style={{ letterSpacing: '-0.02em' }}>
                {buildTitle(filters)}
                {!isLoading && (
                  <span className="ml-2 text-sm font-semibold text-gray-400 align-middle">
                    ({total})
                  </span>
                )}
              </h1>
              {isLoading && (
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" /> Buscando...
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* View toggle */}
              <div className="hidden sm:flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  title="Vista cuadrícula"
                  className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  title="Vista mapa"
                  className={`p-2.5 transition-colors ${viewMode === 'map' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Map size={15} />
                </button>
              </div>

              {/* Sort */}
              <div className="hidden sm:block">
                <SortSelect value={filters.sort ?? 'relevancia'} onChange={(sort) => updateFilters({ sort })} />
              </div>

              {/* Mobile filter button */}
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-brand/40 text-gray-700 text-sm font-semibold px-3.5 py-2 rounded-xl shadow-sm transition-colors relative"
              >
                <SlidersHorizontal size={14} />
                Filtros
                {activeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-brand text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: Inline search */}
          <form
            className="relative mb-3"
            onSubmit={(e) => { e.preventDefault(); aplicarBusquedaIA(filters.q ?? ''); }}
          >
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={filters.q ?? ''}
              onChange={(e) => updateFilters({ q: e.target.value })}
              placeholder="Buscar por colonia, municipio... o descríbelo y presiona Enter"
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand focus:bg-white transition-colors placeholder-gray-400 text-gray-800"
            />
            {buscandoIA ? (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand animate-spin" />
            ) : filters.q && (
              <button
                type="button"
                onClick={() => updateFilters({ q: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </form>

          {/* Row 3: Active filters */}
          <ActiveFilters filters={filters} onUpdate={updateFilters} onClear={clearFilters} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex gap-5">

          {/* ── Sidebar (grid mode only) ── */}
          {viewMode === 'grid' && (
            <aside className="hidden lg:block w-68 flex-shrink-0" style={{ width: 272 }}>
              <div className="sticky top-24">
                <div className="bg-brand-dark rounded-2xl shadow-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-white/10">
                    <SlidersHorizontal size={14} className="text-white/50" />
                    <span className="text-sm font-bold text-white">Filtros</span>
                    {activeCount > 0 && (
                      <span className="bg-white/15 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                        {activeCount}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <FilterPanel
                      filters={filters}
                      onUpdate={updateFilters}
                      onClear={clearFilters}
                      activeCount={activeCount}
                      total={total}
                    />
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* ── Main content ── */}
          <main className="flex-1 min-w-0">

            {/* Mobile sort */}
            <div className="flex items-center justify-between mb-3 sm:hidden">
              <span className="text-xs text-gray-500 font-medium">{total} resultado{total !== 1 ? 's' : ''}</span>
              <SortSelect value={filters.sort ?? 'relevancia'} onChange={(sort) => updateFilters({ sort })} />
            </div>

            {/* Map view */}
            {viewMode === 'map' && (
              <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 'calc(100vh - 260px)', minHeight: 400 }}>
                {mapMarkers.length > 0 ? (
                  <MapViewDynamic
                    markers={mapMarkers}
                    center={[17.9869, -92.9303]}
                    zoom={11}
                  />
                ) : (
                  <div className="w-full h-full bg-white flex flex-col items-center justify-center text-gray-400">
                    <Map size={40} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium">Sin propiedades en el mapa</p>
                    <p className="text-xs mt-1">Ajusta los filtros para ver resultados</p>
                  </div>
                )}
              </div>
            )}

            {/* Grid view */}
            {viewMode === 'grid' && (
              <>
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: skeletonCount }).map((_, i) => (
                      <Skeleton key={i} variant="card" />
                    ))}
                  </div>
                ) : results.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-16 px-6">
                    <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                      <Search size={28} className="text-gray-300" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-heading font-bold text-gray-800 text-lg mb-2 text-center">Sin resultados</h3>
                    <p className="text-gray-400 text-sm mb-2 max-w-sm leading-relaxed text-center">
                      No encontramos propiedades con esos filtros.
                    </p>
                    <button onClick={clearFilters}
                      className="text-brand font-semibold text-sm hover:underline mb-8">
                      Quitar filtros
                    </button>
                    <div className="w-full max-w-lg">
                      <ExploreZonasCta />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {results.map((p) => (
                        <PropertyCard key={p.id} property={p} landmarkQuery={landmarkQuery} />
                      ))}
                    </div>

                    {/* Load more */}
                    {hasMore && (
                      <div className="mt-8 flex flex-col items-center gap-2">
                        <button
                          onClick={loadMore}
                          className="flex items-center gap-2 bg-white hover:bg-brand-pale border-2 border-gray-200 hover:border-brand/40 text-gray-700 hover:text-brand font-semibold text-sm px-8 py-3 rounded-2xl transition-all shadow-sm"
                        >
                          <ChevronDown size={16} />
                          Cargar {Math.min(12, total - results.length)} propiedades más
                        </button>
                        <p className="text-xs text-gray-400">
                          Mostrando {results.length} de {total}
                        </p>
                      </div>
                    )}

                    {!hasMore && results.length > 0 && total > 12 && (
                      <p className="mt-8 text-center text-xs text-gray-400">
                        Has visto todas las {total} propiedades
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* ── Mobile filter drawer ── */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[90vw] bg-brand-dark overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <div>
                <h2 className="font-heading font-bold text-white">Filtrar propiedades</h2>
                {activeCount > 0 && (
                  <p className="text-sm text-white/45 mt-0.5">{activeCount} filtro{activeCount > 1 ? 's' : ''} activo{activeCount > 1 ? 's' : ''}</p>
                )}
              </div>
              <button onClick={() => setMobileFiltersOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <X size={16} className="text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <FilterPanel
                filters={filters}
                onUpdate={updateFilters}
                onClear={clearFilters}
                activeCount={activeCount}
                total={total}
              />
            </div>
            <div className="flex-shrink-0 p-4 border-t border-white/10 bg-brand-dark">
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full bg-white hover:bg-white/90 text-brand-dark font-bold py-3.5 rounded-2xl transition-colors text-sm"
              >
                {total === 0
                  ? 'Sin resultados — cambiar filtros'
                  : `Ver ${total} propiedad${total !== 1 ? 'es' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
