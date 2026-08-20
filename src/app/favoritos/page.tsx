'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Heart, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';
import { getAllProperties } from '@/lib/api';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Property } from '@/types/property';

export default function FavoritosPage() {
  return (
    <Suspense fallback={null}>
      <FavoritosContent />
    </Suspense>
  );
}

function FavoritosContent() {
  const { user, loading } = useAuth();
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [fetching, setFetching] = useState(true);
  const searchParams = useSearchParams();
  const backHref = searchParams.get('from') === 'mapa' ? '/mapa' : '/dashboard';

  useEffect(() => {
    function cargarFavoritos() {
      if (!user) { setFetching(false); return; }
      Promise.all([
        backendFetch<{ favoritos: string[] }>('/favoritos'),
        getAllProperties(),
      ])
        .then(([{ favoritos: favIds }, allProps]) => {
          setFavorites(
            favIds.map((id) => allProps.find((p) => p.id === id)).filter(Boolean) as Property[],
          );
        })
        .finally(() => setFetching(false));
    }
    cargarFavoritos();
  }, [user]);

  if (loading || fetching) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton variant="circle" className="w-6 h-6" />
          <Skeleton className="w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <Heart size={40} className="text-gray-200 mx-auto mb-4" />
        <h1 className="text-xl font-heading font-bold text-gray-800 mb-2">Guarda tus propiedades favoritas</h1>
        <p className="text-gray-500 text-sm mb-6">Inicia sesión para guardar y ver tus propiedades guardadas.</p>
        <Link href="/auth/login" className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brand-dark transition-colors">
          Iniciar sesión
        </Link>
      </div>
    );
  }


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link href={backHref} className="text-gray-400 hover:text-brand transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <Heart size={20} className="text-red-500 fill-current" /> Mis favoritos
          </h1>
          <p className="text-sm text-gray-500">{favorites.length} propiedad{favorites.length !== 1 ? 'es' : ''} guardada{favorites.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium mb-2">Aún no tienes favoritos</p>
          <p className="flex items-center justify-center gap-1.5 text-gray-400 text-sm mb-6">
            Presiona el <Heart size={14} className="text-red-400 fill-current" /> en cualquier propiedad para guardarla aquí.
          </p>
          <Link href="/propiedades" className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-brand-dark transition-colors">
            Explorar propiedades
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>
      )}
    </div>
  );
}
