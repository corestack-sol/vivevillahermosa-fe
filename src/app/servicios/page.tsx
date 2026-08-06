import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { ServiciosClient } from '@/components/servicios/ServiciosClient';

export const metadata: Metadata = {
  title: 'Servicios para tu hogar en Tabasco | Vive Villahermosa',
  description: 'Plomería, pintura, mudanza, remodelación, albañilería y más servicios para el hogar en Villahermosa y Tabasco.',
};

// Sin caché de build: es una tabla real que crece con cada publicación,
// a diferencia del catálogo estático de propiedades.
export const dynamic = 'force-dynamic';

export default async function ServiciosPage() {
  const servicios = await prisma.servicioProveedor.findMany({
    where: { activo: true },
    select: {
      id: true, categoria: true, nombre: true, descripcion: true,
      municipio: true, colonia: true, fotoDataUrl: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return <ServiciosClient servicios={servicios} />;
}
