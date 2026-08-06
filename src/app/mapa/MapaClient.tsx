'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  SlidersHorizontal, X, ChevronLeft, ChevronDown, Navigation,
  Satellite, Map as MapIcon, Info, MapPin, ArrowRight,
  Droplets, Check, Home,
} from 'lucide-react';
import Link from 'next/link';
import type { Property } from '@/types/property';
import type { PropertyType, OperationType } from '@/types/property';
import { useFilters } from '@/hooks/useFilters';
import { applyFilters } from '@/lib/filters';
import { FilterPanel } from '@/components/search/FilterPanel';
import { MapViewDynamic } from '@/components/map/MapViewDynamic';
import { formatPrice, formatPriceShort } from '@/lib/format';
import { getPropertyTypeConfig } from '@/lib/propertyTypeConfig';
import type { MapMarker, MapControls, MapBounds } from '@/components/map/MapView';
import { aplicarOverridesPublicos, PROPIEDADES_LOCALES_EVENT } from '@/lib/propiedadesLocales';
import { ESTADO_OVERRIDE_EVENT } from '@/lib/estadoOverrides';

// ── Config ──────────────────────────────────────────────────────────────

type RiesgoLevel = 'bajo' | 'medio' | 'alto';
type TileType    = 'street' | 'satellite';

const RIESGO_CFG = [
  { level: 'bajo'  as RiesgoLevel, color: '#10B981', short: 'Bajo',  long: 'Bajo / Zona segura' },
  { level: 'medio' as RiesgoLevel, color: '#F59E0B', short: 'Medio', long: 'Riesgo medio'        },
  { level: 'alto'  as RiesgoLevel, color: '#EF4444', short: 'Alto',  long: 'Riesgo alto'          },
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

// Coordenadas alineadas con src/data/zones.json (fuente de verdad de las
// colonias) — antes esta lista era independiente y había divergido: 6 de 7
// zonas apuntaban entre 2 y 6 km lejos de su ubicación real en zones.json
// (ej. "Tab. 2000" mandaba a 6km de la colonia real). zoom/radius son solo
// configuración visual, no coordenadas, así que se mantienen igual.
const ZONES = [
  { label: 'Centro',       lat: 17.9895, lng: -92.9478, zoom: 15, radius: 700  },
  { label: 'Tab. 2000',    lat: 17.9994, lng: -92.9316, zoom: 15, radius: 950  },
  { label: 'Gaviotas',     lat: 18.0141, lng: -92.9312, zoom: 15, radius: 850  },
  { label: 'Atasta',       lat: 17.9923, lng: -92.9178, zoom: 15, radius: 700  },
  { label: 'Olmeca',       lat: 17.9812, lng: -92.9502, zoom: 15, radius: 800  },
  { label: 'Carrizal',     lat: 17.9875, lng: -92.9421, zoom: 15, radius: 900  },
  { label: 'Framboyanes',  lat: 18.0056, lng: -92.9288, zoom: 15, radius: 750  },
];

const RIESGO_LABEL: Record<string, string> = {
  bajo: 'Zona segura', medio: 'Riesgo medio', alto: 'Riesgo alto',
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
        className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/30 hover:bg-black/50
                   text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
      >
        <X size={14} />
      </button>

      {/* Image / gradient header */}
      <div
        className="relative h-60 overflow-hidden flex items-center justify-center"
        style={{
          background: `
            radial-gradient(ellipse at 30% 50%, ${colors.glow}30 0%, transparent 65%),
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
            style={{ background: `${colors.accent}15`, border: `1.5px solid ${colors.accent}28`, color: colors.accent }}
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

  // Mismo merge que /propiedades (ver PropertiesClient.tsx) — arranca con el
  // catálogo del servidor y se completa con lo publicado/editado/pausado/
  // eliminado en este navegador justo después de montar.
  // ⚠️ BACKEND: deja de hacer falta con `GET /api/propiedades` real — ver
  // el comentario de aplicarOverridesPublicos en propiedadesLocales.ts.
  const [properties, setProperties] = useState(allProperties);
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

  const [panelOpen,     setPanelOpen]     = useState(false);
  const [riesgoActive,  setRiesgoActive]  = useState<Set<RiesgoLevel>>(new Set(['bajo', 'medio', 'alto']));
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [activeBounds,  setActiveBounds]  = useState<MapBounds | null>(null);
  const [tileType,      setTileType]      = useState<TileType>('street');
  const [mapControls,   setMapControls]   = useState<MapControls | null>(null);
  const [activeZone,    setActiveZone]    = useState<string | null>(null);
  const [geoLoading,    setGeoLoading]    = useState(false);
  const [geoError,      setGeoError]      = useState('');
  const [listOpen,      setListOpen]      = useState(true);

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
    id: p.id, slug: p.slug, lat: p.lat, lng: p.lng,
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

        {/* ══ Right map panel — desktop only ══════════════════════════════ */}
        <div className="absolute top-3 right-3 z-[1001] hidden lg:flex flex-col gap-2 w-56">

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

          {/* Ir a zona */}
          <div className="bg-brand-dark rounded-xl shadow-xl p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase tracking-wider mb-2.5">
              <MapPin size={12} /> Ir a zona
            </p>
            <div className="flex flex-col gap-0.5">
              {ZONES.map((zone) => {
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
                        mapControls?.flyTo(zone.lat, zone.lng, zone.zoom);
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
                    {zone.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Propiedades */}
          <div className="bg-brand-dark rounded-xl shadow-xl overflow-hidden">
            <button
              onClick={() => setListOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5"
            >
              <p className="flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase tracking-wider">
                <Home size={12} /> {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
              </p>
              <ChevronDown
                size={13}
                className={`text-white/40 transition-transform duration-200 ${listOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {listOpen && (
              <div className="border-t border-white/10 max-h-52 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-xs text-center text-white/35 py-4">Sin resultados.</p>
                ) : (
                  <>
                    {filtered.slice(0, 20).map((p) => {
                      const itemCfg = getPropertyTypeConfig(p.tipo);
                      return (
                      <Link
                        key={p.id}
                        href={`/propiedades/${p.slug}`}
                        className="flex items-start gap-2 px-3 py-2 border-b border-white/8 hover:bg-white/10 transition-colors"
                      >
                        <itemCfg.Icon size={15} strokeWidth={2} className="flex-shrink-0 mt-0.5 text-white/60" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white/90 truncate leading-snug">{p.titulo}</p>
                          <p className="text-xs font-bold text-accent mt-0.5">{formatPrice(p.precio, p.operacion)}</p>
                        </div>
                      </Link>
                      );
                    })}
                    {filtered.length > 20 && (
                      <p className="text-xs text-center text-white/35 py-2">
                        +{filtered.length - 20} más
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Top overlay ── */}
        <div className="absolute top-3 left-3 right-3 lg:right-64 z-[1001] flex flex-col gap-2 pointer-events-none">

          {/* Chips row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pointer-events-auto"
               style={{ scrollbarWidth: 'none' }}>

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
          {/* Satellite toggle — mobile only (desktop uses sidebar) */}
          <button
            onClick={() => setTileType((t) => (t === 'street' ? 'satellite' : 'street'))}
            title={tileType === 'street' ? 'Ver satélite' : 'Ver mapa'}
            className="lg:hidden w-10 h-10 bg-white shadow-lg border border-gray-200 rounded-xl
                       flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
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

        {/* ── Mobile: flood risk legend ── */}
        <div className="absolute bottom-6 left-3 bg-white rounded-xl shadow-md border border-gray-200
                        px-3 py-2 lg:hidden z-[1001]">
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
