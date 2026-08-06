'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PropertyCard } from './PropertyCard';
import type { Property } from '@/types/property';

interface SimilarCarouselProps {
  properties: Property[];
}

export function SimilarCarousel({ properties }: SimilarCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft]   = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows]);

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('div')?.offsetWidth ?? 340;
    el.scrollBy({ left: dir === 'left' ? -(cardWidth + 20) : cardWidth + 20, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      {/* Fade edges */}
      {canLeft  && <div className="pointer-events-none absolute left-0 top-0 bottom-4 w-16 bg-gradient-to-r from-page to-transparent z-10" />}
      {canRight && <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-page to-transparent z-10" />}

      {/* Nav buttons */}
      <button
        onClick={() => scroll('left')}
        disabled={!canLeft}
        aria-label="Anterior"
        className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center transition-all ${
          canLeft ? 'opacity-100 hover:shadow-lg hover:border-brand/30 text-gray-700' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => scroll('right')}
        disabled={!canRight}
        aria-label="Siguiente"
        className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center transition-all ${
          canRight ? 'opacity-100 hover:shadow-lg hover:border-brand/30 text-gray-700' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronRight size={18} />
      </button>

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {properties.map((p) => (
          <div key={p.id} className="flex-shrink-0 w-[320px] md:w-[360px] snap-start">
            <PropertyCard property={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
