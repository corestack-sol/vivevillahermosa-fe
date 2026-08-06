'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PIN_ICON = L.divIcon({
  html: '<div style="width:20px;height:20px;background:#4f46e5;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 10px rgba(79,70,229,0.5)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  className: '',
});

export interface Coords { lat: number; lng: number }

function ClickHandler({ onPlace }: { onPlace: (c: Coords) => void }) {
  useMapEvents({ click: (e) => onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }) });
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
}

export function MapPicker({ value, onChange, center = [17.9869, -92.9303] }: MapPickerProps) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : center}
      zoom={14}
      style={{ height: '100%', width: '100%' }}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <CenterController center={center} hasPin={!!value} />
      <ClickHandler onPlace={onChange} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={PIN_ICON}
          draggable
          eventHandlers={{
            dragend(e) {
              const p = (e.target as L.Marker).getLatLng();
              onChange({ lat: p.lat, lng: p.lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
