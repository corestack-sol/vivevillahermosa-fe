'use client';

import { useRouter } from 'next/navigation';
import { MapViewDynamic } from './MapViewDynamic';
import type { MapMarker } from './MapView';

interface ClickableMapProps {
  markers: MapMarker[];
  zoom?: number;
  center?: [number, number];
  minZoom?: number;
  showMunicipioLabels?: boolean;
}

/**
 * Mapa de solo resumen donde tocar un pin manda directo a la ficha de la
 * propiedad — sin tarjeta intermedia ni panel lateral (eso es lo que hace
 * /mapa, con MapaClient). Se usa en vistas donde el mapa es secundario,
 * como el mini-mapa de riesgo del home, que antes no tenía ningún
 * `onMarkerSelect` — el clic en un pin no hacía nada.
 *
 * `fitToMarkers` siempre activo aquí — nadie navega este mapa a mano
 * (no hay panel de filtros ni controles de mapa), así que el encuadre
 * TIENE que garantizar que se vean todos los marcadores recibidos. Bug
 * real encontrado (2026-08-09): con un `center`/`zoom` fijo, propiedades
 * destacadas en Paraíso quedaban invisibles fuera del encuadre de
 * Centro/Villahermosa sin ningún aviso — "el mapa solo marca 3
 * propiedades" cuando en realidad había 5, dos simplemente no se veían.
 */
export function ClickableMap({ markers, zoom, center, minZoom, showMunicipioLabels }: ClickableMapProps) {
  const router = useRouter();

  return (
    <MapViewDynamic
      markers={markers}
      zoom={zoom}
      center={center}
      minZoom={minZoom}
      showMunicipioLabels={showMunicipioLabels}
      fitToMarkers
      onMarkerSelect={(marker) => {
        if (marker) router.push(`/propiedades/${marker.slug}`);
      }}
    />
  );
}
