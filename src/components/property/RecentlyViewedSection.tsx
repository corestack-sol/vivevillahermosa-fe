'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import Link from 'next/link';
import { getAllProperties } from '@/lib/api';
import { getRecentlyViewedIds } from '@/lib/recentlyViewed';
import { PropertyCard } from './PropertyCard';
import type { Property } from '@/types/property';

interface RecentlyViewedSectionProps {
  /** Excluye esta propiedad de la lista — útil en la propia página de detalle. */
  excludeId?: string;
  limit?: number;
}

/**
 * "Vistos recientemente" — vive enteramente en localStorage (no requiere
 * backend). No renderiza nada durante el render inicial en servidor ni si
 * el usuario no ha visto ninguna propiedad todavía, así que es seguro
 * montarlo en cualquier página sin afectar el SSR estático.
 */
export function RecentlyViewedSection({ excludeId, limit = 4 }: RecentlyViewedSectionProps) {
  const [properties, setProperties] = useState<Property[] | null>(null);

  useEffect(() => {
    function cargarVistosRecientemente() {
      const ids = getRecentlyViewedIds().filter((id) => id !== excludeId);
      if (ids.length === 0) { setProperties([]); return; }
      const all = getAllProperties();
      const found = ids
        .map((id) => all.find((p) => p.id === id))
        .filter((p): p is Property => Boolean(p))
        .slice(0, limit);
      setProperties(found);
    }
    cargarVistosRecientemente();
  }, [excludeId, limit]);

  if (!properties || properties.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="flex items-end justify-between mb-7">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-[0.15em] mb-1.5">
            <Clock size={12} /> Continúa donde te quedaste
          </p>
          <h2 className="text-3xl font-display font-black text-gray-900 leading-tight">Vistos recientemente</h2>
        </div>
        <Link href="/propiedades" className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark group">
          Ver todas <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {properties.map((p) => <PropertyCard key={p.id} property={p} />)}
      </div>
    </section>
  );
}
