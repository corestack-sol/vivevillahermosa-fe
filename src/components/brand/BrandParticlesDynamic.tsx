'use client';

import dynamic from 'next/dynamic';

export const BrandParticlesDynamic = dynamic(
  () => import('./BrandParticles').then((m) => m.BrandParticles),
  { ssr: false },
);
