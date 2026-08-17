'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { estaEnTabasco, TABASCO_BOUNDS } from '@/lib/tabascoBoundary';

const PIN_ICON = L.divIcon({
  html: '<div style="width:20px;height:20px;background:#4f46e5;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 10px rgba(79,70,229,0.5)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  className: '',
});

export interface Coords { lat: number; lng: number }

// Rechaza el clic en vez de colocar el pin cuando cae fuera de la frontera
// real de Tabasco (src/lib/tabascoBoundary.ts) — `maxBounds` de abajo ya
// impide navegar MUY lejos del estado, pero es un rectángulo con margen
// (Leaflet no restringe panning a un polígono real), así que sin este
// chequeo alguien todavía podría hacer clic en una esquina del rectángulo
// que en realidad ya es Veracruz/Chiapas/Campeche.
function ClickHandler({ onPlace, onRejected }: { onPlace: (c: Coords) => void; onRejected?: () => void }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      if (estaEnTabasco(lat, lng)) onPlace({ lat, lng });
      else onRejected?.();
    },
  });
  return null;
}

function CenterController({ center, hasPin }: { center: [number, number]; hasPin: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!hasPin) map.setView(center, 14);
  }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export interface MapPickerProps {
  value: Coords | null;
  onChange: (c: Coords) => void;
  center?: [number, number];
  /** Se llama cuando se intenta colocar/arrastrar el pin fuera de Tabasco — para mostrar un aviso, ver PublishForm.tsx. */
  onRejected?: () => void;
}

export function MapPicker({ value, onChange, center = [17.9869, -92.9303], onRejected }: MapPickerProps) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : center}
      zoom={14}
      // Restringe panning/zoom a Tabasco + margen — ver TABASCO_BOUNDS.
      // maxBoundsViscosity=1.0 hace el límite "sólido" (no se puede
      // arrastrar más allá, en vez de solo rebotar tras soltar).
      // minZoom 8 → 9, mismo ajuste que MapView.tsx (2026-08-17).
      maxBounds={TABASCO_BOUNDS}
      maxBoundsViscosity={1.0}
      minZoom={9}
      style={{ height: '100%', width: '100%' }}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <CenterController center={center} hasPin={!!value} />
      <ClickHandler onPlace={onChange} onRejected={onRejected} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={PIN_ICON}
          draggable
          eventHandlers={{
            dragend(e) {
              const marker = e.target as L.Marker;
              const p = marker.getLatLng();
              if (estaEnTabasco(p.lat, p.lng)) {
                onChange({ lat: p.lat, lng: p.lng });
              } else {
                // Regresa el pin a su última posición válida en vez de
                // dejarlo "perdido" fuera del estado — arrastrar y soltar
                // fuera de Tabasco no debe silenciosamente mover el pin ahí.
                marker.setLatLng([value.lat, value.lng]);
                onRejected?.();
              }
            },
          }}
        />
      )}
    </MapContainer>
  );
}
