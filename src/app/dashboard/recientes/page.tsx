'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getAllProperties } from '@/lib/api';
import { getRecentlyViewedIds } from '@/lib/recentlyViewed';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Property } from '@/types/property';

/**
 * Bug real reportado 2026-09-02: la card "Propiedades vistas" del panel
 * mandaba a /propiedades — el catálogo público completo, no las
 * propiedades que esa persona en realidad vio. No había ningún backend
 * de analítica que lo respaldara (BACKEND.md §12), así que el link
 * apuntaba a lo único que existía: la lista genérica.
 *
 * Lo que SÍ existe y es real: "vistos recientemente" en localStorage
 * (recentlyViewed.ts, ya usado en el Home). No necesita backend nuevo —
 * esta pantalla es esa misma lista completa (hasta 8), no el resumen de
 * 4 que muestra el carrusel del Home.
 */
export default function RecientesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[] | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!user) return;
    function cargarVistosRecientemente() {
      const ids = getRecentlyViewedIds();
      if (ids.length === 0) { setProperties([]); return; }
      getAllProperties().then((all) => {
        const found = ids
          .map((id) => all.find((p) => p.id === id))
          .filter((p): p is Property => Boolean(p));
        setProperties(found);
      });
    }
    cargarVistosRecientemente();
  }, [authLoading, user, router]);

  if (authLoading || !user || properties === null) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="w-48 mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-gray-400 hover:text-brand transition-colors flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Propiedades vistas</h1>
          <p className="text-sm text-gray-500">Las últimas que abriste en este navegador</p>
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="text-center py-16">
          <Clock size={32} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Todavía no has visto ninguna propiedad</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {properties.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>
      )}
    </div>
  );
}
