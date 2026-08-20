'use client';

import { Carousel } from '@/components/ui/Carousel';
import { PropertyCard } from './PropertyCard';
import type { Property } from '@/types/property';

interface SimilarCarouselProps {
  properties: Property[];
}

export function SimilarCarousel({ properties }: SimilarCarouselProps) {
  return (
    <Carousel trackClassName="gap-5 pb-4">
      {properties.map((p) => (
        <div key={p.id} className="flex-shrink-0 w-[320px] md:w-[360px] snap-start">
          <PropertyCard property={p} />
        </div>
      ))}
    </Carousel>
  );
}
