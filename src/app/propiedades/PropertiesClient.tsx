'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X, Map, LayoutGrid, Search, ChevronDown, Loader2, Sparkles, MapPin, Clock, Info } from 'lucide-react';
import type { Property, PropertyType, OperationType } from '@/types/property';
import type { SearchFilters } from '@/types/search';
import { useFilters } from '@/hooks/useFilters';
import { useSearch } from '@/hooks/useSearch';
import { FilterPanel } from '@/components/search/FilterPanel';
import { SortSelect } from '@/components/search/SortSelect';
import { ActiveFilters } from '@/components/search/ActiveFilters';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { MapViewDynamic } from '@/components/map/MapViewDynamic';
import { SelectedPropertyCard } from '@/components/map/SelectedPropertyCard';
import type { MapMarker } from '@/components/map/MapView';
import { getLandmark, CATEGORIAS_GENERICAS, precargarLandmarks } from '@/lib/landmarks';
import { matchColonia, precargarColoniasDescubiertas } from '@/lib/colonias';
import { interpretarBusqueda, esOracionLarga, MAX_QUERY_LENGTH } from '@/lib/interpretarBusqueda';
import { getResultadosSimilares } from '@/lib/filters';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/recentSearches';
import { ExploreZonasCta } from '@/components/search/ExploreZonasCta';
import { BUSQUEDA_SIN_INTERPRETAR_KEY } from '@/components/search/SearchBar';
import { useToast } from '@/context/ToastContext';
import { PROPERTY_GRID_CLASSES } from '@/lib/gridClasses';

const PER_PAGE = 12;

interface Props {
  allProperties: Property[];
}

const TIPO_PLURAL: Record<string, string> = {
  casa: 'Casas', departamento: 'Departamentos', terreno: 'Terrenos',
  local: 'Locales', oficina: 'Oficinas', bodega: 'Bodegas', habitacion: 'Habitaciones',
};

// Chips de filtro rápido para el modo mapa — pedido explícito 2026-08-17.
// En modo mapa el <aside> con FilterPanel se oculta por completo (línea
// ~526, "viewMode === 'grid'"), así que sin esto no había NINGUNA forma de
// cambiar de filtro sin volver a modo lista primero. Mismos chips/mismos
// tipos que ya usa /mapa (MapaClient.tsx) para que el patrón se sienta
// igual en toda la plataforma.
const MAP_TYPE_CHIPS: { value: PropertyType | ''; label: string }[] = [
  { value: '',             label: 'Todos'    },
  { value: 'casa',         label: 'Casa'     },
  { value: 'departamento', label: 'Depto'    },
  { value: 'terreno',      label: 'Terreno'  },
  { value: 'local',        label: 'Local'    },
  { value: 'habitacion',   label: 'Habitación' },
];

const MAP_OP_CHIPS: { value: OperationType | ''; label: string }[] = [
  { value: '',       label: 'Todo'   },
  { value: 'venta',  label: 'Venta'  },
  { value: 'renta',  label: 'Renta'  },
];

// Detecta, mientras el usuario todavía está escribiendo (antes de someter
// la búsqueda), que lo que hay en `q` es una oración larga en vez de un
// término corto — mismo umbral que `esOracionLarga` (interpretarBusqueda.ts),
// aplicado al filtro ya activo en vez de al texto que se está por interpretar.
function esBusquedaSinInterpretar(filters: SearchFilters): boolean {
  if (!filters.q) return false;
  return esOracionLarga(filters.q);
}

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

// "sort" (manual o extraído por la IA, ver REGLA 9 en ai.ts) ya deja la
// lista completa ordenada — pero alguien que pide "la propiedad más
// barata" (singular) espera UNA respuesta, no una lista para hojear. En
// vez de recortar la lista a 1 resultado (perdería la posibilidad de
// comparar), se destaca el primer resultado del orden pedido como tarjeta
// aparte arriba del resto — "relevancia" (el orden por defecto) no tiene
// un "primero" con significado propio, así que no aplica.
function heroLabel(sort: SearchFilters['sort']): string | null {
  switch (sort) {
    case 'precio-asc':  return 'El precio más bajo';
    case 'precio-desc': return 'El precio más alto';
    case 'reciente':    return 'Publicada más recientemente';
    case 'm2-desc':      return 'La más grande';
    case 'm2-asc':       return 'La más compacta';
    // 'colonia-asc' es un orden de agrupación, no un superlativo — no hay
    // un "primer resultado" con significado propio que destacar.
    default:             return null;
  }
}

export function PropertiesClient({ allProperties }: Props) {
  const { filters, updateFilters, clearFilters, activeCount } = useFilters();
  // Para el link "Ver en mapa" de abajo — reenvía los filtros activos tal
  // cual, sin reconstruir el query string a mano: /mapa usa el mismo
  // useFilters(), así que lee estos mismos parámetros de la URL solo.
  const searchParams = useSearchParams();
  // `allProperties` ya viene fresco del backend (ver propiedades/page.tsx)
  // — ya no hace falta fusionarlo con ninguna simulación local.
  const properties = allProperties;
  const { results, allResults, total, hasMore, loadMore, isLoading } = useSearch(properties, filters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [buscandoIA, setBuscandoIA] = useState(false);
  // Detalle del marcador seleccionado en modo mapa — antes no existía
  // ningún estado para esto, así que hacer clic en un pin no mostraba
  // nada (bug real reportado 2026-08-19). Mismo componente que /mapa.
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  // Pantalla completa al cambiar a modo mapa — pedido explícito
  // 2026-08-18, "solo para tablets y móviles". El toggle grid/mapa
  // embebido de esta página solo existe desde `sm:` (640px) — un teléfono
  // en vertical va directo a /mapa (ver el Link "Ver en mapa" más abajo,
  // sm:hidden), pero uno en horizontal ya cruza los 640px y sí ve este
  // toggle, de ahí el "(horizontal)" del pedido. pointer:coarse en vez de
  // ancho para no activarlo con mouse/trackpad en una ventana angosta de
  // escritorio. Mismo patrón (ref + Fullscreen API) que /mapa/MapaClient.tsx.
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  useEffect(() => {
    function onChange() { setIsMapFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (viewMode === 'map' && window.matchMedia('(pointer: coarse)').matches) {
      mapContainerRef.current?.requestFullscreen().catch(() => {});
    } else if (viewMode !== 'map' && document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, [viewMode]);

  function volverACuadricula() {
    if (document.fullscreenElement) document.exitFullscreen();
    setViewMode('grid');
  }
  const toast = useToast();

  // Dropdown de sugerencias/historial para el buscador inline — mismo
  // catálogo real (colonias + municipios con al menos una propiedad, para
  // nunca sugerir un lugar sin resultados) y la misma búsqueda reciente
  // (localStorage, src/lib/recentSearches.ts) que ya usa SearchBar.tsx en
  // Home. Antes este input era un <input> suelto sin ninguno de los dos.
  const [searchOpen, setSearchOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const places = useMemo(() => {
    const set = new Set<string>();
    for (const p of properties) {
      set.add(p.colonia);
      set.add(p.municipio === 'Centro' ? 'Villahermosa' : p.municipio);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [properties]);
  const q = filters.q ?? '';
  const filteredPlaces = q.length >= 2 ? places.filter((s) => s.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  const showSuggestions = searchOpen && filteredPlaces.length > 0;
  const showRecent = searchOpen && q.length < 2 && recent.length > 0;

  useEffect(() => {
    function cargarRecientes() {
      setRecent(getRecentSearches());
    }
    cargarRecientes();
  }, []);

  // Mismo motivo que en SearchBar.tsx: comparar contra el <form> completo
  // (input + dropdown), no solo el input — un mousedown sobre un botón del
  // dropdown cuenta como "clic afuera" y lo cierra antes de que el click
  // llegue a dispararse si solo se compara contra el input.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!searchFormRef.current?.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSuggestionClick(s: string) {
    // Nombre exacto de colonia/municipio del catálogo — no hace falta
    // interpretarlo con IA, mismo criterio que handleSuggestion en
    // SearchBar.tsx.
    setSearchOpen(false);
    updateFilters({ q: s });
    addRecentSearch(s);
    setRecent(getRecentSearches());
  }

  function handleRecentClick(s: string) {
    setSearchOpen(false);
    aplicarBusquedaIA(s);
  }

  function handleClearRecent(e: React.MouseEvent) {
    e.stopPropagation();
    clearRecentSearches();
    setRecent([]);
  }

  // Trae las colonias descubiertas automáticamente (ver coloniaDiscovery.ts)
  // una sola vez al entrar a la página — sin esto, matchColonia/
  // buscarColoniaEnTexto solo conocerían las 70 del catálogo estático hasta
  // el próximo refresh completo. No bloquea nada: si tarda o falla, la
  // búsqueda sigue funcionando igual con lo que ya había.
  useEffect(() => { precargarColoniasDescubiertas(); }, []);

  // Mismo patrón que arriba, pero para el catálogo de landmarks — migrado al
  // backend 2026-08-17 (docs/message.txt). Sin esto, getLandmark/
  // landmarksPorCategoria (ActiveFilters.tsx, filters.ts) se quedan con el
  // cache vacío hasta que esto cargue; no bloquea ninguna búsqueda.
  useEffect(() => { precargarLandmarks(); }, []);

  // Aviso de un solo uso cuando se llega desde el buscador de Home
  // (SearchBar.tsx) con una búsqueda que la IA no pudo interpretar en nada
  // concreto — ver BUSQUEDA_SIN_INTERPRETAR_KEY. Se limpia de inmediato para
  // que no reaparezca en un refresh ni en una futura visita a esta página.
  useEffect(() => {
    if (sessionStorage.getItem(BUSQUEDA_SIN_INTERPRETAR_KEY)) {
      sessionStorage.removeItem(BUSQUEDA_SIN_INTERPRETAR_KEY);
      toast.info('No identificamos un lugar o tipo de propiedad específico en tu búsqueda — te mostramos todas las propiedades disponibles.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    addRecentSearch(texto);
    setRecent(getRecentSearches());
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
    if (filtros.colonia) {
      updates.q = '';
    } else if (!hayFiltros) {
      // La IA no encontró NADA que extraer — no necesariamente porque algo
      // falló, sino porque la búsqueda no menciona un lugar/tipo concreto
      // ("algo bonito y espacioso"): por diseño, REGLA 1 del prompt (ai.ts)
      // nunca adivina qué colonia/landmark "cuenta" para ese tipo de frase
      // subjetiva, para no inventar datos. ("la zona de más plusvalía" ya
      // no cae aquí — REGLA 8/zonasDestacadas.ts la resuelve con un
      // catálogo curado y verificado, no una adivinanza de la IA.)
      // Dejar la oración completa como `q` en ese caso condenaba la
      // búsqueda a cero resultados (texto literal contra título/colonia/
      // descripción, que una oración natural nunca va a matchear) — se veía
      // como "la IA nunca encuentra nada" cuando en realidad sí interpretó
      // correctamente que no había nada concreto que buscar. Un término
      // corto (< 5 palabras) sigue cayendo a texto literal como antes: eso
      // sí puede coincidir de verdad con una colonia sin catalogar.
      if (esOracionLarga(texto)) {
        updates.q = '';
        toast.info('No identificamos un lugar o tipo de propiedad específico en tu búsqueda — te mostramos todas las propiedades disponibles.');
      } else {
        updates.q = texto;
      }
    } else {
      updates.q = '';
    }
    if (filtros.municipio) updates.municipio = filtros.municipio;
    if (filtros.tipo) updates.tipo = filtros.tipo as SearchFilters['tipo'];
    if (filtros.operacion) updates.operacion = filtros.operacion as SearchFilters['operacion'];
    if (filtros.precioMin) updates.precioMin = filtros.precioMin;
    if (filtros.precioMax) updates.precioMax = filtros.precioMax;
    if (filtros.recamaras) updates.recamaras = filtros.recamaras;
    if (filtros.recamarasMax) updates.recamarasMax = filtros.recamarasMax;
    if (filtros.banos) updates.banos = filtros.banos;
    if (filtros.m2Min) updates.m2Min = filtros.m2Min;
    if (filtros.m2Max) updates.m2Max = filtros.m2Max;
    if (filtros.amenidad) updates.amenidad = filtros.amenidad;
    if (filtros.riesgoInundacion) updates.riesgoInundacion = filtros.riesgoInundacion as SearchFilters['riesgoInundacion'];
    if (filtros.cercaDosoBocas) updates.cercaDosoBocas = true;
    if (filtros.landmark) updates.landmark = filtros.landmark;
    else if (filtros.categoriaLandmark) updates.categoriaLandmark = filtros.categoriaLandmark;
    if (filtros.zonaDestacada) updates.zonaDestacada = filtros.zonaDestacada;
    if (filtros.sort) updates.sort = filtros.sort as SearchFilters['sort'];
    if (filtros.limite) updates.limite = filtros.limite;
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

  // `results` ya viene ordenado por `filters.sort` (useSearch → applyFilters
  // → sortProperties) — el primero de la lista YA ES el resultado que pidió
  // "la propiedad más barata/cara/reciente/grande/compacta". Solo aplica
  // cuando la petición fue singular e IMPLÍCITA (sin número): si además dio
  // un número explícito ("las 3 más baratas", ver `limite` en ai.ts REGLA
  // 9b), ya pidió una lista de verdad, no "la mejor destacada + el resto"
  // — se muestra como grid plano de exactamente esas N, ya en el orden
  // pedido. Tampoco aplica en vista mapa.
  const etiquetaHero = !filters.limite ? heroLabel(filters.sort) : null;
  const heroProperty = etiquetaHero && viewMode === 'grid' && results.length > 0 ? results[0] : null;
  const restoResultados = heroProperty ? results.filter((p) => p.id !== heroProperty.id) : results;

  // Cuando hay una búsqueda real activa (no solo navegando el catálogo
  // completo), nunca se deja a la persona con cero resultados relacionados
  // ni con los que sí coinciden mezclados sin explicar por qué salieron —
  // se etiquetan como dos grupos: lo que sí cumple todo lo pedido
  // ("Resultados"), y lo más parecido que no cumplió todo pero sí algo
  // ("Todo lo demás"), calculado sobre el catálogo completo (`properties`),
  // no solo sobre la página ya cargada.
  // Ninguno de los dos grupos lleva la etiqueta "IA": el filtrado en sí
  // (esta función, applyFilters) es lógica determinista, no un resultado
  // de la IA — la IA (interpretarBusqueda) solo interviene, si acaso,
  // antes de esto, para traducir una frase en filtros. Etiquetar el
  // resultado del filtro como "encontrado por la IA" era falso incluso
  // cuando la búsqueda sí pasó por la IA, y directamente engañoso cuando
  // la búsqueda activa venía solo del panel de filtros manuales.
  const hayBusquedaActiva = activeCount > 0;
  const idsExactos = useMemo(() => new Set(allResults.map((p) => p.id)), [allResults]);
  const resultadosSimilares = useMemo(
    () => (hayBusquedaActiva && viewMode === 'grid' ? getResultadosSimilares(properties, filters, idsExactos, 6) : []),
    [hayBusquedaActiva, viewMode, properties, filters, idsExactos]
  );

  return (
    <div className="min-h-screen bg-page">

      {/* ── Page header ── */}
      {/* animate-fade-up (globals.css) — entra una sola vez al montar la
          página. No se vuelve a disparar en cada cambio de filtro porque
          React reconcilia el mismo nodo (mismo className), solo cambia el
          texto/contenido de adentro.
          relative z-10 — bug real reportado 2026-08-19: el keyframe de
          animate-fade-up deja un `transform` residual (identity matrix)
          en el elemento aun después de terminar la animación, y CUALQUIER
          transform ≠ none crea un nuevo contexto de apilamiento — sin
          querer, eso aislaba el dropdown de "búsquedas recientes" (z-30
          adentro del <form>, línea de abajo) dentro de esta caja. Como la
          caja en sí seguía siendo `position: static`, pintaba en el orden
          normal del DOM y el sidebar de filtros/las cards (hermano
          siguiente, también `static`) la tapaban por encima. Promoverla a
          positioned con z-index saca todo su contenido (dropdown incluido)
          por encima del resto, sin tocar animate-fade-up. */}
      <div className="relative z-10 bg-white border-b border-gray-100 shadow-sm animate-fade-up">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4">

          {/* Row 1: title + controls — flex-col en móvil: el título ya no
              se trunca (quitado el `truncate`, ver más abajo) pero al
              quedar codo a codo con los botones "Ver en mapa"/"Filtros" en
              una sola fila, un título de 2-3 palabras como "Propiedades en
              Tabasco" se envolvía en 3 líneas angostas y erráticas (bug
              real confirmado en auditoría de responsividad, 2026-08-10).
              En móvil el título ahora ocupa su propia fila a todo lo
              ancho y los controles bajan a una segunda fila; desde sm:
              vuelve al layout de una sola fila de siempre. */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-black text-gray-900 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                {buildTitle(filters)}
                {!isLoading && (
                  <span className="ml-2 text-sm font-semibold text-gray-400 align-middle">
                    ({total})
                  </span>
                )}
              </h1>
              {/* Altura fija (h-4) siempre reservada, aparezca o no el
                  texto — antes este <p> solo existía en el DOM mientras
                  isLoading, así que su aparición/desaparición cambiaba la
                  altura del header y empujaba todo lo de abajo (el mapa
                  incluido) — el "salto" reportado 2026-08-17 al pulsar un
                  chip de filtro en modo mapa. */}
              <p className="text-xs text-gray-400 mt-0.5 h-4 flex items-center gap-1.5">
                {isLoading && <><Loader2 size={11} className="animate-spin" /> Buscando...</>}
              </p>
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

              {/* Ver en mapa (solo <640px) — el toggle de arriba (grid/mapa
                  embebido) se oculta a este ancho, y el mapa embebido en
                  sí es una versión pelona (MapViewDynamic sin satélite, sin
                  "ir a zona", sin leyenda de riesgo, sin el aviso de
                  rotación ya corregido para touch) comparada con /mapa, que
                  ya tiene todo eso. En vez de duplicar esos controles aquí,
                  se manda directo a /mapa con los mismos filtros activos —
                  un solo mapa "bueno" en la plataforma, no uno completo y
                  uno a medias. */}
              <Link
                href={`/mapa${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
                className="sm:hidden flex items-center gap-1.5 bg-white border-2 border-gray-200 hover:border-brand/40 text-gray-700 text-sm font-semibold px-3.5 py-2 rounded-xl shadow-sm transition-colors"
              >
                <Map size={14} /> Ver en mapa
              </Link>

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
          {/* z-20 en el <form>, no solo en el <ul> del dropdown (mismo bug
              corregido en SearchBar.tsx) — sin promover este contenedor, el
              z-30 del <ul> solo gana dentro de su propio contexto de
              apilamiento y "Row 3: Filtros activos" (hermano, después en
              el DOM) podía pintarse encima del dropdown. */}
          <form
            ref={searchFormRef}
            className="relative z-20 mb-3"
            onSubmit={(e) => { e.preventDefault(); setSearchOpen(false); aplicarBusquedaIA(filters.q ?? ''); }}
          >
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={filters.q ?? ''}
              onChange={(e) => { updateFilters({ q: e.target.value }); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              maxLength={MAX_QUERY_LENGTH}
              placeholder="Buscar por colonia, municipio... o descríbelo y presiona Enter"
              className="w-full pl-9 pr-4 py-2.5 text-base sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand focus:bg-white transition-colors placeholder-gray-400 text-gray-800"
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

            {(showSuggestions || showRecent) && (
              <ul className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden z-30">
                {showSuggestions && filteredPlaces.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => handleSuggestionClick(s)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-brand-pale hover:text-brand text-left transition-colors">
                      <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                      {s}
                    </button>
                  </li>
                ))}

                {showRecent && (
                  <>
                    <li className="flex items-center justify-between px-5 pt-3 pb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Búsquedas recientes</span>
                      <button type="button" onClick={handleClearRecent}
                        className="flex items-center gap-1 text-xs text-gray-300 hover:text-red-500 transition-colors">
                        <X size={11} /> Borrar
                      </button>
                    </li>
                    {recent.map((s) => (
                      <li key={s}>
                        <button type="button" onClick={() => handleRecentClick(s)}
                          className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-brand-pale hover:text-brand text-left transition-colors">
                          <Clock size={13} className="text-gray-400 flex-shrink-0" />
                          {s}
                        </button>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            )}
          </form>

          {/* Row 3: Active filters */}
          <ActiveFilters filters={filters} onUpdate={updateFilters} onClear={clearFilters} />
        </div>
      </div>

      {/* ── Body ── */}
      {/* max-w-[2200px] — el contenedor del header (arriba) se queda en
          1440px a propósito (ahí vive el buscador, que no debe volverse
          absurdamente ancho), pero el área de resultados sí necesita
          espacio real para que la grilla dinámica de abajo pueda llegar a
          4-5 columnas en monitores grandes. 2200px es el techo exacto
          donde, con el minmax(300px,1fr) del breakpoint xl: de la grilla,
          matemáticamente nunca cabe una 6ª columna (6×300px + 5×gap
          supera ese ancho) — no es un número arbitrario, es el límite
          real del "máximo 5" pedido. */}
      <div className="max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
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

            {/* Map view — el mapa siempre se renderiza, aunque no haya
                marcadores (antes, sin resultados, se reemplazaba TODO el
                bloque por un mensaje de texto y el mapa nunca aparecía —
                bug real reportado 2026-08-17: cambiar a modo mapa con un
                filtro sin resultados no mostraba ningún mapa, perdiendo
                el contexto geográfico de dónde se estaba buscando). El
                aviso ahora es un overlay encima del mapa, no un reemplazo. */}
            {viewMode === 'map' && (
              <div
                ref={mapContainerRef}
                className={`relative overflow-hidden border border-gray-200 shadow-sm ${isMapFullscreen ? '' : 'rounded-2xl'}`}
                style={{ height: isMapFullscreen ? '100vh' : 'calc(100vh - 260px)', minHeight: 400 }}
              >
                <MapViewDynamic
                  markers={mapMarkers}
                  center={[17.9869, -92.9303]}
                  zoom={11}
                  selectedId={selectedMarker?.id ?? null}
                  onMarkerSelect={setSelectedMarker}
                />

                {/* Chips de tipo/operación — a diferencia de /mapa, aquí NO
                    llevan lg:hidden: en esta página el <aside> con
                    FilterPanel solo existe en modo lista (viewMode ===
                    'grid'), así que en modo mapa esto es la ÚNICA forma de
                    cambiar de filtro en cualquier tamaño de pantalla, no
                    solo en móvil. Mismo degradado de máscara que ya usa
                    /mapa para el overflow-x en pantallas angostas. */}
                <div className="absolute top-3 left-3 right-3 z-[1002] flex items-center gap-1.5 overflow-x-auto"
                     style={{
                       scrollbarWidth: 'none',
                       maskImage: 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
                       WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
                     }}>
                  {/* Volver a cuadrícula — solo táctil (tablets/móviles en
                      horizontal), pedido explícito 2026-08-18. En
                      escritorio el toggle grid/mapa de la fila de arriba
                      ya cubre esto sin necesitar pantalla completa. */}
                  <button
                    onClick={volverACuadricula}
                    className="hidden pointer-coarse:flex flex-shrink-0 items-center gap-1.5 bg-brand-dark text-white
                               text-sm font-semibold px-3 py-2 rounded-xl shadow-sm border border-brand-dark"
                  >
                    <LayoutGrid size={14} /> Cuadrícula
                  </button>
                  {MAP_TYPE_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      onClick={() => updateFilters({ tipo: chip.value as PropertyType | '' })}
                      className={`flex-shrink-0 text-sm font-semibold px-3 py-2 rounded-xl shadow-sm border transition-all ${
                        (filters.tipo ?? '') === chip.value
                          ? 'bg-brand text-white border-brand'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                  <div className="flex-shrink-0 w-px h-5 bg-gray-300 mx-0.5" />
                  {MAP_OP_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      onClick={() => updateFilters({ operacion: chip.value as OperationType | '' })}
                      className={`flex-shrink-0 text-sm font-semibold px-3 py-2 rounded-xl shadow-sm border transition-all ${
                        (filters.operacion ?? '') === chip.value
                          ? 'bg-accent text-white border-accent'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Leyenda de privacidad: los pines no son la ubicación
                    exacta — mismo texto/estilo que /mapa (MapaClient.tsx),
                    pedido explícito 2026-08-19. */}
                <div className="absolute top-14 left-3 right-3 z-[1001] flex justify-center pointer-events-none">
                  <div className="flex items-center gap-1.5 bg-brand-dark shadow-md
                                  border border-brand-dark text-white text-xs font-medium
                                  px-3.5 py-1.5 rounded-full">
                    <Info size={12} className="text-white/70 flex-shrink-0" />
                    Por seguridad, los pines muestran la zona aproximada. Ubicación exacta al contactar
                  </div>
                </div>

                {mapMarkers.length === 0 && (
                  // pt-10 → pt-16: deja espacio para la fila de chips nueva
                  // de arriba, para que no se solapen.
                  <div className="absolute inset-0 z-[1002] pointer-events-none flex items-start justify-center pt-16">
                    {/* Mismo fondo que la leyenda de privacidad de /mapa
                        (MapaClient.tsx) — bg-brand-dark sólido, no
                        blanco/translúcido, pedido explícito 2026-08-17. */}
                    <div className="pointer-events-auto bg-brand-dark shadow-lg border border-brand-dark rounded-2xl px-6 py-4 text-center max-w-xs">
                      <Map size={28} className="mb-2 mx-auto opacity-60 text-white" />
                      {esBusquedaSinInterpretar(filters) ? (
                        <>
                          <p className="text-sm font-medium text-white">No pudimos interpretar del todo tu búsqueda</p>
                          <p className="text-xs mt-1 text-white/60">Prueba con menos palabras (ej. solo el lugar) o usa los filtros para acotar a mano</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-white">Sin propiedades en el mapa</p>
                          <p className="text-xs mt-1 text-white/60">Ajusta los filtros para ver resultados</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {selectedMarker && (
                  <SelectedPropertyCard
                    marker={selectedMarker}
                    onClose={() => setSelectedMarker(null)}
                  />
                )}
              </div>
            )}

            {/* Grid view */}
            {viewMode === 'grid' && (
              <>
                {isLoading ? (
                  <div className={PROPERTY_GRID_CLASSES}>
                    {Array.from({ length: skeletonCount }).map((_, i) => (
                      <Skeleton key={i} variant="card" />
                    ))}
                  </div>
                ) : results.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-16 px-6">
                    {/* Mismo criterio que not-found.tsx: un solo mascota de
                        "esto no está/no se encontró" en toda la plataforma
                        en vez de un ícono genérico — pedido explícito
                        2026-08-20. */}
                    <Image src="/images/icons/sin-resultados.webp" alt="" width={166} height={98} className="mb-3" />
                    <h3 className="font-heading font-bold text-gray-800 text-lg mb-2 text-center">
                      {esBusquedaSinInterpretar(filters) ? 'No pudimos interpretar tu búsqueda' : 'Sin resultados'}
                    </h3>
                    <p className="text-gray-400 text-sm mb-2 max-w-sm leading-relaxed text-center">
                      {esBusquedaSinInterpretar(filters)
                        ? 'Prueba con menos palabras (ej. solo el lugar que buscas) o usa los filtros para acotar a mano.'
                        : resultadosSimilares.length > 0
                          ? 'No encontramos propiedades con esos filtros exactos — esto es lo más parecido:'
                          : 'No encontramos propiedades con esos filtros.'}
                    </p>
                    <button onClick={clearFilters}
                      className="text-brand font-semibold text-sm hover:underline mb-8">
                      Quitar filtros
                    </button>
                    {resultadosSimilares.length > 0 ? (
                      <div className={`${PROPERTY_GRID_CLASSES} w-full`}>
                        {resultadosSimilares.map((p) => (
                          <PropertyCard key={p.id} property={p} landmarkQuery={landmarkQuery} />
                        ))}
                      </div>
                    ) : (
                      <div className="w-full max-w-lg">
                        <ExploreZonasCta />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {hayBusquedaActiva && (
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                        Resultados ({results.length})
                      </p>
                    )}
                    {heroProperty && (
                      <div className="mb-6">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-wide mb-2">
                          <Sparkles size={13} />
                          {etiquetaHero}
                        </p>
                        <div className="max-w-sm">
                          <PropertyCard property={heroProperty} landmarkQuery={landmarkQuery} />
                        </div>
                        {restoResultados.length > 0 && (
                          <p className="text-xs text-gray-400 font-medium mt-5 mb-2">Resto de los resultados</p>
                        )}
                      </div>
                    )}
                    <div className={PROPERTY_GRID_CLASSES}>
                      {restoResultados.map((p) => (
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

                    {/* "Todo lo demás" — lo más parecido que no cumplió TODOS los
                        filtros, para no dejar la búsqueda sintiéndose demasiado
                        estrecha cuando sí hubo resultados exactos pero pocos. */}
                    {!hasMore && resultadosSimilares.length > 0 && (
                      <div className="mt-10 pt-8 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                          Todo lo demás ({resultadosSimilares.length})
                        </p>
                        <div className={PROPERTY_GRID_CLASSES}>
                          {resultadosSimilares.map((p) => (
                            <PropertyCard key={p.id} property={p} landmarkQuery={landmarkQuery} />
                          ))}
                        </div>
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
