'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';
import type { EstadoPublicacion } from '@/lib/misPropiedades';

/**
 * Resuelve el estado actual de esta propiedad contra GET /propiedades/mias
 * (BACKEND.md §3) si es tuya, devolviendo `null` cuando está activa o
 * cuando no es tuya — en ambos casos no hay nada que ocultar. Solo un
 * dueño puede llegar aquí con una propiedad no-activa de todos modos: el
 * backend ya devuelve 404 a cualquier otra persona que pida una propiedad
 * pausada/vendida/rentada (findOne, properties.service.ts).
 *
 * Empieza en null y se resuelve en un efecto — así el render en servidor
 * nunca difiere del primer render en cliente.
 */
export function usePropiedadEstado(propertyId: string): EstadoPublicacion | null {
  const { user } = useAuth();
  const [estado, setEstado] = useState<EstadoPublicacion | null>(null);

  useEffect(() => {
    // Sin sesión no hay nada que resolver — se queda en el `null` inicial
    // (nunca hubo una razón previa para que valiera otra cosa: sin user no
    // se dispara el fetch de abajo en ningún render anterior tampoco).
    if (!user) return;
    let cancelado = false;
    backendFetch<{ propiedades: { id: string; estado: EstadoPublicacion }[] }>('/propiedades/mias')
      .then(({ propiedades }) => {
        if (cancelado) return;
        const mine = propiedades.find((p) => p.id === propertyId);
        setEstado(!mine || mine.estado === 'activa' ? null : mine.estado);
      })
      .catch(() => { if (!cancelado) setEstado(null); });
    return () => { cancelado = true; };
  }, [user, propertyId]);

  return estado;
}
