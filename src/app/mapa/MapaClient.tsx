'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  SlidersHorizontal, X, ChevronLeft, Navigation,
  Satellite, Map as MapIcon, Info, MapPin, ArrowRight,
  Droplets, Check, RotateCw, List,
} from 'lucide-react';
import Link from 'next/link';
import type { Property } from '@/types/property';
import type { PropertyType, OperationType } from '@/types/property';
import { useFilters } from '@/hooks/useFilters';
import { applyFilters } from '@/lib/filters';
import { FilterPanel } from '@/components/search/FilterPanel';
import { MapViewDynamic } from '@/components/map/MapViewDynamic';
import { formatPriceShort } from '@/lib/format';
import { getPropertyTypeConfig } from '@/lib/propertyTypeConfig';
import { getColoniasRankedByPropiedades } from '@/lib/api';
import { matchColonia } from '@/lib/colonias';
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
  { value: 'habitacion',   label: 'Cuarto'   },
];

const OP_CHIPS: { value: OperationType | ''; label: string }[] = [
  { value: '',       label: 'Todo'   },
  { value: 'venta',  label: 'Venta'  },
  { value: 'renta',  label: 'Renta'  },
];

// "Ir a zona" ya no es una lista fija — se construye a partir de
// getColoniasRankedByPropiedades() (2026-08-09, pedido explícito), la
// misma fuente real y en vivo que ya usan /zonas y el Home: las colonias
// con más propiedades activas, no una selección editorial. ZOOM_ZONA es
// fijo (nivel razonable para ver una colonia completa) porque no es un
// dato de la colonia en sí, solo configuración visual del mapa.
const ZOOM_ZONA = 15;
const MAX_ZONAS_IR_A = 7; // mismo tope que la lista fija anterior

const RIESGO_LABEL: Record<string, string> = {
  bajo: 'Bajo historial de inundaciones', medio: 'Inundaciones menores ocasionales', alto: 'Históricamente inundable',
};

const RIESGO_COLOR: Record<string, string> = {
  bajo: '#10B981', medio: '#F59E0B', alto: '#EF4444',
};

function isInBounds(p: Property, b: MapBounds): boolean {
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
}

// ── Selected Property Card ───────────────────────────────────────────────

function SelectedCard({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const typeCfg = getPropertyTypeConfig(marker.tipo);
  const colors  = typeCfg;
  const showImg = !!marker.foto && !imgFailed;

  return (
    <div className="
      fixed bottom-0 left-0 right-0 z-[1100]
      lg:absolute lg:bottom-5 lg:left-5 lg:right-auto lg:w-[380px] lg:z-[1001]
      bg-white border-t border-gray-100 lg:border lg:rounded-3xl
      shadow-2xl overflow-hidden
    ">
      {/* Mobile drag handle */}
      <div className="lg:hidden flex justify-center pt-2.5 pb-1">
        <div className="w-9 h-1 rounded-full bg-gray-200" />
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-10 w-10 h-10 bg-black/30 hover:bg-black/50
                   text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
      >
        <X size={16} />
      </button>

      {/* Image / gradient header */}
      <div
        className="relative h-60 overflow-hidden flex items-center justify-center"
        style={{
          // color-mix() en vez de concatenar dígitos hex de opacidad —
          // colors.glow puede ser un var(...) (propertyTypeConfig.ts),
          // pegarle texto hex directo da un valor de color inválido.
          background: `
            radial-gradient(ellipse at 30% 50%, color-mix(in srgb, ${colors.glow} 19%, transparent) 0%, transparent 65%),
            linear-gradient(150deg, ${colors.from} 0%, ${colors.to} 100%)
          `,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {showImg && (
          <img
            src={marker.foto!}
            alt={marker.titulo}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        )}
        {!showImg && (
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${colors.accent} 8%, transparent)`, border: `1.5px solid color-mix(in srgb, ${colors.accent} 16%, transparent)`, color: colors.accent }}
          >
            <typeCfg.Icon size={32} strokeWidth={1.5} />
          </div>
        )}

        {/* Top chips */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${
            marker.operacion === 'venta' ? 'bg-brand text-white' : 'bg-accent text-white'
          }`}>
            {marker.operacion === 'venta' ? 'Venta' : 'Renta'}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/30 text-white backdrop-blur-sm">
            {typeCfg.label}
          </span>
        </div>

        {/* Price gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-5 pb-4 pt-12">
          <p className="text-3xl font-black text-white leading-none drop-shadow-lg">
            {formatPriceShort(marker.precio)}
            {marker.operacion === 'renta' && (
              <span className="text-base font-semibold text-white/65 ml-1">/mes</span>
            )}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-4 pb-2">
        <p className="text-base font-bold text-gray-900 line-clamp-2 leading-snug mb-3">
          {marker.titulo}
        </p>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin size={13} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-500 truncate">{marker.colonia}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: RIESGO_COLOR[marker.riesgoInundacion] }}
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {RIESGO_LABEL[marker.riesgoInundacion]}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 pt-3">
        <Link
          href={`/propiedades/${marker.slug}`}
          className="flex items-center justify-center gap-2 w-full bg-brand hover:bg-brand-dark
                     text-white font-bold text-sm py-3.5 rounded-2xl transition-colors
                     shadow-md shadow-brand/20"
        >
          Ver propiedad completa <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

interface Props { allProperties: Property[] }

export function MapaClient({ allProperties }: Props) {
  const { filters, updateFilters, clearFilters, activeCount } = useFilters();

  // `allProperties` ya viene fresco del backend (ver mapa/page.tsx) — ya no
  // hace falta fusionarlo con ninguna simulación local.
  const properties = allProperties;

  const [panelOpen,     setPanelOpen]     = useState(false);
  const [riesgoActive,  setRiesgoActive]  = useState<Set<RiesgoLevel>>(new Set(['bajo', 'medio', 'alto']));
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [activeBounds,  setActiveBounds]  = useState<MapBounds | null>(null);
  const [tileType,      setTileType]      = useState<TileType>('street');
  const [mapControls,   setMapControls]   = useState<MapControls | null>(null);
  const [activeZone,    setActiveZone]    = useState<string | null>(null);
  const [geoLoading,    setGeoLoading]    = useState(false);
  const [geoError,      setGeoError]      = useState('');

  // "Ir a zona" — top colonias reales por cantidad de propiedades activas
  // (mismo criterio que /zonas y Home, ver getColoniasRankedByPropiedades),
  // resolviendo cada una contra el catálogo de coordenadas verificadas
  // (matchColonia) para obtener lat/lng/radio reales. Se calcula una sola
  // vez sobre el catálogo estático del servidor — igual que /zonas y Home
  // (páginas de servidor), no reacciona a publicaciones locales de este
  // navegador; sería inconsistente que el mapa mostrara una colonia
  // "de moda" que nadie más ve. Las colonias rankeadas que no tengan
  // coordenada verificada (ej. detectadas por texto libre, sin catálogo)
  // se descartan aquí — no hay a dónde volar sin lat/lng real.
  const [zonasIrA, setZonasIrA] = useState<{ label: string; lat: number; lng: number; radius: number }[]>([]);
  useEffect(() => {
    let cancelado = false;
    getColoniasRankedByPropiedades().then((coloniasRanked) => {
      if (cancelado) return;
      setZonasIrA(
        coloniasRanked
          .map((c) => {
            const coord = matchColonia(c.nombre);
            return coord ? { label: c.nombre, lat: coord.lat, lng: coord.lng, radius: coord.radioKm * 1000 } : null;
          })
          .filter((z): z is { label: string; lat: number; lng: number; radius: number } => z !== null)
          .slice(0, MAX_ZONAS_IR_A)
      );
    });
    return () => { cancelado = true; };
  }, []);

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
  // visible como filtro. Ahora se aplica solo al mover/hacer zoom — es
  // filtrado local instantáneo (sin costo de red), así que no hace falta
  // el paso manual, y libera ese espacio para la leyenda de privacidad.
  function handleBoundsChange(bounds: MapBounds) {
    if (!boundsInitializedRef.current) { boundsInitializedRef.current = true; return; }
    setActiveBounds(bounds);
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
  let filtered = applyFilters(properties, filters)
    .filter((p) => riesgoActive.has((p.riesgoInundacion ?? 'bajo') as RiesgoLevel));
  if (activeBounds) filtered = filtered.filter((p) => isInBounds(p, activeBounds));

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
    <div className="relative z-0 flex h-[calc(100vh-64px)]">

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
          <p className="text-sm text-white/45 mt-0.5">
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

          {/* Riesgo de inundación */}
          <div className="bg-brand-dark rounded-xl shadow-xl p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase tracking-wider mb-2.5">
              <Droplets size={12} /> Inundación
            </p>
            <div className="space-y-0.5">
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
          </div>

          {/* Ir a zona — oculta por completo si ninguna colonia rankeada
              resolvió coordenada verificada, en vez de mostrar una
              tarjeta vacía. */}
          {zonasIrA.length > 0 && (
          <div className="bg-brand-dark rounded-xl shadow-xl p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase tracking-wider mb-2.5">
              <MapPin size={12} /> Ir a zona
            </p>
            <div className="flex flex-col gap-0.5">
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
          </div>
          )}

        </div>

        {/* ── Top overlay ── */}
        <div className="absolute top-3 left-3 right-3 lg:right-64 z-[1001] flex flex-col gap-2 pointer-events-none">

          {/* Chips row — en móvil los chips de tipo (Todos/Casa/Depto/
              Terreno/Local...) no caben todos y el overflow-x-auto los
              corta en seco justo en el borde de la pantalla sin ninguna
              pista de que se puede seguir deslizando (bug real confirmado
              en auditoría de responsividad, 2026-08-10: "Local" quedaba
              cortado a la mitad, ilegible). Mismo degradado de máscara que
              ya usa el marquee de la Home (src/app/page.tsx) para el mismo
              problema, con un ancho menor (24px) porque aquí el contenedor
              es angosto (ancho de pantalla) — 90px se comía casi todos los
              chips visibles a la vez. */}
          <div className="flex items-center gap-1.5 overflow-x-auto pointer-events-auto"
               style={{
                 scrollbarWidth: 'none',
                 maskImage: 'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
                 WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
               }}>

            {/* Mobile: filter button */}
            <button
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

          {/* Leyenda de privacidad: los pines no son la ubicación exacta */}
          <div className="flex justify-center">
            <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm shadow-md
                            border border-gray-200 text-gray-600 text-xs font-medium
                            px-3.5 py-1.5 rounded-full">
              <Info size={12} className="text-brand flex-shrink-0" />
              Los pines muestran la zona aproximada, no la ubicación exacta
            </div>
          </div>
        </div>

        {/* ── Right floating buttons ── */}
        <div className="absolute bottom-20 right-3 z-[1001] flex flex-col gap-2">
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
            className="hidden pointer-coarse:flex w-10 h-10 bg-white shadow-lg border border-gray-200 rounded-xl
                       items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {tileType === 'street' ? <Satellite size={16} /> : <MapIcon size={16} />}
          </button>

          {/* Mi ubicación */}
          <button
            onClick={handleGeolocate}
            disabled={geoLoading}
            title="Mi ubicación"
            className="w-10 h-10 bg-white shadow-lg border border-gray-200 rounded-xl
                       flex items-center justify-center text-gray-600
                       hover:bg-brand-pale hover:text-brand hover:border-brand/30
                       transition-all disabled:opacity-50"
          >
            {geoLoading
              ? <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              : <Navigation size={16} />}
          </button>
        </div>

        {/* Geo error tooltip */}
        {geoError && (
          <div className="absolute bottom-36 right-3 z-[1001] bg-red-50 border border-red-200
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
          <SelectedCard
            marker={selectedMarker}
            onClose={() => setSelectedMarker(null)}
          />
        )}
      </div>

      {/* ══ Mobile filter drawer ═════════════════════════════════════════ */}
      {panelOpen && (
        <div className="fixed inset-0 z-[1200] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPanelOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-full bg-brand-dark overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="font-semibold text-white">Filtrar mapa</h2>
              <button onClick={() => setPanelOpen(false)} className="text-white/50 hover:text-white transition-colors">
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
