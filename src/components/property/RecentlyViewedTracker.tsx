'use client';

import { useEffect } from 'react';
import { addRecentlyViewed } from '@/lib/recentlyViewed';

/** Registra la propiedad como vista en localStorage — no renderiza nada. */
export function RecentlyViewedTracker({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    addRecentlyViewed(propertyId);
  }, [propertyId]);

  return null;
}
