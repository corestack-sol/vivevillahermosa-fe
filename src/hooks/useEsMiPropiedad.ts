'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';

/**
 * true si la propiedad es del usuario en sesión, false si no lo es (o no
 * hay sesión), null mientras todavía no se sabe (sesión cargando, o ya hay
 * sesión pero el fetch a /propiedades/mias sigue en curso).
 *
 * Antes devolvía solo boolean con `false` como valor inicial — bug real
 * reportado 2026-09-02: en la ficha del propio dueño, ese `false` de
 * arranque hacía que el botón "Contactar" apareciera un instante antes de
 * ocultarse en cuanto confirmaba `true`. Cada consumidor trata `null`
 * igual que `true` (no mostrar el camino de contacto todavía) — más
 * seguro asumir "podría ser el dueño" mientras no se sabe, que mostrar
 * algo que va a desaparecer solo un instante después.
 */
export function useEsMiPropiedad(propertyId: string): boolean | null {
  const { user, loading: authLoading } = useAuth();
  const [esMia, setEsMia] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    backendFetch<{ propiedades: { id: string }[] }>('/propiedades/mias')
      .then(({ propiedades }) => {
        if (!cancelado) setEsMia(propiedades.some((p) => p.id === propertyId));
      })
      // Fail-open: un fetch que falla no debe dejar el camino de contacto
      // escondido para siempre — se asume "no es el dueño" (peor caso:
      // vuelve a verse el formulario normal, no un bloqueo permanente).
      .catch(() => { if (!cancelado) setEsMia(false); });
    return () => { cancelado = true; };
  }, [user, propertyId]);

  if (authLoading) return null; // todavía no se sabe si hay sesión siquiera
  if (!user) return false;      // sin sesión, nunca puede ser el dueño
  return esMia;                 // null mientras se resuelve, true/false ya confirmado
}
