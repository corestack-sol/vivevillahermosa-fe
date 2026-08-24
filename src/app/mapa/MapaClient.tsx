'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal, X, ChevronLeft, ChevronDown, Navigation,
  Satellite, Map as MapIcon, Info, MapPin,
  Droplets, Check, RotateCw, List, Maximize2, Minimize2, Heart,
} from 'lucide-react';
import Link from 'next/link';
import type { Property } from '@/types/property';
import type { PropertyType, OperationType } from '@/types/property';
import { useFilters } from '@/hooks/useFilters';
import { applyFilters } from '@/lib/filters';
import { FilterPanel } from '@/components/search/FilterPanel';
import { MapViewDynamic } from '@/components/map/MapViewDynamic';
import { getColoniasOrdenadasPorDemanda, getPropertiesInBounds, type ColoniaCard } from '@/lib/api';
import { matchColonia, precargarColoniasDescubiertas } from '@/lib/colonias';
import { precargarLandmarks } from '@/lib/landmarks';
import { useAuth } from '@/context/AuthContext';
import { SelectedPropertyCard } from '@/components/map/SelectedPropertyCard';
import type { MapMarker, MapControls, MapBounds } from '@/components/map/MapView';

// ── Config ──────────────────────────────────────────────────────────────

type RiesgoLevel = 'bajo' | 'medio' | 'alto';
type TileType    = 'street' | 'satellite';

// Mismo criterio que src/lib/floodColors.ts — describe el registro
// histórico, no una predicción de la plataforma.
const RIESGO_CFG = [
  { level: 'bajo'  as RiesgoLevel, color: '#10B981', short: 'Bajo',  long: 'Bajo historial de inundaciones' },
  { level: 'medio' as RiesgoLevel, color: '#F59E0B', short: 'Medio', long: 'Inundaciones menores ocasionales' },
  { level: 'alto'  as RiesgoLevel, color: '#EF4444', short: 'Alto',  long: 'Históricamente inundable' },
];

const TYPE_CHIPS: { value: PropertyType | ''; label: string }[] = [
  { value: '',             label: 'Todos'    },
  { value: 'casa',         label: 'Casa'     },
  { value: 'departamento', label: 'Depto'    },
  { value: 'terreno',      label: 'Terreno'  },
  { value: 'local',        label: 'Local'    },
  { value: 'habitacion',   label: 'Habitación' },
];

const OP_CHIPS: { value: OperationType | ''; label: string }[] = [
  { value: '',       label: 'Todo'   },
  { value: 'venta',  label: 'Venta'  },
  { value: 'renta',  label: 'Renta'  },
];

// "Ir a zona" ya no es una lista fija — se construye a partir de
// getColoniasOrdenadasPorDemanda() (2026-08-09, actualizado 2026-08-23 a
// demanda real en vez de solo oferta), la misma fuente real y en vivo que
// ya usan /zonas y el Home: las colonias más buscadas, no una selección
// editorial. ZOOM_ZONA es fijo (nivel razonable para ver una colonia
// completa) porque no es un dato de la colonia en sí, solo configuración
// visual del mapa.
const ZOOM_ZONA = 15;
const MAX_ZONAS_IR_A = 7; // mismo tope que la lista fija anterior

// Filtra con las MISMAS coordenadas que se dibujan (latPublico/lngPublico,
// enmascaradas por privacidad) — antes filtraba con lat/lng reales mientras
// los pines se dibujaban con las públicas, así que el conteo "N propiedades
// en esta zona" y los pines visibles podían no coincidir tras un pan/zoom.
function isInBounds(p: Property, b: MapBounds): boolean {
  return p.latPublico >= b.south && p.latPublico <= b.north && p.lngPublico >= b.west && p.lngPublico <= b.east;
}

// ── Main Component ───────────────────────────────────────────────────────

interface Props { allProperties: Property[] }

export function MapaClient({ allProperties }: Props) {
  const { filters, updateFilters, clearFilters, activeCount } = useFilters();
  const { user } = useAuth();

  // `allProperties` (SSR, mapa/page.tsx) es solo el primer pintado — pedido
  // explícito 2026-08-23: a cientos/miles de propiedades activas, traer el
  // catálogo COMPLETO en cada carga deja de ser viable (payload cada vez
  // más pesado, sin relación con lo que de verdad se ve en pantalla). En
  // cuanto el mapa reporta un área real (`handleBoundsChange` de abajo), se
  // vuelve a pedir SOLO lo que cabe en ese recuadro — ver
  // getPropertiesInBounds() en api.ts y docs/BACKEND-MAPA-BBOX-23082026.md.
  // El backend todavía no filtra por área (se lo ignora, ver el comentario
  // de esa función) — hasta que lo implemente, esto sigue trayendo el
  // catálogo completo en cada pan/zoom, más llamadas que antes pero cada
  // una del mismo tamaño de hoy, nunca peor por llamada. `allProperties` se
  // mantiene como respaldo si el primer fetch por área fallara.
  const [properties, setProperties] = useState<Property[]>(allProperties);
  const [cargandoArea, setCargandoArea] = useState(false);

  const [panelOpen,     setPanelOpen]     = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [riesgoActive,  setRiesgoActive]  = useState<Set<RiesgoLevel>>(new Set(['bajo', 'medio', 'alto']));
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [activeBounds,  setActiveBounds]  = useState<MapBounds | null>(null);
  const [tileType,      setTileType]      = useState<TileType>('street');
  const [mapControls,   setMapControls]   = useState<MapControls | null>(null);
  const [activeZone,    setActiveZone]    = useState<string | null>(null);
  // Colapsables — pedido explícito 2026-08-23: "Inundación" y "Ir a zona"
  // ocupan espacio fijo del panel de escritorio incluso cuando a la
  // persona no le interesan en ese momento, tapando mapa útil. Abiertas
  // por defecto (mismo comportamiento visual de siempre); colapsar es una
  // preferencia de sesión, no se persiste entre visitas.
  const [inundacionOpen, setInundacionOpen] = useState(true);
  const [irAZonaOpen,    setIrAZonaOpen]    = useState(true);
  const [geoLoading,    setGeoLoading]    = useState(false);
  const [geoError,      setGeoError]      = useState('');

  // `landmarksCache`/`coloniasDescubiertasCache` (src/lib/landmarks.ts,
  // src/lib/colonias.ts) son variables de módulo llenadas por un fetch
  // fire-and-forget — nada las conecta al ciclo de render de React por sí
  // solas. /propiedades ya dispara la precarga (PropertiesClient.tsx), pero
  // /mapa es su propia entrada (ej. el link "Ver en mapa" de una búsqueda
  // "cerca de X" en móvil, más abajo) y antes NUNCA la disparaba — si
  // alguien llegaba aquí directo (o más rápido de lo que tardaba el fetch
  // de /propiedades), `filtered`/`zonasIrA` quedaban calculados con el
  // caché todavía vacío y ningún re-render los corregía después (mismo bug
  // reportado 2026-08-20 en filters.ts/PropertiesClient.tsx). Disparar la
  // carga aquí también y usar estas banderas como dependencia de los
  // cálculos de abajo cierra ambos huecos: el catálogo si carga en esta
  // página, y su llegada tardía sí fuerza un recálculo.
  const [landmarksReady, setLandmarksReady] = useState(false);
  const [coloniasReady,  setColoniasReady]  = useState(false);
  useEffect(() => { precargarLandmarks().then(() => setLandmarksReady(true)); }, []);
  useEffect(() => { precargarColoniasDescubiertas().then(() => setColoniasReady(true)); }, []);

  // Pantalla completa real (Fullscreen API) — pedido explícito 2026-08-18:
  // "que no se vean las pestañas del navegador". Requiere gesto del
  // usuario (no se puede activar solo al cargar la página, los
  // navegadores lo bloquean). Se fullscreenea este contenedor completo
  // (mapContainerRef, la raíz de /mapa) en vez de solo el <canvas> del
  // mapa — así el header/nav del sitio (que vive fuera de este árbol,
  // en layout.tsx) también queda tapado, no solo el chrome del navegador.
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  useEffect(() => {
    function checkSupport() {
      setFullscreenSupported(typeof document !== 'undefined' && document.fullscreenEnabled);
    }
    checkSupport();
    function onChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      mapContainerRef.current?.requestFullscreen().catch(() => {});
    }
  }

  // Drawer de filtros móvil: entra el foco al abrir, Escape cierra, el
  // foco vuelve al botón que lo abrió al cerrar.
  useEffect(() => {
    if (!panelOpen) return;
    const trigger = filterButtonRef.current;
    drawerRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPanelOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [panelOpen]);

  // "Ir a zona" — pedido explícito 2026-08-23: antes ordenaba por OFERTA
  // (getColoniasRankedByPropiedades, cuántas propiedades activas tiene la
  // colonia); ahora reusa getColoniasOrdenadasPorDemanda(), la misma fuente
  // real que ya arma la sección de cards "Colonias más buscadas" en el
  // Home y en /zonas (BACKEND.md §9.1) — sin mantener una selección aparte
  // sincronizada a mano. Cuando todavía no hay ningún evento de demanda
  // real registrado, esa misma función cae honestamente a oferta (mismo
  // comportamiento de antes, no una regresión). Resolviendo cada una
  // contra el catálogo de coordenadas verificadas (matchColonia) para
  // obtener lat/lng/radio reales. El ranking en sí se pide una sola vez al
  // montar — igual que /zonas y Home (páginas de servidor), no reacciona a
  // publicaciones locales de este navegador; sería inconsistente que el
  // mapa mostrara una colonia "de moda" que nadie más ve. La resolución a
  // coordenada (abajo) sí se recalcula, ver comentario de `zonasIrA`. Las
  // colonias rankeadas que no tengan coordenada verificada (ej. detectadas
  // por texto libre, sin catálogo) se descartan aquí — no hay a dónde
  // volar sin lat/lng real.
  const [coloniasRanked, setColoniasRanked] = useState<ColoniaCard[]>([]);
  useEffect(() => {
    let cancelado = false;
    getColoniasOrdenadasPorDemanda().then(({ colonias }) => {
      if (!cancelado) setColoniasRanked(colonias);
    });
    return () => { cancelado = true; };
  }, []);
  // Resuelto vía useMemo (no en el mismo efecto que arriba) y con
  // `coloniasReady` como dependencia: si `matchColonia` corrió mientras
  // `coloniasDescubiertasCache` seguía vacío, una colonia rankeada real se
  // descartaba en silencio (sin coordenada verificada, `.filter` la quita) y
  // se quedaba fuera de "Ir a zona" para siempre — nunca "todo" en vez de
  // filtrado (ya es el resultado seguro), pero sí una lista incompleta que
  // ningún reload posterior corregía. Con esto, en cuanto la precarga de
  // arriba resuelve, la lista se recalcula contra el catálogo ya completo.
  const zonasIrA = useMemo(
    () =>
      coloniasRanked
        .map((c) => {
          const coord = matchColonia(c.nombre, c.municipio);
          return coord ? { label: c.nombre, lat: coord.lat, lng: coord.lng, radius: coord.radioKm * 1000 } : null;
        })
        .filter((z): z is { label: string; lat: number; lng: number; radius: number } => z !== null)
        .slice(0, MAX_ZONAS_IR_A),
    [coloniasRanked, coloniasReady] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // El primer "moveend" lo dispara Leaflet al montar el mapa (no una
  // interacción real del usuario) — se ignora para no filtrar antes de que
  // alguien mueva el mapa de verdad.
  const boundsInitializedRef = useRef(false);

  function toggleRiesgo(level: RiesgoLevel) {
    setRiesgoActive((prev) => {
      const next = new Set(prev);
      if (next.has(level)) { if (next.size === 1) return prev; next.delete(level); }
      else next.add(level);
      return next;
    });
  }

  // Antes requería tocar "Buscar en esta zona" para aplicar el recuadro
  // visible como filtro. Ahora se aplica solo al mover/hacer zoom — libera
  // ese espacio para la leyenda de privacidad.
  // ⚠️ 2026-08-23: dejó de ser "sin costo de red" — cada cambio de área
  // ahora también pide propiedades acotadas a ese recuadro (ver
  // cargarPropiedadesDelArea/getPropertiesInBounds), necesario para que el
  // mapa siga siendo viable con cientos/miles de propiedades activas (antes
  // se traía el catálogo completo una sola vez y todo el filtrado era
  // local). Debounce subido de 150ms a 400ms por eso mismo: 150ms bastaba
  // para filtrado local instantáneo, pero dispararía una llamada de red por
  // cada paso intermedio de un pan/zoom continuo.
  const boundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleBoundsChange(bounds: MapBounds) {
    if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current);
    boundsDebounceRef.current = setTimeout(() => {
      // El pedido de datos SÍ corre desde el primer reporte al montar
      // (a diferencia del filtro visual de abajo, `setActiveBounds`, que
      // sigue ignorando ese primer evento a propósito) — la primera vista
      // también se beneficia de traer solo lo que cabe en pantalla, no
      // solo las vistas después de una interacción real.
      void cargarPropiedadesDelArea(bounds);
      if (!boundsInitializedRef.current) { boundsInitializedRef.current = true; return; }
      setActiveBounds(bounds);
    }, 400);
  }

  async function cargarPropiedadesDelArea(bounds: MapBounds) {
    setCargandoArea(true);
    try {
      const data = await getPropertiesInBounds(bounds);
      setProperties(data);
    } catch {
      // Fail-open — se queda con lo que ya había (el SSR inicial o la
      // última área cargada con éxito), nunca se vacía el mapa por un
      // fetch fallido.
    } finally {
      setCargandoArea(false);
    }
  }

  function handleGeolocate() {
    if (!navigator.geolocation) { setGeoError('Tu navegador no soporta geolocalización'); return; }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapControls?.flyTo(coords.latitude, coords.longitude, 15);
        setGeoLoading(false);
      },
      () => { setGeoError('No se pudo obtener tu ubicación'); setGeoLoading(false); },
      { timeout: 8000 }
    );
  }

  const handleMarkerSelect = useCallback((marker: MapMarker | null) => setSelectedMarker(marker), []);
  const handleMapReady     = useCallback((controls: MapControls) => setMapControls(controls), []);

  // ── Filter chain ──
  // `landmarksReady`/`coloniasReady` en las dependencias: `applyFilters`
  // (src/lib/filters.ts) ya falla seguro (vacío, nunca "todo") cuando
  // filters.landmark/colonia/zonaDestacada llega antes de que el catálogo
  // cargue (ver ?cerca=/?zona= que propaga el link "Ver en mapa" de
  // PropertiesClient.tsx) — pero sin esto, ese resultado vacío se quedaba
  // fijo: nada volvía a renderizar solo porque el caché terminó de llenarse
  // después, el mismo bug de reactividad ya corregido en PropertiesClient.
  const filtered = useMemo(() => {
    let result = applyFilters(properties, filters)
      .filter((p) => riesgoActive.has((p.riesgoInundacion ?? 'bajo') as RiesgoLevel));
    if (activeBounds) result = result.filter((p) => isInBounds(p, activeBounds));
    return result;
  }, [properties, filters, riesgoActive, activeBounds, landmarksReady, coloniasReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const markers: MapMarker[] = filtered.map((p) => ({
    id: p.id, slug: p.slug, lat: p.latPublico, lng: p.lngPublico,
    titulo: p.titulo, precio: p.precio, operacion: p.operacion,
    tipo: p.tipo, colonia: p.colonia,
    foto: p.fotos[0] ?? null,
    riesgoInundacion: p.riesgoInundacion,
  }));

  const currentTipo = filters.tipo ?? '';
  const currentOp   = filters.operacion ?? '';

  return (
    // z-0 aquí acota los z-[1001]-z-[1200] internos del mapa (elegidos para
    // ganarle a los panes propios de Leaflet, que usan hasta z-index 1000) a
    // este contenedor — sin esto, esos valores se comparaban directo contra
    // el header/menú de cuenta y los modales globales (que usan z-40/z-50),
    // y el mapa siempre ganaba sin importar qué z-index se le pusiera al
    // header, porque nada dentro de este div podía "escapar" a competir con
    // hermanos fuera de él una vez que este div tiene su propio z-index.
    <div ref={mapContainerRef} className="relative z-0 flex h-[calc(100vh-64px)] max-lg:landscape:pointer-coarse:h-screen [&:fullscreen]:h-screen bg-white">

      {/* ══ Aviso "gira tu dispositivo" — solo móvil/tablet en vertical ══
          .rotate-hint (globals.css) lo muestra solo por CSS (max-width
          1023px + orientation:portrait), sin JS ni permisos. Es "fixed
          inset-0" con z-index más alto que el Navbar (sticky, z-40), así
          que también lo tapa — por eso trae sus propios enlaces de
          salida (Inicio / Ver como lista) en vez de dejar a la persona
          sin ninguna forma de salir del mapa si no quiere girar el
          teléfono. */}
      <div className="rotate-hint fixed inset-0 z-[1300] bg-brand-dark flex-col items-center justify-center text-center px-8 gap-5">
        <span className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
          <RotateCw size={28} className="text-white" />
        </span>
        <div>
          <p className="font-heading font-bold text-lg text-white mb-1.5">Gira tu dispositivo</p>
          <p className="text-sm text-white/50 max-w-xs">
            El mapa se explora mucho mejor en horizontal. Gira tu teléfono o tablet para verlo completo.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-[220px] mt-2">
          <Link href="/propiedades"
            className="flex items-center justify-center gap-2 bg-white text-brand-dark font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-white/90 transition-colors">
            <List size={15} /> Ver como lista
          </Link>
          <Link href="/"
            className="flex items-center justify-center gap-2 text-white/60 hover:text-white text-sm px-4 py-2 transition-colors">
            <ChevronLeft size={15} /> Volver al inicio
          </Link>
        </div>
      </div>

      {/* ══ Desktop Sidebar ══════════════════════════════════════════════ */}
      <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 bg-brand-dark border-r border-white/10 overflow-y-auto">

        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <Link href="/" className="flex items-center gap-1 text-sm text-white/45 hover:text-white mb-3 w-fit transition-colors">
            <ChevronLeft size={16} /> Inicio
          </Link>
          <h1 className="font-heading font-bold text-lg text-white">Mapa de propiedades</h1>
          <p className="flex items-center gap-1.5 text-sm text-white/45 mt-0.5">
            {cargandoArea && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />}
            {filtered.length} propiedad{filtered.length !== 1 ? 'es' : ''}
            {activeBounds ? ' en esta zona' : ''}
          </p>
        </div>

        {/* Filters */}
        <div className="p-4 flex-1">
          <FilterPanel
            filters={filters}
            onUpdate={updateFilters}
            onClear={clearFilters}
            activeCount={activeCount}
          />
        </div>

      </aside>

      {/* ══ Map area ═════════════════════════════════════════════════════ */}
      <div className="flex-1 relative">
        <MapViewDynamic
          markers={markers}
          zoom={11}
          height="100%"
          tileType={tileType}
          selectedId={selectedMarker?.id ?? null}
          onMarkerSelect={handleMarkerSelect}
          onBoundsChange={handleBoundsChange}
          onMapReady={handleMapReady}
        />

        {/* Sin resultados — antes el mapa quedaba en blanco sin ninguna
            guía cuando los filtros (o el recuadro visible) no dejaban
            ninguna propiedad. */}
        {filtered.length === 0 && (
          <div className="absolute inset-0 z-[1001] flex items-center justify-center pointer-events-none px-4">
            <div className="pointer-events-auto bg-white rounded-2xl shadow-xl border border-gray-100 px-6 py-5 text-center max-w-xs">
              <p className="text-sm font-semibold text-gray-800 mb-1">Sin propiedades aquí</p>
              <p className="text-xs text-gray-500 mb-3">Ninguna propiedad coincide con tus filtros en esta zona del mapa.</p>
              <button
                type="button"
                onClick={() => { clearFilters(); setActiveBounds(null); mapControls?.flyTo(17.9869, -92.9303, 11); }}
                className="text-xs font-semibold text-brand hover:text-brand-dark transition-colors"
              >
                Limpiar filtros y volver a Villahermosa
              </button>
            </div>
          </div>
        )}

        {/* ══ Right map panel — desktop only ══════════════════════════════
            hidden lg:pointer-fine:flex, no solo hidden lg:flex — un
            iPad/tablet en horizontal fácilmente cruza los 1024px de "lg"
            (más ahora que /mapa empuja a girar el dispositivo), así que
            el ancho solo no basta para distinguir tablet de escritorio
            real. pointer:fine detecta mouse/trackpad (desktop) vs. dedo
            (pointer:coarse, cualquier móvil o tablet) sin importar el
            ancho — así este panel (Inundación, Ir a zona, N resultados)
            nunca aparece en touch, pedido explícito. El equivalente
            táctil de Mapa/Satélite ya existe aparte más abajo (botón
            flotante lg:hidden), así que ocultar todo el panel en touch no
            quita esa función en tablet/móvil. */}
        <div className="absolute top-3 right-3 z-[1001] hidden lg:pointer-fine:flex flex-col gap-2 w-56">

          {/* Mapa / Satélite */}
          <div className="bg-brand-dark rounded-xl shadow-xl overflow-hidden flex">
            <button
              onClick={() => setTileType('street')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-all ${
                tileType === 'street'
                  ? 'bg-white text-brand-dark'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <MapIcon size={14} /> Mapa
            </button>
            <div className="w-px bg-white/15 flex-shrink-0" />
            <button
              onClick={() => setTileType('satellite')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-all ${
                tileType === 'satellite'
                  ? 'bg-white text-brand-dark'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Satellite size={14} /> Satélite
            </button>
          </div>

          {/* Riesgo de inundación — colapsable, ver inundacionOpen arriba. */}
          <div className="bg-brand-dark rounded-xl shadow-xl p-3">
            <button
              onClick={() => setInundacionOpen((v) => !v)}
              className="w-full flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
            >
              <Droplets size={12} /> Inundación
              <ChevronDown size={13} className={`ml-auto transition-transform ${inundacionOpen ? 'rotate-180' : ''}`} />
            </button>
            {inundacionOpen && (
            <div className="space-y-0.5 mt-2.5">
              {RIESGO_CFG.map((item) => {
                const active = riesgoActive.has(item.level);
                return (
                  <button
                    key={item.level}
                    onClick={() => toggleRiesgo(item.level)}
                    className={`w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg transition-all ${
                      active
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-white/25'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors"
                      style={{ background: active ? item.color : 'rgba(255,255,255,0.2)' }}
                    />
                    <span className={active ? '' : 'line-through'}>{item.short}</span>
                    {active && <Check size={13} className="ml-auto text-white/30" />}
                  </button>
                );
              })}
            </div>
            )}
          </div>

          {/* Ir a zona — oculta por completo si ninguna colonia rankeada
              resolvió coordenada verificada, en vez de mostrar una
              tarjeta vacía. Colapsable, ver irAZonaOpen arriba. */}
          {zonasIrA.length > 0 && (
          <div className="bg-brand-dark rounded-xl shadow-xl p-3">
            <button
              onClick={() => setIrAZonaOpen((v) => !v)}
              className="w-full flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
            >
              <MapPin size={12} /> Ir a zona
              <ChevronDown size={13} className={`ml-auto transition-transform ${irAZonaOpen ? 'rotate-180' : ''}`} />
            </button>
            {irAZonaOpen && (
            <div className="flex flex-col gap-0.5 mt-2.5">
              {zonasIrA.map((zone) => {
                const isActive = activeZone === zone.label;
                return (
                  <button
                    key={zone.label}
                    disabled={!mapControls}
                    onClick={() => {
                      if (isActive) {
                        mapControls?.clearZoneCircle();
                        setActiveZone(null);
                      } else {
                        mapControls?.flyTo(zone.lat, zone.lng, ZOOM_ZONA);
                        mapControls?.showZoneCircle(zone.lat, zone.lng, zone.radius);
                        setActiveZone(zone.label);
                      }
                    }}
                    className={`w-full text-sm text-left px-2.5 py-1.5 rounded-lg font-medium transition-all disabled:opacity-30 flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-white text-brand-dark'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />}
                    <span className="truncate">{zone.label}</span>
                  </button>
                );
              })}
            </div>
            )}
          </div>
          )}

        </div>

        {/* ── Top overlay ── */}
        <div className="absolute top-3 left-3 right-3 lg:right-64 z-[1001] flex flex-col gap-2 pointer-events-none">

          {/* Chips row — solo móvil (lg:hidden). En escritorio el <aside>
              con FilterPanel (línea 337, hidden lg:flex) ya cubre
              tipo/operación de forma permanente — repetirlo aquí arriba del
              mapa era el mismo filtro dos veces a la vez, pedido explícito
              del usuario 2026-08-17. En móvil ese <aside> está oculto, así
              que estos chips siguen siendo el acceso rápido real (más el
              botón de filtros completo, "lg:hidden" también, que abre el
              panel deslizante).
              En móvil los chips de tipo (Todos/Casa/Depto/Terreno/Local...)
              no caben todos y el overflow-x-auto los corta en seco justo en
              el borde de la pantalla sin ninguna pista de que se puede
              seguir deslizando (bug real confirmado en auditoría de
              responsividad, 2026-08-10: "Local" quedaba cortado a la mitad,
              ilegible). Mismo degradado de máscara que ya usa el marquee de
              la Home (src/app/page.tsx) para el mismo problema, con un
              ancho menor (24px) porque aquí el contenedor es angosto (ancho
              de pantalla) — 90px se comía casi todos los chips visibles a
              la vez. */}
          <div className="flex items-center gap-1.5 overflow-x-auto pointer-events-auto lg:hidden"
               style={{
                 scrollbarWidth: 'none',
                 maskImage: 'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
                 WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
               }}>

            {/* Volver al inicio — solo aparece cuando el header está
                escondido (móvil horizontal, ver Navbar.tsx `isMapa`).
                En vertical el rotate-hint ya cubre toda la pantalla y
                trae su propio link de salida, así que este solo hace
                falta en horizontal. Mismo criterio de detección exacto
                que el header (max-lg + landscape + pointer:coarse) para
                que aparezcan/desaparezcan juntos. */}
            <Link
              href="/"
              className="hidden max-lg:landscape:pointer-coarse:flex flex-shrink-0 items-center gap-1.5 bg-brand-dark shadow-md
                         border border-brand-dark text-white text-sm font-semibold px-3 py-2 rounded-xl"
            >
              <ChevronLeft size={14} /> Inicio
            </Link>

            {/* Mobile: filter button */}
            <button
              ref={filterButtonRef}
              onClick={() => setPanelOpen(true)}
              className="lg:hidden flex-shrink-0 flex items-center gap-1.5 bg-white shadow-md
                         border border-gray-200 text-gray-700 text-sm font-semibold px-3 py-2 rounded-xl"
            >
              <SlidersHorizontal size={14} />
              {activeCount > 0 && (
                <span className="bg-brand text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </button>

            {/* Tipo chips */}
            {TYPE_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => updateFilters({ tipo: chip.value as PropertyType | '' })}
                className={`flex-shrink-0 text-sm font-semibold px-3 py-2 rounded-xl shadow-sm border transition-all ${
                  currentTipo === chip.value
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {chip.label}
              </button>
            ))}

            {/* Divider */}
            <div className="flex-shrink-0 w-px h-5 bg-gray-300 mx-0.5" />

            {/* Op chips */}
            {OP_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => updateFilters({ operacion: chip.value as OperationType | '' })}
                className={`flex-shrink-0 text-sm font-semibold px-3 py-2 rounded-xl shadow-sm border transition-all ${
                  currentOp === chip.value
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Leyenda de privacidad: los pines no son la ubicación exacta.
              Fondo sólido de marca (antes bg-white/95 + blur) — pedido
              explícito 2026-08-17: blanco translúcido se perdía sobre las
              zonas claras del mapa (calles, agua en el satélite). Un fondo
              con color propio destaca sobre cualquier parte del mapa, no
              solo las oscuras. */}
          <div className="flex justify-center">
            <div className="flex items-center gap-1.5 bg-brand-dark shadow-md
                            border border-brand-dark text-white text-xs font-medium
                            px-3.5 py-1.5 rounded-full">
              <Info size={12} className="text-white/70 flex-shrink-0" />
              Por seguridad, los pines muestran la zona aproximada. Ubicación exacta al contactar
            </div>
          </div>
        </div>

        {/* ── Right floating buttons ── */}
        {/* bottom-20 → bottom-28 (2026-08-17): quedaba solapado con el
            control de zoom de Leaflet (bottomright, ~62px de alto + 10px
            de margen propio de Leaflet) — el margen que dejaba antes era
            de unos pocos px, demasiado ajustado en la práctica. */}
        <div className="absolute bottom-28 right-3 z-[1001] flex flex-col gap-2">
          {/* Pantalla completa — pedido explícito 2026-08-18. Oculto si el
              navegador no soporta la Fullscreen API (ej. Safari iOS) en
              vez de mostrar un botón que no hace nada al tocarlo. */}
          {fullscreenSupported && (
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              className="w-11 h-11 bg-brand-dark shadow-lg border border-brand-dark rounded-xl
                         flex items-center justify-center text-white
                         hover:bg-brand hover:border-brand transition-all"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}

          {/* Ver favoritos — pedido explícito 2026-08-18: poder revisar
              las propiedades guardadas después de navegar el mapa, sin
              tener que salir a buscar el link en otro lado. Mismo criterio
              que FavoriteButton: si no hay sesión, no se muestra (favoritos
              es una función de cuenta). */}
          {user && (
            <Link
              href="/favoritos?from=mapa"
              title="Mis favoritos"
              aria-label="Mis favoritos"
              className="w-11 h-11 bg-brand-dark shadow-lg border border-brand-dark rounded-xl
                         flex items-center justify-center text-white
                         hover:bg-brand hover:border-brand transition-all"
            >
              <Heart size={16} />
            </Link>
          )}

          {/* Satellite toggle — equivalente táctil del toggle Mapa/Satélite
              del panel de escritorio (hidden lg:pointer-fine:flex más
              arriba). Antes decía "mobile only" pero estaba gateado por
              lg:hidden (ancho), no por tipo de entrada — un tablet táctil
              en horizontal a 1024px+ no obtenía ni el panel de escritorio
              (excluido a propósito, es solo para mouse) ni este botón
              (excluido por ancho): el control desaparecía por completo.
              pointer-coarse: lo muestra para cualquier dispositivo táctil
              sin importar el ancho, cerrando ese hueco. */}
          <button
            onClick={() => setTileType((t) => (t === 'street' ? 'satellite' : 'street'))}
            title={tileType === 'street' ? 'Ver satélite' : 'Ver mapa'}
            aria-label={tileType === 'street' ? 'Ver satélite' : 'Ver mapa'}
            className="hidden pointer-coarse:flex w-11 h-11 bg-white shadow-lg border border-gray-200 rounded-xl
                       items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {tileType === 'street' ? <Satellite size={16} /> : <MapIcon size={16} />}
          </button>

          {/* Mi ubicación — mismo criterio que la leyenda de privacidad de
              arriba: fondo sólido de marca en vez de blanco, para que no
              se pierda contra zonas claras del mapa (pedido explícito
              2026-08-17). El botón ya era bg-white 100% opaco, no
              translúcido — el problema real era contraste de color, no
              opacidad. */}
          <button
            onClick={handleGeolocate}
            disabled={geoLoading}
            title="Mi ubicación"
            aria-label="Mi ubicación"
            className="w-11 h-11 bg-brand-dark shadow-lg border border-brand-dark rounded-xl
                       flex items-center justify-center text-white
                       hover:bg-brand hover:border-brand
                       transition-all disabled:opacity-50"
          >
            {geoLoading
              // border-white/40, no border-brand — sobre el nuevo fondo
              // bg-brand-dark el spinner anterior (tono teal similar al
              // fondo) prácticamente no se veía girar.
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Navigation size={16} />}
          </button>
        </div>

        {/* Geo error tooltip — bottom-36 → bottom-44, misma corrección que
            el grupo de botones de abajo (+32px), para seguir apareciendo
            arriba del botón "Mi ubicación" y no encima. */}
        {geoError && (
          <div className="absolute bottom-44 right-3 z-[1001] bg-red-50 border border-red-200
                          text-red-600 text-sm px-3 py-2 rounded-xl shadow-md max-w-48">
            {geoError}
          </div>
        )}

        {/* ── Flood risk legend — equivalente táctil de "Inundación" del
            panel de escritorio, mismo motivo/mismo arreglo que el botón
            de satélite de arriba: antes gateado por lg:hidden (ancho),
            así que un tablet táctil ancho se quedaba sin este filtro por
            completo (FilterPanel, usado en el sidebar/drawer, no tiene
            filtro de riesgo de inundación). pointer-coarse: cierra el
            hueco sin importar el ancho. ── */}
        <div className="absolute bottom-6 left-3 bg-white rounded-xl shadow-md border border-gray-200
                        px-3 py-2 hidden pointer-coarse:block z-[1001]">
          <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <Droplets size={12} className="flex-shrink-0" /> Riesgo — toca para filtrar
          </p>
          <div className="flex gap-2">
            {RIESGO_CFG.map((item) => {
              const active = riesgoActive.has(item.level);
              return (
                <button
                  key={item.level}
                  onClick={() => toggleRiesgo(item.level)}
                  className={`flex items-center gap-1 text-sm px-2 py-1 rounded-lg border transition-all ${
                    active
                      ? 'border-gray-200 text-gray-700 bg-white font-medium'
                      : 'border-transparent text-gray-400 opacity-50 line-through'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  {item.short}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Selected property card ── */}
        {selectedMarker && (
          <SelectedPropertyCard
            marker={selectedMarker}
            onClose={() => setSelectedMarker(null)}
          />
        )}
      </div>

      {/* ══ Mobile filter drawer ═════════════════════════════════════════
          Accesible por teclado: Escape cierra, el foco entra al abrir y
          vuelve al botón que lo abrió al cerrar — antes solo se podía
          cerrar tocando la X o el fondo. */}
      {panelOpen && (
        <div className="fixed inset-0 z-[1200] lg:hidden" role="dialog" aria-modal="true" aria-label="Filtrar mapa">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPanelOpen(false)} />
          <div ref={drawerRef} tabIndex={-1} className="absolute left-0 top-0 bottom-0 w-80 max-w-full bg-brand-dark overflow-y-auto shadow-xl outline-none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="font-semibold text-white">Filtrar mapa</h2>
              <button onClick={() => setPanelOpen(false)} aria-label="Cerrar filtros" className="text-white/50 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <FilterPanel
                filters={filters}
                onUpdate={(u) => { updateFilters(u); setPanelOpen(false); }}
                onClear={() => { clearFilters(); setPanelOpen(false); }}
                activeCount={activeCount}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
