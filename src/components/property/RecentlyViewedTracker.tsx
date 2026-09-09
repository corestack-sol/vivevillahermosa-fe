'use client';

import { useEffect } from 'react';
import { addRecentlyViewed } from '@/lib/recentlyViewed';
import { useAuth } from '@/context/AuthContext';

/**
 * Registra la propiedad como vista en localStorage — no renderiza nada.
 * Separado por cuenta (`user?.userId ?? null` — ver recentlyViewed.ts) para
 * que el historial no se mezcle entre cuentas en el mismo navegador ni
 * sobreviva a eliminar una cuenta y registrar una nueva.
 */
export function RecentlyViewedTracker({ propertyId }: { propertyId: string }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Espera a que AuthContext resuelva quién es antes de registrar — sin
    // esto, la primera vista de una sesión ya logueada se anotaba en el
    // balde anónimo (user todavía null mientras loading) en vez del de la
    // cuenta real.
    if (loading) return;
    addRecentlyViewed(propertyId, user?.userId ?? null);
  }, [propertyId, user?.userId, loading]);

  return null;
}
