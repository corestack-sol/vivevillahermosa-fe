import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';
import { mapMiaBackend } from '@/lib/misPropiedades';
import type { BackendPublicProperty } from '@/lib/api';
import { evaluarCartera, type PropiedadConAtencion } from '@/lib/coach';

/**
 * Coach de calidad de anuncio, capa 1 (heurística) — gatea por `enabled`
 * (esProfesional, único eje de "premium" real que existe hoy, ver
 * docs/BACKEND-AJUSTES-IA-21082026.md §2). Mismo patrón de fetch propio por
 * componente que ya usan OwnerActionsBar/dashboard/propiedades/page.tsx —
 * este repo no tiene una capa de caché compartida entre componentes.
 */
export function useCoach(enabled: boolean) {
  const { user } = useAuth();
  const [pendientes, setPendientes] = useState<PropiedadConAtencion[]>([]);
  const [cargando, setCargando] = useState(enabled);

  useEffect(() => {
    if (!enabled || !user) return;
    let cancelado = false;
    backendFetch<{ propiedades: BackendPublicProperty[] }>('/propiedades/mias')
      .then(({ propiedades }) => {
        if (cancelado) return;
        setPendientes(evaluarCartera(propiedades.map(mapMiaBackend)));
      })
      .catch(() => {})
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [enabled, user]);

  return { pendientes, cargando: enabled ? cargando : false };
}
