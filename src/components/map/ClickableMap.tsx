'use client';

import { useRouter } from 'next/navigation';
import { MapViewDynamic } from './MapViewDynamic';
import type { MapMarker } from './MapView';

interface ClickableMapProps {
  markers: MapMarker[];
  zoom?: number;
  center?: [number, number];
}

/**
 * Mapa de solo resumen donde tocar un pin manda directo a la ficha de la
 * propiedad — sin tarjeta intermedia ni panel lateral (eso es lo que hace
 * /mapa, con MapaClient). Se usa en vistas donde el mapa es secundario,
 * como el mini-mapa de riesgo del home, que antes no tenía ningún
 * `onMarkerSelect` — el clic en un pin no hacía nada.
 */
export function ClickableMap({ markers, zoom, center }: ClickableMapProps) {
  const router = useRouter();

  return (
    <MapViewDynamic
      markers={markers}
      zoom={zoom}
      center={center}
      onMarkerSelect={(marker) => {
        if (marker) router.push(`/propiedades/${marker.slug}`);
      }}
    />
  );
}
