'use client';

import { Carousel } from '@/components/ui/Carousel';
import { PropertyCard } from './PropertyCard';
import type { Property } from '@/types/property';

interface SimilarCarouselProps {
  properties: Property[];
}

export function SimilarCarousel({ properties }: SimilarCarouselProps) {
  // px-3/pt-6 — sin esto, overflow-x-auto en Carousel.tsx obliga a
  // overflow-y a comportarse como "auto" también (quirk real de CSS: si un
  // eje no es "visible", el otro deja de serlo), así que el
  // hover:-translate-y-1.5 + hover:shadow-2xl de PropertyCard quedaba
  // recortado arriba en cada card, y a los lados en la primera/última
  // (reporte explícito 2026-08-20: "las cards se recortan horizontalmente
  // ... las sombras aparecen recortadas al hacer hover").
  return (
    <Carousel className="-mx-3" trackClassName="gap-5 px-3 pt-6 pb-6">
      {properties.map((p) => (
        <div key={p.id} className="flex-shrink-0 w-[320px] md:w-[360px] snap-start">
          <PropertyCard property={p} />
        </div>
      ))}
    </Carousel>
  );
}
