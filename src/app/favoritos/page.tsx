'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Heart, ArrowLeft, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { loginRedirectUrl } from '@/lib/authRedirect';
import { backendFetch } from '@/lib/backendApi';
import { getAllProperties } from '@/lib/api';
import { PropertyCard } from '@/components/property/PropertyCard';
import { FavoriteButton } from '@/components/property/FavoriteButton';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Property } from '@/types/property';

// Card atenuada para un favorito que ya no resuelve contra el catálogo
// público (activo). No se puede saber CUÁL de los 4 casos es (pausada,
// eliminada, vendida o rentada) — GET /propiedades/:id devuelve 404 a
// cualquiera que no sea el dueño en los 4, sin distinguir (confirmado en
// src/app/propiedades/[id]/page.tsx, fetchProperty()). Mensaje genérico
// a propósito, no se inventa cuál es — ver
// docs/BACKEND-ESTADO-FAVORITOS-23082026.md para el endpoint que
// resolvería esto de verdad.
function FavoritoNoDisponible({ id }: { id: string }) {
  return (
    <div className="relative rounded-3xl overflow-hidden border border-gray-200 bg-gray-50 aspect-[20/21] flex flex-col items-center justify-center text-center p-5 opacity-70">
      <div className="absolute top-4 right-4">
        <FavoriteButton propiedadId={id} size="sm" />
      </div>
      <EyeOff size={26} className="text-gray-300 mb-3" strokeWidth={1.5} />
      <p className="text-sm font-semibold text-gray-500 mb-1">No disponible actualmente</p>
      <p className="text-xs text-gray-400 max-w-[190px] leading-relaxed">
        El propietario la pausó, la quitó, o la operación ya se cerró.
      </p>
    </div>
  );
}

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
  // IDs de favoritos que ya no resuelven contra el catálogo activo — antes
  // (huerfanos: number) solo se contaban y desaparecían del todo; pedido
  // explícito 2026-08-30: mostrarlos igual, atenuados, en vez de ocultarlos
  // en silencio — ver FavoritoNoDisponible arriba.
  const [huerfanos, setHuerfanos] = useState<string[]>([]);
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
          const resueltos = favIds.map((id) => allProps.find((p) => p.id === id)).filter(Boolean) as Property[];
          const resueltosIds = new Set(resueltos.map((p) => p.id));
          setHuerfanos(favIds.filter((id) => !resueltosIds.has(id)));
          setFavorites(resueltos);
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
        <Link href={loginRedirectUrl('/favoritos')} className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brand-dark transition-colors">
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
          <p className="text-sm text-gray-500">
            {favorites.length + huerfanos.length} propiedad{favorites.length + huerfanos.length !== 1 ? 'es' : ''} guardada{favorites.length + huerfanos.length !== 1 ? 's' : ''}
            {huerfanos.length > 0 && ` (${huerfanos.length} no disponible${huerfanos.length !== 1 ? 's' : ''} ahora)`}
          </p>
        </div>
      </div>

      {favorites.length === 0 && huerfanos.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium mb-2">Aún no tienes favoritos</p>
          <p className="text-gray-400 text-sm mb-6">
            Presiona el <Heart size={14} className="inline-block align-text-bottom text-red-400 fill-current" /> en cualquier propiedad para guardarla aquí.
          </p>
          <Link href="/propiedades" className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-brand-dark transition-colors">
            Explorar propiedades
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((p) => <PropertyCard key={p.id} property={p} />)}
          {huerfanos.map((id) => <FavoritoNoDisponible key={id} id={id} />)}
        </div>
      )}
    </div>
  );
}
