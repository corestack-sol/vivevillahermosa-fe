'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { backendFetch } from '@/lib/backendApi';

interface FavoritesContextValue {
  isFavorited: (id: string) => boolean;
  isPending: (id: string) => boolean;
  toggle: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/**
 * Antes cada <FavoriteButton/> traía su propio useState + su propio GET
 * /favoritos al montar — en la ficha de una propiedad hay dos instancias
 * a la vez (junto a "Compartir" y en la barra sticky de precio/contactar
 * en móvil/tablet), cada una con su propia idea de si la propiedad está
 * en favoritos, sin ninguna relación entre sí. Tocar una no actualizaba
 * la otra. Este contexto centraliza el estado (un solo fetch por sesión,
 * no uno por botón) para que cualquier instancia en la página, la que sea,
 * lea y escriba la misma fuente de verdad.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    function cargarFavoritos() {
      if (!user) { setIds(new Set()); return; }
      backendFetch<{ favoritos: string[] }>('/favoritos')
        .then((data) => setIds(new Set(data.favoritos ?? [])))
        .catch(() => {});
    }
    cargarFavoritos();
  }, [user]);

  const toggle = useCallback(async (id: string) => {
    if (!user || pending.has(id)) return;
    // Se calcula desde el `ids` de este render, no dentro de un updater
    // funcional — un setState(fn) no garantiza que `fn` ya haya corrido
    // para cuando sigue la siguiente línea, así que asumir eso para
    // decidir "next" podía leer un valor todavía sin actualizar.
    const next = !ids.has(id);
    setPending((prev) => new Set(prev).add(id));
    setIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id); else copy.delete(id);
      return copy;
    });

    try {
      const data = await backendFetch<{ favorito: boolean }>('/favoritos', {
        method: 'POST',
        body: JSON.stringify({ propiedadId: id }),
      });
      setIds((prev) => {
        const copy = new Set(prev);
        if (data.favorito) copy.add(id); else copy.delete(id);
        return copy;
      });
    } catch {
      setIds((prev) => {
        const copy = new Set(prev);
        if (next) copy.delete(id); else copy.add(id); // revertir
        return copy;
      });
      toast.error('No se pudo actualizar tus favoritos. Intenta de nuevo.');
    } finally {
      setPending((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    }
  }, [user, ids, pending, toast]);

  const value: FavoritesContextValue = {
    isFavorited: (id) => ids.has(id),
    isPending: (id) => pending.has(id),
    toggle,
  };

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites debe usarse dentro de <FavoritesProvider>');
  return ctx;
}
