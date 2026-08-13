import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getServicioById, getTrabajosServicio } from '@/lib/api';
import { categoriaServicioLabel } from '@/lib/publishServicioSchema';
import { ServiceContactCard } from '@/components/servicios/ServiceContactCard';
import { ServiceShareCard } from '@/components/servicios/ServiceShareCard';

interface Props {
  params: Promise<{ id: string }>;
}

async function getServicio(id: string) {
  const servicio = await getServicioById(id);
  if (!servicio) return null;
  const trabajos = await getTrabajosServicio(id);
  return { ...servicio, trabajos };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const servicio = await getServicio(id);
  if (!servicio) return { title: 'Servicio no encontrado | Vive Villahermosa' };
  return {
    title: `${servicio.nombre} — ${categoriaServicioLabel(servicio.categoria)} en ${servicio.municipio} | Vive Villahermosa`,
    description: servicio.descripcion.slice(0, 160),
  };
}

export default async function ServicioDetailPage({ params }: Props) {
  const { id } = await params;
  const servicio = await getServicio(id);
  if (!servicio) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
        <Link href="/servicios" className="hover:text-brand">Servicios</Link>
        <ChevronRight size={12} />
        <span className="text-gray-600">{servicio.nombre}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand">
            {categoriaServicioLabel(servicio.categoria)}
          </span>
          <h1 className="text-2xl font-heading font-bold text-gray-900 mt-1 mb-2">{servicio.nombre}</h1>
          <p className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
            <MapPin size={14} className="flex-shrink-0" />
            {servicio.colonia ? `${servicio.colonia}, ` : ''}{servicio.municipio === 'Centro' ? 'Villahermosa' : servicio.municipio}
          </p>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{servicio.descripcion}</p>
        </div>

        <div className="space-y-4">
          <ServiceContactCard servicioId={servicio.id} nombre={servicio.nombre} />
          <ServiceShareCard servicioId={servicio.id} nombre={servicio.nombre} />
        </div>
      </div>

      {servicio.trabajos.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-4">Trabajos realizados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {servicio.trabajos.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL de Cloudinary, mismo patrón que PropertyGallery.tsx */}
                <img src={t.imagen} alt={t.descripcion ?? `Trabajo de ${servicio.nombre}`} loading="lazy" className="w-full h-56 object-cover" />
                {t.descripcion && (
                  <p className="p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{t.descripcion}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
