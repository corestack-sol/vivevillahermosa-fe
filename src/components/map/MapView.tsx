'use client';

import { useEffect, useRef, useState } from 'react';
import { jitterCoord } from '@/lib/colonias';

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
}

const FLOOD_COLORS = { alto: '#EF4444', medio: '#F59E0B', bajo: '#10B981' } as const;
const FLOOD_DARK   = { alto: '#B91C1C', medio: '#D97706', bajo: '#059669' } as const;

const TILES = {
  street: {
    url:  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attr: '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com">CARTO</a>',
  },
  satellite: {
    url:  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: '© Esri, USGS, NOAA',
  },
} as const;

function shortPrice(precio: number, operacion: 'venta' | 'renta'): string {
  let s: string;
  if (precio >= 1_000_000)      s = `$${(precio / 1_000_000).toFixed(precio % 1_000_000 === 0 ? 0 : 1)}M`;
  else if (precio >= 1_000)     s = `$${Math.round(precio / 1_000)}k`;
  else                          s = `$${precio}`;
  return operacion === 'renta' ? `${s}/mo` : s;
}

function pinHtml(color: string, dark: string, label: string, active: boolean): string {
  const shadow = active
    ? `0 2px 10px rgba(0,0,0,.3), 0 0 0 2.5px ${dark}, 0 0 0 5px white, 0 0 0 7px ${color}`
    : `0 2px 8px rgba(0,0,0,.22), 0 0 0 2.5px ${dark}`;
  return `<div style="display:inline-flex;flex-direction:column;align-items:center;cursor:pointer;">
    <div style="background:${color};color:#fff;padding:5px 11px;border-radius:100px;font-size:11.5px;font-weight:800;white-space:nowrap;letter-spacing:0.2px;box-shadow:${shadow};line-height:1;font-family:Inter,system-ui,sans-serif;">${label}</div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${dark};margin-top:-1px;"></div>
  </div>`;
}

function clusterHtml(count: number): string {
  const size = count > 99 ? 44 : 38;
  const fs   = count > 99 ? 11 : 13;
  return `<div style="background:#0D7065;color:#fff;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${fs}px;font-family:Inter,system-ui,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.3),0 0 0 3px #fff;">${count}</div>`;
}

export function MapView({
  markers,
  center = [17.9893, -92.9458],
  zoom = 12,
  height = '100%',
  tileType = 'street',
  selectedId = null,
  onMarkerSelect,
  onBoundsChange,
  onMapReady,
  approximate = false,
  approximateRadius = 350,
}: MapViewProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const tileRef         = useRef<any>(null);
  const clusterRef      = useRef<any>(null);
  const lmRef           = useRef<Map<string, any>>(new Map());
  const circleRef       = useRef<any>(null);
  const skipMapClickRef = useRef(false);
  const [ready, setReady] = useState(false);

  // ── Init map once ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let alive = true;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      try {
        await import('leaflet.markercluster');
        await import('leaflet.markercluster/dist/MarkerCluster.css');
        await import('leaflet.markercluster/dist/MarkerCluster.Default.css');
      } catch { /* clustering not available — graceful fallback */ }
      if (!alive) return;

      const map = L.map(containerRef.current!, {
        center, zoom,
        zoomControl: false,
        scrollWheelZoom: true,
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      tileRef.current = L.tileLayer(TILES.street.url, {
        attribution: TILES.street.attr,
        maxZoom: 19,
      }).addTo(map);

      map.on('moveend zoomend', () => {
        if (!onBoundsChange) return;
        const b = map.getBounds();
        onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
      });

      map.on('click', () => {
        if (skipMapClickRef.current) { skipMapClickRef.current = false; return; }
        onMarkerSelect?.(null);
      });

      onMapReady?.({
        flyTo: (lat, lng, z = 14) => map.flyTo([lat, lng], z, { duration: 0.8 }),
        showZoneCircle: (lat, lng, radius) => {
          circleRef.current?.remove();
          circleRef.current = L.circle([lat, lng], {
            radius,
            color:       '#0D7065',
            fillColor:   '#0D7065',
            fillOpacity: 0.07,
            weight:      2,
            opacity:     0.55,
            dashArray:   '8 6',
          }).addTo(map);
        },
        clearZoneCircle: () => {
          circleRef.current?.remove();
          circleRef.current = null;
        },
      });

      mapRef.current = map;
      setReady(true);
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

  // ── Tile layer switch ──
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const L = (await import('leaflet')).default;
      tileRef.current?.remove();
      const t = TILES[tileType];
      tileRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(mapRef.current);
    })();
  }, [tileType, ready]);

  // ── Zona aproximada (privacidad) — círculo en vez de pin exacto ──
  useEffect(() => {
    if (!ready) return;
    if (!approximate) return;
    (async () => {
      const L = (await import('leaflet')).default;
      circleRef.current?.remove();
      circleRef.current = L.circle(center, {
        radius: approximateRadius,
        color: '#0D7065',
        fillColor: '#0D7065',
        fillOpacity: 0.1,
        weight: 2,
        opacity: 0.6,
        dashArray: '8 6',
      }).addTo(mapRef.current);
      mapRef.current.setView(center, zoom);
    })();
    return () => { circleRef.current?.remove(); circleRef.current = null; };
  }, [approximate, approximateRadius, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Markers / clustering ──
  useEffect(() => {
    if (!ready || approximate) return;
    (async () => {
      const L = (await import('leaflet')).default;
      const hasCluster = !!(L as any).markerClusterGroup;

      if (clusterRef.current) { clusterRef.current.remove(); clusterRef.current = null; }
      lmRef.current.forEach((m) => m.remove());
      lmRef.current.clear();

      let container: any;
      if (hasCluster) {
        clusterRef.current = (L as any).markerClusterGroup({
          maxClusterRadius: 55,
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          iconCreateFunction: (cluster: any) => {
            const n = cluster.getChildCount();
            const sz = n > 99 ? 44 : 38;
            return L.divIcon({
              className: '',
              html: clusterHtml(n),
              iconSize:   [sz, sz] as [number, number],
              iconAnchor: [sz / 2, sz / 2] as [number, number],
            });
          },
        });
        container = clusterRef.current;
      } else {
        container = mapRef.current;
      }

      markers.forEach((m) => {
        const color  = FLOOD_COLORS[m.riesgoInundacion];
        const dark   = FLOOD_DARK[m.riesgoInundacion];
        const active = selectedId === m.id;
        const icon   = L.divIcon({
          className:  '',
          html:       pinHtml(color, dark, shortPrice(m.precio, m.operacion), active),
          iconSize:   undefined,
          iconAnchor: [38, 29] as [number, number],
        });

        const lm = L.marker(jitterCoord(m.id, m.lat, m.lng), { icon, zIndexOffset: active ? 1000 : 0 });
        lm.on('click', (e: any) => {
          e.originalEvent?.stopPropagation();
          skipMapClickRef.current = true;
          onMarkerSelect?.(m);
        });
        container.addLayer(lm);
        lmRef.current.set(m.id, lm);
      });

      if (hasCluster) mapRef.current.addLayer(clusterRef.current);
    })();
  }, [markers, selectedId, ready, onMarkerSelect]);

  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}
