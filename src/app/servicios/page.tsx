import type { Metadata } from 'next';
import { getAllServicios } from '@/lib/api';
import { ServiciosClient } from '@/components/servicios/ServiciosClient';

export const metadata: Metadata = {
  title: 'Servicios para tu hogar en Tabasco | Vive Villahermosa',
  description: 'Plomería, pintura, mudanza, remodelación, albañilería y más servicios para el hogar en Villahermosa y Tabasco.',
};

// Sin caché de build: es una tabla real que crece con cada publicación,
// a diferencia del catálogo estático de propiedades.
export const dynamic = 'force-dynamic';

export default async function ServiciosPage() {
  const servicios = await getAllServicios();
  return <ServiciosClient servicios={servicios} />;
}
