'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
// maplibre-gl no tiene default export (a diferencia de Leaflet) — solo
// exports nombrados. `Map` choca con el `Map` nativo de JS que ya se usa
// en este archivo (markerByIdRef, positionsRef), por eso el alias.
import type { Map as MaplibreMap, Marker as MaplibreMarker, GeoJSONSource } from 'maplibre-gl';
import Supercluster, { type PointFeature } from 'supercluster';
import { jitterCoord } from '@/lib/colonias';
import { TABASCO_BOUNDS } from '@/lib/tabascoBoundary';
import { shortPrice, circlePolygon, toMaplibreBounds } from '@/lib/mapGeo';
import { getAllMunicipalities } from '@/lib/api';

export interface MapMarker {
  id: string;
  slug: string;
  lat: number;
  lng: number;
  titulo: string;
  precio: number;
  operacion: 'venta' | 'renta';
  tipo: string;
  colonia: string;
  foto: string | null;
  riesgoInundacion: 'alto' | 'medio' | 'bajo';
}

export interface MapControls {
  flyTo:           (lat: number, lng: number, zoom?: number) => void;
  showZoneCircle:  (lat: number, lng: number, radius: number) => void;
  clearZoneCircle: () => void;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface MapViewProps {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  // 'satellite' pendiente de reconstruir sobre el proveedor nuevo — pedido
  // explícito 2026-09-02: migrar a OpenFreeMap/MapLibre GL, pero SIN la
  // vista satelital por ahora. El prop se deja (nada que lo consume se
  // rompe) pero MapView solo sabe dibujar 'street'; 'satellite' cae al
  // mismo estilo hasta que se reconstruya (ver MapaClient.tsx, donde el
  // selector de vista queda oculto mientras tanto).
  tileType?: 'street' | 'satellite';
  selectedId?: string | null;
  onMarkerSelect?: (marker: MapMarker | null) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  onMapReady?: (controls: MapControls) => void;
  /**
   * Si es true, no se dibuja un pin — solo un círculo de zona aproximada
   * centrado en `center`. Este componente ya no es la línea de defensa de
   * privacidad: espera recibir en `markers`/`center` el punto PÚBLICO de
   * cada propiedad (`property.latPublico`/`lngPublico`, ver
   * `getPuntoPublico` en src/lib/colonias.ts), nunca `lat`/`lng` reales —
   * ese enmascaramiento debe pasar antes, al armar los datos, para que la
   * coordenada exacta ni siquiera llegue al navegador.
   */
  approximate?: boolean;
  approximateRadius?: number;
  /**
   * Ajusta el encuadre para que TODOS los marcadores queden visibles, en
   * vez de usar `center`/`zoom` fijos — pensado para mapas de "resumen"
   * sin panel de filtros ni navegación manual (ClickableMap, hoy solo el
   * mini-mapa de destacadas del Home). Bug real encontrado (2026-08-09):
   * ese mapa mandaba `zoom={11}` sin `center`, así que caía en el default
   * de Centro/Villahermosa — 3 de las 5 propiedades destacadas quedaban
   * dentro del encuadre (a 2-3km del centro) y 2 (en Paraíso, a ~53km)
   * quedaban completamente fuera de vista, sin ningún aviso de que
   * existían. `false` por default para no romper /mapa (MapaClient) ni el
   * mapa embebido de /propiedades, que sí dependen de `center`/`zoom`
   * explícitos porque el usuario navega/filtra el mapa a mano.
   */
  fitToMarkers?: boolean;
  /**
   * Piso de zoom-out. Default 8 — bajado desde 10 (pedido explícito
   * 2026-09-02: "no puedo hacer zoom out para ver el mapa completo de
   * Tabasco"). El valor anterior (subido 8→9→10 en 2026-08-17 a base de
   * ajustes sucesivos, sin verificar contra el tamaño real del estado)
   * resultó ser MÁS ALTO que el zoom mínimo real para que quepa
   * TABASCO_BOUNDS completo: calculado con la misma fórmula estándar de
   * Mercator que usa cualquier librería de mapas (fitBounds), un
   * viewport de escritorio típico necesita ~zoom 9 para ver el estado
   * completo, uno de celular ~zoom 7 — con minZoom=10 era matemáticamente
   * imposible alejarse lo suficiente en ningún dispositivo, no un
   * problema del botón. 8 deja margen real de sobra sobre el mínimo
   * calculado (9.3 en desktop) sin regresar al extremo original (el
   * primer valor histórico, antes de la serie de ajustes sin verificar).
   * El mini-mapa del Home (ClickableMap, `fitToMarkers`) sigue con su
   * propio override más bajo (`minZoom={7}`, ver src/app/page.tsx) —
   * ~28 marcadores repartidos en todo el estado dentro de una caja de
   * apenas 320px necesitan alejarse todavía más que un mapa a pantalla
   * completa.
   */
  minZoom?: number;
  /**
   * Dibuja el nombre de los 17 municipios sobre el mapa, siempre visible —
   * pedido explícito 2026-09-01: "no veo los municipios Centla, Jalpa de
   * Méndez... se deben poder ver los 17". No es un bug de este código: los
   * nombres de lugar que ya trae el estilo `liberty` de OpenFreeMap vienen
   * de OSM (`source-layer: place`, ver `label_town`/`label_village` en su
   * style.json), y varias cabeceras municipales de Tabasco están
   * catalogadas ahí con una categoría/población baja que el propio estilo
   * oculta hasta zooms más altos — no hay forma de "arreglar" eso desde
   * este lado, la fuente de datos no es nuestra. La solución real es dejar
   * de depender de esos labels para algo tan básico como los 17 municipios
   * y dibujar los nuestros, con las coordenadas ya verificadas de
   * `src/data/municipalities.json` (mismo dato que ya usa /zonas). `false`
   * por default para no aparecer en MapPicker.tsx (elegir pin al publicar,
   * zoom a nivel colonia, no necesita orientación a nivel estado) — el
   * mini-mapa de destacadas del Home sí los activa explícitamente desde
   * 2026-09-03 (pedido explícito, mismo criterio que /mapa).
   */
  showMunicipioLabels?: boolean;
}

const FLOOD_COLORS = { alto: '#EF4444', medio: '#F59E0B', bajo: '#10B981' } as const;
const FLOOD_DARK   = { alto: '#B91C1C', medio: '#D97706', bajo: '#059669' } as const;

// Migrado de Esri World_Topo_Map (raster + filtro CSS) a OpenFreeMap/
// MapLibre GL (pedido explícito 2026-09-02: "solución a largo plazo" —
// sin límite de cuota, y con tiles VECTORIALES en vez de imagen, así que
// el estilo ("colores de Google Maps", pedido previo) se logra pintando
// cada tipo de elemento por separado en vez de un filtro CSS global sobre
// toda la imagen, que nunca iba a poder distinguir agua de calles. El
// estilo 'liberty' de OpenFreeMap ya trae, sin ningún ajuste extra
// (verificado leyendo su style.json real): agua rgb(158,189,255) —
// prácticamente el azul de Google —, fondo #f8f4f0 (casi blanco), parques
// #d8e8c8 (verde suave) y autopistas en naranja/amarillo — el mismo
// lenguaje visual que Google Maps, sin necesidad de tocar paint
// properties a mano.
const STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// server.arcgisonline.com no exige llave — se mantiene SOLO como reserva
// para el día que se reconstruya la vista satelital (fuera de alcance
// ahora), no se usa en ningún render actual.
const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
void SATELLITE_TILE_URL;

function pinHtml(color: string, dark: string, label: string, active: boolean): string {
  const shadow = active
    ? `0 2px 10px rgba(0,0,0,.3), 0 0 0 2.5px ${dark}, 0 0 0 5px white, 0 0 0 7px ${color}`
    : `0 2px 8px rgba(0,0,0,.22), 0 0 0 2.5px ${dark}`;
  return `<div style="display:inline-flex;flex-direction:column;align-items:center;cursor:pointer;">
    <div style="background:${color};color:#fff;padding:5px 11px;border-radius:100px;font-size:11.5px;font-weight:800;white-space:nowrap;letter-spacing:0.2px;box-shadow:${shadow};line-height:1;font-family:Inter,system-ui,sans-serif;">${label}</div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${dark};margin-top:-1px;"></div>
  </div>`;
}

// pointer-events:none — es solo texto informativo, un clic ahí debe llegar
// al pin/cluster o al fondo del mapa que tiene debajo, nunca quedarse
// atrapado en el label. text-shadow en 4 direcciones simula el halo blanco
// que sí tiene el texto de una capa `symbol` (aquí es HTML normal, no hay
// `text-halo-*`).
function municipioLabelHtml(nombre: string): string {
  return `<div style="pointer-events:none;white-space:nowrap;font-weight:800;font-size:12.5px;letter-spacing:0.2px;font-family:Inter,system-ui,sans-serif;color:#0D7065;text-shadow:-1.5px -1.5px 0 #fff,1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px 1.5px 0 #fff,0 0 4px #fff;">${nombre}</div>`;
}

function clusterHtml(count: number): string {
  const size = count > 99 ? 44 : 38;
  const fs   = count > 99 ? 11 : 13;
  return `<div style="background:#0D7065;color:#fff;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${fs}px;font-family:Inter,system-ui,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.3),0 0 0 3px #fff;cursor:pointer;">${count}</div>`;
}

/** Convierte un string HTML en el elemento DOM real que pide el `Marker` de MapLibre (no acepta HTML string directo, a diferencia de Leaflet). */
function elementFromHtml(html: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.firstElementChild as HTMLElement;
}

const MAPLIBRE_MAX_BOUNDS = toMaplibreBounds(TABASCO_BOUNDS);

const ZONE_CIRCLE_SOURCE = 'zone-circle';

export function MapView({
  markers,
  center = [17.9893, -92.9458],
  zoom = 12,
  height = '100%',
  selectedId = null,
  onMarkerSelect,
  onBoundsChange,
  onMapReady,
  approximate = false,
  approximateRadius = 350,
  fitToMarkers = false,
  minZoom = 8,
  showMunicipioLabels = false,
}: MapViewProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<MaplibreMap | null>(null);
  const markersOnMapRef = useRef<MaplibreMarker[]>([]);
  // Constructores de maplibre-gl guardados tras el import dinámico inicial
  // (módulo ya no tiene un solo namespace `L`-style con default export) —
  // así renderClusters() no tiene que volver a `await import(...)` en cada
  // pan/zoom, y de paso queda 100% síncrono (sin eso, dos llamadas
  // seguidas de renderClusters — ej. paneo rápido — podían resolver sus
  // imports en cualquier orden y pintar marcadores viejos encima de los
  // nuevos).
  const MarkerCtorRef = useRef<typeof MaplibreMarker | null>(null);
  const LngLatBoundsCtorRef = useRef<typeof import('maplibre-gl').LngLatBounds | null>(null);
  const clusterIndexRef = useRef<Supercluster<{ id: string }> | null>(null);
  const positionsRef    = useRef<Map<string, [number, number]>>(new Map()); // id -> [lng,lat] tras el jitter
  const markerByIdRef   = useRef<Map<string, MapMarker>>(new Map());
  const [ready, setReady] = useState(false);

  // Refs para que el listener de moveend/zoomend (agregado una sola vez)
  // siempre lea el valor más reciente sin tener que reagregarse — mismo
  // criterio que ya se usa en otras partes del proyecto para listeners de
  // module-level/DOM que no deben reconstruirse en cada render. Se
  // sincronizan en un efecto, no durante el render (un ref es un valor
  // mutable fuera del ciclo de render de React).
  const selectedIdRef = useRef(selectedId);
  const onMarkerSelectRef = useRef(onMarkerSelect);
  useEffect(() => {
    selectedIdRef.current = selectedId;
    onMarkerSelectRef.current = onMarkerSelect;
  });

  // ── Init map once ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let alive = true;

    (async () => {
      const { Map: MaplibreMapCtor, NavigationControl, Marker, LngLatBounds, setWorkerUrl } = await import('maplibre-gl');
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (!alive || !containerRef.current) return;
      MarkerCtorRef.current = Marker;
      LngLatBoundsCtorRef.current = LngLatBounds;
      // Turbopack no resuelve bien el `import.meta.url` con el que
      // MapLibre intenta detectar la URL de su propio worker — sin esto,
      // el mapa monta pero nunca pinta ningún tile (ver
      // scripts/copy-maplibre-worker.mjs para el detalle completo).
      setWorkerUrl('/maplibre-gl-worker.mjs');

      const map = new MaplibreMapCtor({
        container: containerRef.current,
        style: STREET_STYLE,
        center: [center[1], center[0]],
        zoom,
        // No tiene sentido navegar el mapa de propiedades más allá de
        // Tabasco — todo el catálogo está adentro (ver tabascoBoundary.ts,
        // que también bloquea publicar fuera del estado). A diferencia de
        // Leaflet, maxBounds de MapLibre ya es un límite sólido por
        // definición — no existe un equivalente a maxBoundsViscosity
        // porque no hace falta, nunca "rebota", solo topa.
        maxBounds: MAPLIBRE_MAX_BOUNDS,
        minZoom,
        attributionControl: { compact: true },
      });

      map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');

      // `onMapReady` se dispara DENTRO de 'load', no justo después de crear
      // el mapa — a diferencia de Leaflet (listo de inmediato tras
      // `L.map()`), MapLibre necesita el estilo cargado antes de poder
      // `addSource`/`addLayer` (lo que hacen showZoneCircle/clearZoneCircle
      // más abajo); llamarlas antes de tiempo lanza una excepción real.
      // Riesgo bajo en la práctica (mapControls solo se usa por acción
      // directa de la persona, nunca automático al montar — MapaClient.tsx
      // guarda los controles en estado y el estilo carga mucho antes de
      // que alguien alcance a hacer clic en algo), pero es la forma
      // correcta de todos modos.
      map.on('load', () => {
        if (!alive) return;
        mapRef.current = map;
        setReady(true);

        if (showMunicipioLabels) {
          // Antes esto era una capa `symbol` sobre el canvas — se veía bien
          // en un mapa vacío, pero en la práctica CASI SIEMPRE hay un pin o
          // un círculo de cluster de propiedades justo sobre el centroide de
          // un municipio (Cárdenas y Villahermosa, los dos con más
          // propiedades, tapados casi siempre). Los Marker de MapLibre son
          // elementos DOM aparte del `<canvas>` — SIEMPRE se dibujan encima
          // de cualquier capa del estilo, sin excepción, así que ningún
          // ajuste de esa capa (offset, halo, orden de capas) podía ganarle
          // a un pin/cluster que también es DOM. Bug real reportado
          // 2026-09-02: "solo veo 15 [de 17] municipios" — los 2 que
          // faltaban eran justo los que sí tenían pines encima. Se
          // reconstruye como Marker (mismo mecanismo que los pines/clusters
          // de abajo) con z-index explícito más alto, para que SIEMPRE gane
          // el empate visual contra cualquier pin/cluster que caiga en el
          // mismo punto — la única forma real de garantizar los 17 siempre
          // visibles.
          getAllMunicipalities().forEach((m) => {
            const nombre = m.id === 'centro' ? 'Villahermosa' : m.nombre;
            const el = elementFromHtml(municipioLabelHtml(nombre));
            el.style.zIndex = '5';
            new Marker({ element: el, anchor: 'center' }).setLngLat([m.lng, m.lat]).addTo(map);
          });

          // Sin esto, el municipio queda con DOS nombres encimados: el
          // negro que ya trae 'liberty' desde OSM (source-layer "place",
          // ver el comentario de `showMunicipioLabels` en MapViewProps) y
          // el verde de los Marker de arriba — bug real reportado
          // 2026-09-01, visible en varios municipios a la vez. Se apagan
          // los labels de lugar del estilo base en vez de filtrar cuáles
          // coinciden con los 17 (no hay forma simple de saber, desde el
          // filtro declarativo de un layer, "esta ciudad es justo una de
          // esas 17") — los Marker propios ya son la única fuente de
          // verdad para nombre de municipio en este mapa.
          for (const id of ['label_city', 'label_city_capital', 'label_town', 'label_village']) {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
          }
        }

        onMapReady?.({
          flyTo: (lat, lng, z = 14) => map.flyTo({ center: [lng, lat], zoom: z, duration: 800 }),
          showZoneCircle: (lat, lng, radius) => {
            const data = circlePolygon(lat, lng, radius);
            const src = map.getSource(ZONE_CIRCLE_SOURCE) as GeoJSONSource | undefined;
            if (src) { src.setData(data); return; }
            map.addSource(ZONE_CIRCLE_SOURCE, { type: 'geojson', data });
            map.addLayer({
              id: `${ZONE_CIRCLE_SOURCE}-fill`, type: 'fill', source: ZONE_CIRCLE_SOURCE,
              paint: { 'fill-color': '#0D7065', 'fill-opacity': 0.07 },
            });
            map.addLayer({
              id: `${ZONE_CIRCLE_SOURCE}-line`, type: 'line', source: ZONE_CIRCLE_SOURCE,
              paint: { 'line-color': '#0D7065', 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [2, 1.5] },
            });
          },
          clearZoneCircle: () => {
            if (map.getLayer(`${ZONE_CIRCLE_SOURCE}-fill`)) map.removeLayer(`${ZONE_CIRCLE_SOURCE}-fill`);
            if (map.getLayer(`${ZONE_CIRCLE_SOURCE}-line`)) map.removeLayer(`${ZONE_CIRCLE_SOURCE}-line`);
            if (map.getSource(ZONE_CIRCLE_SOURCE)) map.removeSource(ZONE_CIRCLE_SOURCE);
          },
        });
      });

      function notifyBounds() {
        if (!onBoundsChange) return;
        const b = map.getBounds();
        onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
      }
      map.on('moveend', notifyBounds);
      map.on('zoomend', notifyBounds);

      // A diferencia de Leaflet (donde un marcador SÍ vive dentro del mismo
      // árbol de eventos que el mapa, y hacía falta un flag para no
      // deseleccionar al hacer clic en un pin), los Marker de MapLibre son
      // elementos DOM aparte, fuera del <canvas> — un clic ahí nunca llega
      // a este listener, así que no hace falta ningún workaround.
      map.on('click', () => {
        onMarkerSelectRef.current?.(null);
      });
    })();

    return () => {
      alive = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setReady(false);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Avisa a MapLibre cuando el contenedor SÍ cambia de tamaño de verdad ──
  // Antes se llamaba `map.resize()` a mano dentro del efecto de marcadores,
  // sin condición — como ese efecto corre en cada pan/zoom (cada vez que
  // llega un área nueva de propiedades), `resize()` se disparaba en cada
  // uno también. Se pensó "barato cuando no hace falta" (bug real
  // 2026-08-17, chips de filtro reacomodando el layout), pero un trace de
  // rendimiento en vivo (reporte real de latencia al mover el mapa,
  // 2026-09-02) mostró 127ms de forced reflow reales dentro de
  // `_containerDimensions` de MapLibre — nada barato. `ResizeObserver` solo
  // dispara cuando el tamaño de VERDAD cambia, cubriendo el caso original
  // (y cualquier otro) sin pagar el costo en cada pan.
  useEffect(() => {
    if (!ready || !mapRef.current || !containerRef.current) return;
    const map = mapRef.current;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [ready]);

  // ── Zona aproximada (privacidad) — círculo en vez de pin exacto ──
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!approximate) return;
    if (!Number.isFinite(center[0]) || !Number.isFinite(center[1])) return;
    const map = mapRef.current;
    const data = circlePolygon(center[0], center[1], approximateRadius);
    const src = map.getSource(ZONE_CIRCLE_SOURCE) as GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
    } else {
      map.addSource(ZONE_CIRCLE_SOURCE, { type: 'geojson', data });
      map.addLayer({
        id: `${ZONE_CIRCLE_SOURCE}-fill`, type: 'fill', source: ZONE_CIRCLE_SOURCE,
        paint: { 'fill-color': '#0D7065', 'fill-opacity': 0.1 },
      });
      map.addLayer({
        id: `${ZONE_CIRCLE_SOURCE}-line`, type: 'line', source: ZONE_CIRCLE_SOURCE,
        paint: { 'line-color': '#0D7065', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [2, 1.5] },
      });
    }
    map.jumpTo({ center: [center[1], center[0]], zoom });
    return () => {
      if (map.getLayer(`${ZONE_CIRCLE_SOURCE}-fill`)) map.removeLayer(`${ZONE_CIRCLE_SOURCE}-fill`);
      if (map.getLayer(`${ZONE_CIRCLE_SOURCE}-line`)) map.removeLayer(`${ZONE_CIRCLE_SOURCE}-line`);
      if (map.getSource(ZONE_CIRCLE_SOURCE)) map.removeSource(ZONE_CIRCLE_SOURCE);
    };
  }, [approximate, approximateRadius, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dibuja pines/clusters según el índice + el viewport actual ──
  // useCallback con deps [] a propósito: el cuerpo solo lee `.current` de
  // refs (todas estables entre renders), nunca props/state directo — así
  // la función en sí es estable y no hace falta la indirección de un ref
  // aparte para poder llamarla desde un listener agregado una sola vez.
  const renderClusters = useCallback(() => {
    const map = mapRef.current;
    const index = clusterIndexRef.current;
    const MarkerCtor = MarkerCtorRef.current;
    if (!map || !index || !MarkerCtor) return;

    markersOnMapRef.current.forEach((m) => m.remove());
    markersOnMapRef.current = [];

    const b = map.getBounds();
    const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const clusters = index.getClusters(bbox, Math.round(map.getZoom()));

    clusters.forEach((c) => {
      const [lng, lat] = c.geometry.coordinates;
      const props = c.properties as { cluster?: boolean; point_count?: number; cluster_id?: number; id?: string };

      if (props.cluster) {
        const el = elementFromHtml(clusterHtml(props.point_count!));
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const expansionZoom = Math.min(index.getClusterExpansionZoom(props.cluster_id!), 19);
          map.easeTo({ center: [lng, lat], zoom: expansionZoom, duration: 400 });
        });
        const marker = new MarkerCtor({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
        markersOnMapRef.current.push(marker);
        return;
      }

      const original = markerByIdRef.current.get(props.id!);
      if (!original) return;
      const active = selectedIdRef.current === original.id;
      const el = elementFromHtml(pinHtml(
        FLOOD_COLORS[original.riesgoInundacion],
        FLOOD_DARK[original.riesgoInundacion],
        shortPrice(original.precio, original.operacion),
        active,
      ));
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onMarkerSelectRef.current?.(original);
      });
      const marker = new MarkerCtor({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
      markersOnMapRef.current.push(marker);
    });
  }, []);

  // Los clusters dependen del viewport, así que tienen que recalcularse en
  // cada pan/zoom — algo que Leaflet.markercluster hacía solo por dentro
  // del plugin; supercluster no dibuja nada por sí mismo, hay que
  // llamarlo. `renderClusters` es estable (useCallback arriba), así que
  // este listener no necesita reagregarse en cada render.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const handler = () => renderClusters();
    map.on('moveend', handler);
    map.on('zoomend', handler);
    return () => {
      map.off('moveend', handler);
      map.off('zoomend', handler);
    };
  }, [ready, renderClusters]);

  // ── Reconstruye el índice de clustering cuando cambian los marcadores ──
  useEffect(() => {
    if (!ready || !mapRef.current || approximate) return;
    const map = mapRef.current;

    const puntos: PointFeature<{ id: string }>[] = [];
    const posiciones = new Map<string, [number, number]>();
    const porId = new Map<string, MapMarker>();

    markers.forEach((m) => {
      // Un solo pin con coordenada inválida (ej. propiedad local vieja sin
      // latPublico/lngPublico, ver conPuntoPublico en propiedadesLocales.ts)
      // no debe tirar el resto del mapa.
      if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) return;
      const [jLat, jLng] = jitterCoord(m.id, m.lat, m.lng);
      posiciones.set(m.id, [jLng, jLat]);
      porId.set(m.id, m);
      puntos.push({
        type: 'Feature',
        properties: { id: m.id },
        geometry: { type: 'Point', coordinates: [jLng, jLat] },
      });
    });

    // maxZoom por encima del máximo real de interacción del mapa (19) —
    // así, al llegar al zoom máximo, supercluster sigue intentando separar
    // puntos cercanos en vez de dejarlos agrupados sin salida (equivalente
    // al "spiderfy" que traía el plugin de Leaflet).
    const index = new Supercluster<{ id: string }>({ radius: 55, maxZoom: 20 });
    index.load(puntos);
    clusterIndexRef.current = index;
    positionsRef.current = posiciones;
    markerByIdRef.current = porId;

    renderClusters();

    // Ver el comentario de `fitToMarkers` en MapViewProps — encuadra sobre
    // las posiciones YA colocadas (después del jitter de privacidad), no
    // sobre `markers` crudo, para que el encuadre coincida con dónde están
    // los pines de verdad.
    const LngLatBoundsCtor = LngLatBoundsCtorRef.current;
    if (fitToMarkers && posiciones.size > 0 && LngLatBoundsCtor) {
      const coords = Array.from(posiciones.values());
      if (coords.length === 1) {
        map.jumpTo({ center: coords[0], zoom: Math.max(zoom, 13) });
      } else {
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new LngLatBoundsCtor(coords[0], coords[0]),
        );
        map.fitBounds(bounds, { padding: 32, maxZoom: 14, duration: 0 });
      }
    }
  }, [markers, ready, approximate, fitToMarkers, renderClusters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Solo cambió cuál está seleccionado — no hace falta reconstruir el
  //    índice, solo volver a pintar con el estilo activo/inactivo correcto. ──
  useEffect(() => {
    if (!ready || approximate) return;
    renderClusters();
  }, [selectedId, ready, approximate, renderClusters]);

  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}
