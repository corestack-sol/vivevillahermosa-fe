import { Suspense } from 'react';
import type { Metadata } from 'next';
import { searchProperties } from '@/lib/api';
import { PropertiesClient } from './PropertiesClient';

export const metadata: Metadata = {
  title: 'Casas en renta y venta en Tabasco | Vive Villahermosa',
  description:
    'Encuentra casas, departamentos, terrenos y habitaciones en Villahermosa, Paraíso, Cárdenas y todo Tabasco. Filtra por precio, colonia y riesgo de inundación. Sin comisiones.',
};

// ⚠️ 2026-08-23: antes traía el catálogo ACTIVO COMPLETO en cada visita
// (getAllProperties()) — deja de ser viable a cientos/miles de propiedades
// activas (ver docs/BACKEND-PROPIEDADES-PAGINACION-23082026.md). Ahora
// solo pide la primera página, sin filtros — a propósito no lee
// `searchParams` para resolver colonia/landmark aquí (necesitaría
// duplicar esos catálogos del lado del servidor); si la URL trae filtros
// reales, el efecto de useSearch (cliente) los aplica y reemplaza esto
// casi de inmediato. Esto solo evita la grilla vacía/skeleton en el primer
// pintado para la visita SIN filtros (el caso común), y le da a los
// buscadores algo real que indexar.
export default async function PropiedadesPage() {
  const { properties, total } = await searchProperties({ page: 1, limit: 12 });
  return (
    <Suspense>
      <PropertiesClient initialProperties={properties} initialTotal={total} />
    </Suspense>
  );
}
