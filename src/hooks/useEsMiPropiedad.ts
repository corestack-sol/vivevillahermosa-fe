'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';

/**
 * true si la propiedad que se está viendo es del usuario en sesión — mismo
 * fetch real que ya usa OwnerActionsBar.tsx (GET /propiedades/mias,
 * BACKEND.md §3). Bug real reportado 2026-09-01: un propietario viendo su
 * propia ficha seguía viendo el formulario de "enviar mensaje" y el botón
 * de "contactar", como si fuera un visitante cualquiera.
 */
export function useEsMiPropiedad(propertyId: string): boolean {
  const { user } = useAuth();
  const [esMia, setEsMia] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    backendFetch<{ propiedades: { id: string }[] }>('/propiedades/mias')
      .then(({ propiedades }) => {
        if (!cancelado) setEsMia(propiedades.some((p) => p.id === propertyId));
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [user, propertyId]);

  // Sin sesión no hay ninguna propiedad "propia" que mostrar — no hace
  // falta setState aparte para este caso (evita el error de lint
  // react-hooks/set-state-in-effect por setState síncrono dentro de un
  // efecto, mismo patrón que useLimitePropiedades.ts).
  return !!user && esMia;
}
