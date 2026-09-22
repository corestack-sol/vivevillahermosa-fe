import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getAllProperties } from '@/lib/api';
import { MapaClient } from './MapaClient';

export const metadata: Metadata = {
  title: 'Mapa de propiedades en Tabasco | Vive Villahermosa',
  description:
    'Explora casas, departamentos y terrenos en Villahermosa en un mapa interactivo con el historial de inundación de cada propiedad. Filtra por precio, tipo y nivel de inundación.',
};

export default async function MapaPage() {
  const allProperties = await getAllProperties();
  return (
    <Suspense>
      <MapaClient allProperties={allProperties} />
    </Suspense>
  );
}
