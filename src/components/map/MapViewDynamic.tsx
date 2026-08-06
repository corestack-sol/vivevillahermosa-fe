'use client';

import dynamic from 'next/dynamic';
import { Map } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

export const MapViewDynamic = dynamic(
  () => import('./MapView').then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-brand-pale rounded-xl">
        <div className="text-center">
          <Map size={32} className="mx-auto mb-2 text-brand/60" strokeWidth={1.5} />
          <p className="text-sm text-brand">Cargando mapa...</p>
        </div>
      </div>
    ),
  }
);
