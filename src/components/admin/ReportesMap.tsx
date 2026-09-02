'use client';

import { useEffect, useRef, useState } from 'react';
// maplibre-gl no tiene default export (a diferencia de Leaflet) — solo
// exports nombrados, mismo patrón que MapView.tsx/MapPicker.tsx.
import type { Map as MaplibreMap, Marker as MaplibreMarker } from 'maplibre-gl';
import { jitterCoord } from '@/lib/colonias';
import { toMaplibreBounds } from '@/lib/mapGeo';
import { TABASCO_BOUNDS } from '@/lib/tabascoBoundary';

const STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const MAPLIBRE_MAX_BOUNDS = toMaplibreBounds(TABASCO_BOUNDS);

export interface ReporteMapa {
  id: string;
  estado: 'pendiente' | 'revisado' | 'descartado';
  lat: number;
  lng: number;
}

const ESTADO_COLOR: Record<ReporteMapa['estado'], string> = {
  pendiente: '#DC2626',
  revisado: '#0D7065',
  descartado: '#9CA3AF',
};

interface ReportesMapProps {
  reportes: ReporteMapa[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

/**
 * Mapa de admin para /admin/reportes — un punto por reporte, coloreado por
 * estado. Deliberadamente NO reusa MapView.tsx: ese componente está
 * diseñado para búsqueda pública de propiedades (clustering con
 * supercluster, burbuja de precio, color por riesgo de inundación) y nada
 * de eso aplica aquí — forzar ese componente a esta pantalla hubiera
 * significado abusar de campos como `riesgoInundacion` para codificar
 * "estado del reporte", confuso para quien lea el código después. Mismo
 * patrón imperativo de MapLibre que MapView.tsx/MapPicker.tsx (sin
 * wrapper React de MapLibre instalado).
 */
export function ReportesMap({ reportes, selectedId = null, onSelect }: ReportesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const MarkerCtorRef = useRef<typeof MaplibreMarker | null>(null);
  const markersRef = useRef<MaplibreMarker[]>([]);
  const [ready, setReady] = useState(false);

  // El listener de clic de cada punto se agrega una sola vez por marcador
  // (se recrean todos en cada cambio de `reportes`) — el callback en sí
  // puede cambiar entre renders sin que haga falta recrear los marcadores,
  // por eso vive en un ref sincronizado aparte (mismo criterio que
  // MapView.tsx para selectedIdRef/onMarkerSelectRef).
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    onSelectRef.current = onSelect;
    selectedIdRef.current = selectedId;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let alive = true;

    (async () => {
      const { Map: MaplibreMapCtor, NavigationControl, Marker, setWorkerUrl } = await import('maplibre-gl');
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (!alive || !containerRef.current) return;
      MarkerCtorRef.current = Marker;
      setWorkerUrl('/maplibre-gl-worker.mjs');

      const map = new MaplibreMapCtor({
        container: containerRef.current,
        style: STREET_STYLE,
        center: [-92.9458, 17.9893],
        zoom: 8,
        maxBounds: MAPLIBRE_MAX_BOUNDS,
        minZoom: 7,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
      map.on('load', () => {
        if (!alive) return;
        mapRef.current = map;
        setReady(true);
      });
    })();

    return () => {
      alive = false;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Redibuja los puntos cuando cambia la lista de reportes (nueva página,
  // nuevo filtro de estado) — sin clustering, el volumen por página (20)
  // no lo justifica.
  useEffect(() => {
    const map = mapRef.current;
    const MarkerCtor = MarkerCtorRef.current;
    if (!ready || !map || !MarkerCtor) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    reportes.forEach((r) => {
      // Dos reportes sobre la MISMA propiedad caerían exactamente en el
      // mismo punto (indistinguibles, solo el de encima sería clicable) —
      // mismo jitter determinista que ya usa el mapa público para el
      // mismo problema (ver MapView.tsx).
      const [jLat, jLng] = jitterCoord(r.id, r.lat, r.lng);
      const active = selectedIdRef.current === r.id;
      const el = document.createElement('div');
      el.style.cssText = `width:${active ? 20 : 15}px;height:${active ? 20 : 15}px;border-radius:50%;background:${ESTADO_COLOR[r.estado]};border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)${active ? ',0 0 0 3px ' + ESTADO_COLOR[r.estado] + '55' : ''};cursor:pointer;`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(r.id);
      });
      const marker = new MarkerCtor({ element: el, anchor: 'center' }).setLngLat([jLng, jLat]).addTo(map);
      markersRef.current.push(marker);
    });
  }, [reportes, selectedId, ready]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
