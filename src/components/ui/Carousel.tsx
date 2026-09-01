'use client';

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselProps {
  children: ReactNode;
  /** Clases del track scrollable (gap, padding) — cada hijo debe traer su propio `flex-shrink-0`. */
  trackClassName?: string;
  /** Color desde el que funde el borde — debe coincidir con el fondo real detrás del carrusel. */
  fadeFrom?: string;
  fadeWidth?: string;
  showArrows?: boolean;
  /** Botones de flecha en versión oscura (para carruseles sobre fondo negro, ej. el lightbox de fotos). */
  dark?: boolean;
  /**
   * Si se da, desde `lg:` el track deja de ser un carrusel deslizable y se
   * vuelve un grid estático (flechas y degradados se ocultan ahí) — mismo
   * criterio que ya usaban "Propiedades destacadas"/"Vistos recientemente"
   * antes de esto: en escritorio hay espacio de sobra para verlas todas
   * sin scroll horizontal.
   */
  desktopGridClassName?: string;
  className?: string;
}

/**
 * Carrusel de scroll horizontal reutilizable — antes esta lógica (flechas
 * que reaccionan a la posición real de scroll + degradado en los bordes
 * solo del lado donde de verdad hay más contenido) solo existía duplicada
 * dentro de SimilarCarousel.tsx. Estandariza el mismo comportamiento en
 * cualquier fila de tarjetas/miniaturas que pueda desbordar.
 */
export function Carousel({
  children,
  trackClassName = 'gap-5',
  fadeFrom = 'from-page',
  fadeWidth = 'w-16',
  showArrows = true,
  dark = false,
  desktopGridClassName,
  className = '',
}: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft]   = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // El track siempre trae `snap-start` en sus hijos (ver return() más
    // abajo) — con eso, un `trackClassName` que además le da padding
    // horizontal al propio contenedor scrolleable (ej. "px-3", el patrón
    // que ya usan RecentlyViewedSection/SimilarCarousel para el efecto de
    // "sangrado") hace que el navegador NUNCA deje descansar `scrollLeft`
    // en 0 — el punto de snap real del primer elemento cae en scrollLeft
    // = ese padding (confirmado en vivo: con `px-3`, scrollLeft mínimo
    // alcanzable es 12, no 0; forzarlo a 0 con JS se revierte solo a 12).
    // Sin restar el padding aquí, `scrollLeft > 8` quedaba en `true` en
    // reposo con cualquier padding >8px, mostrando el degradado/flecha
    // izquierdos como si hubiera más contenido a la izquierda cuando ya
    // se estaba en el límite real (reporte real 2026-09-01). El lado
    // derecho no tiene este problema porque no hay `snap-end` — ahí el
    // navegador sí llega a su tope natural (scrollWidth - clientWidth).
    const style = getComputedStyle(el);
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padRight = parseFloat(style.paddingRight) || 0;
    setCanLeft(el.scrollLeft > padLeft + 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - padRight - 8);
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
    const itemWidth = el.querySelector(':scope > *')?.getBoundingClientRect().width ?? 300;
    el.scrollBy({ left: dir === 'left' ? -(itemWidth + 20) : itemWidth + 20, behavior: 'smooth' });
  }

  const desktopHidden = desktopGridClassName ? 'lg:hidden' : '';
  const arrowBase = dark
    ? 'bg-white/10 hover:bg-white/20 text-white'
    : 'bg-white shadow-md border border-gray-200 hover:shadow-lg hover:border-brand/30 text-gray-700';

  return (
    <div className={`relative ${className}`}>
      {/* Fade edges */}
      {canLeft  && <div className={`pointer-events-none absolute left-0 top-0 bottom-0 ${fadeWidth} bg-gradient-to-r ${fadeFrom} to-transparent z-10 ${desktopHidden}`} />}
      {canRight && <div className={`pointer-events-none absolute right-0 top-0 bottom-0 ${fadeWidth} bg-gradient-to-l ${fadeFrom} to-transparent z-10 ${desktopHidden}`} />}

      {/* Nav buttons — solo mouse/trackpad (pointer-fine:), el track ya es
          deslizable por dedo en touch. */}
      {showArrows && (
        <>
          <button
            onClick={() => scroll('left')}
            disabled={!canLeft}
            aria-label="Anterior"
            className={`hidden pointer-fine:flex ${desktopHidden} absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full items-center justify-center transition-all ${arrowBase} ${
              canLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canRight}
            aria-label="Siguiente"
            className={`hidden pointer-fine:flex ${desktopHidden} absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full items-center justify-center transition-all ${arrowBase} ${
              canRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        className={`flex overflow-x-auto scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${trackClassName} ${desktopGridClassName ?? ''}`}
      >
        {children}
      </div>
    </div>
  );
}
