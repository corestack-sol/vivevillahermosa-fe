import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getAllProperties } from '@/lib/api';
import { MapaClient } from './MapaClient';

export const metadata: Metadata = {
  title: 'Mapa de propiedades en Tabasco | Vive Villahermosa',
  description:
    'Explora casas, departamentos y terrenos en Villahermosa en un mapa interactivo con indicador de zonas inundables. Filtra por precio, tipo y riesgo hídrico.',
};

export default function MapaPage() {
  const allProperties = getAllProperties();
  return (
    <Suspense>
      <MapaClient allProperties={allProperties} />
    </Suspense>
  );
}
