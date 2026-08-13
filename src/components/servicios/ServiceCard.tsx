'use client';

import Link from 'next/link';
import { MapPin, Wrench, Paintbrush, Truck, Hammer, Zap, Sprout, Sparkles, Ruler, KeyRound, Bug, Wind } from 'lucide-react';
import { categoriaServicioLabel } from '@/lib/publishServicioSchema';
import type { ServicioPublico } from '@/lib/api';

export type { ServicioPublico };

const ICONO_CATEGORIA: Record<string, typeof Wrench> = {
  plomeria: Wrench,
  pintura: Paintbrush,
  mudanza: Truck,
  remodelacion: Hammer,
  albanileria: Hammer,
  electricidad: Zap,
  jardineria: Sprout,
  limpieza: Sparkles,
  carpinteria: Ruler,
  cerrajeria: KeyRound,
  fumigacion: Bug,
  aire_acondicionado: Wind,
};

export function ServiceCard({ servicio }: { servicio: ServicioPublico }) {
  const Icon = ICONO_CATEGORIA[servicio.categoria] ?? Wrench;
  return (
    <Link
      href={`/servicios/${servicio.id}`}
      className="block bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-brand-pale text-brand flex items-center justify-center flex-shrink-0">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand">
            {categoriaServicioLabel(servicio.categoria)}
          </span>
          <h3 className="font-semibold text-gray-800 text-sm truncate">{servicio.nombre}</h3>
        </div>
      </div>
      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{servicio.descripcion}</p>
      <p className="flex items-center gap-1 text-xs text-gray-400">
        <MapPin size={12} className="flex-shrink-0" />
        {servicio.colonia ? `${servicio.colonia}, ` : ''}{servicio.municipio === 'Centro' ? 'Villahermosa' : servicio.municipio}
      </p>
    </Link>
  );
}
