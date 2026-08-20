'use client';

import { useRouter } from 'next/navigation';
import { MapViewDynamic } from './MapViewDynamic';
import type { MapMarker } from './MapView';

interface ZoneMapProps {
  markers: MapMarker[];
  center: [number, number];
  zoom: number;
}

// El mapa embebido en /zonas/[slug] es un preview, no la experiencia
// completa de /mapa (sin panel, sin tarjeta flotante) — un clic en un pin
// navega directo a la ficha de esa propiedad, en vez de no hacer nada
// (MapView solo llama onMarkerSelect si se le pasa uno; zonas/[slug]/page.tsx
// es un Server Component y no puede pasarle una función directamente).
export function ZoneMap({ markers, center, zoom }: ZoneMapProps) {
  const router = useRouter();
  return (
    <MapViewDynamic
      markers={markers}
      center={center}
      zoom={zoom}
      onMarkerSelect={(m) => { if (m) router.push(`/propiedades/${m.slug}`); }}
    />
  );
}
