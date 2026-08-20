'use client';

import { Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';

interface FavoriteButtonProps {
  propiedadId: string;
  size?: 'sm' | 'md';
}

export function FavoriteButton({ propiedadId, size = 'md' }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { isFavorited, isPending, toggle } = useFavorites();

  // Favoritos es una función propia de la cuenta — si no hay sesión, el
  // botón no se muestra (pedido explícito), en vez de mostrarse siempre e
  // invitar a iniciar sesión al tocarlo.
  if (!user) return null;

  const isFav = isFavorited(propiedadId);
  const pending = isPending(propiedadId);
  const iconSize = size === 'sm' ? 14 : 18;
  // Circular en vez de esquinas redondeadas — mismo lenguaje que el resto
  // de los botones flotantes del nuevo estilo de tarjeta (card2.png).
  const base = size === 'sm'
    ? 'w-8 h-8 rounded-full flex items-center justify-center'
    : 'w-10 h-10 rounded-full flex items-center justify-center';

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(propiedadId); }}
      disabled={pending}
      aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      aria-pressed={isFav}
      className={`${base} transition-all active:scale-90 ${
        isFav
          ? 'bg-red-50 text-red-500 hover:bg-red-100'
          : 'bg-white/90 text-gray-400 hover:text-red-500 hover:bg-red-50'
      } shadow-sm border border-white/60`}
    >
      <Heart size={iconSize} className={isFav ? 'fill-current' : ''} />
    </button>
  );
}
