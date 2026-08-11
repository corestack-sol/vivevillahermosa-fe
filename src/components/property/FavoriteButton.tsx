'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { backendFetch } from '@/lib/backendApi';

interface FavoriteButtonProps {
  propiedadId: string;
  size?: 'sm' | 'md';
}

export function FavoriteButton({ propiedadId, size = 'md' }: FavoriteButtonProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [isFav, setIsFav] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    backendFetch<{ favoritos: string[] }>('/favoritos')
      .then((data) => {
        if (data.favoritos) setIsFav(data.favoritos.includes(propiedadId));
      })
      .catch(() => {});
  }, [user, propiedadId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    // Optimista: refleja el cambio de inmediato, revierte solo si el
    // servidor falla — antes esperaba la respuesta y se sentía con retraso.
    const next = !isFav;
    setIsFav(next);
    setPending(true);
    try {
      const data = await backendFetch<{ favorito: boolean }>('/favoritos', {
        method: 'POST',
        body: JSON.stringify({ propiedadId }),
      });
      setIsFav(data.favorito);
    } catch {
      setIsFav(!next); // revertir
      toast.error('No se pudo actualizar tus favoritos. Intenta de nuevo.');
    } finally {
      setPending(false);
    }
  }

  // Favoritos es una función propia de la cuenta — si no hay sesión, el
  // botón no se muestra (pedido explícito), en vez de mostrarse siempre e
  // invitar a iniciar sesión al tocarlo.
  if (!user) return null;

  const iconSize = size === 'sm' ? 14 : 18;
  // Circular en vez de esquinas redondeadas — mismo lenguaje que el resto
  // de los botones flotantes del nuevo estilo de tarjeta (card2.png).
  const base = size === 'sm'
    ? 'w-8 h-8 rounded-full flex items-center justify-center'
    : 'w-10 h-10 rounded-full flex items-center justify-center';

  return (
    <button
      onClick={toggle}
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
