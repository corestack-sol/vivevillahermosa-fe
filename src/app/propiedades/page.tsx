import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getAllProperties } from '@/lib/api';
import { PropertiesClient } from './PropertiesClient';

export const metadata: Metadata = {
  title: 'Casas en renta y venta en Tabasco | Vive Villahermosa',
  description:
    'Encuentra casas, departamentos, terrenos y habitaciones en Villahermosa, Paraíso, Cárdenas y todo Tabasco. Filtra por precio, colonia y riesgo de inundación. Sin comisiones.',
};

export default function PropiedadesPage() {
  const allProperties = getAllProperties();
  return (
    <Suspense>
      <PropertiesClient allProperties={allProperties} />
    </Suspense>
  );
}
