'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import type { PropertyType } from '@/types/property';
import { getPropertyTypeConfig } from '@/lib/propertyTypeConfig';
import { Carousel } from '@/components/ui/Carousel';

interface PropertyGalleryProps {
  fotos: string[];
  titulo: string;
  tipo?: PropertyType;
}

function Placeholder({ tipo, className = '' }: { tipo?: PropertyType; className?: string }) {
  const cfg = getPropertyTypeConfig(tipo ?? 'casa');
  return (
    <div
      className={`w-full h-full flex items-center justify-center select-none ${className}`}
      style={{ background: `linear-gradient(150deg, ${cfg.from} 0%, ${cfg.to} 100%)` }}
    >
      <cfg.Icon size={56} strokeWidth={1.25} style={{ color: cfg.accent }} />
    </div>
  );
}

function Photo({ src, tipo, alt, className = '' }: { src?: string; tipo?: PropertyType; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return <Placeholder tipo={tipo} className={className} />;
}

// Umbral en px para que un touchmove cuente como swipe (vs. un tap normal
// o un scroll vertical accidental) — 40px es lo que suelen usar Instagram/
// Airbnb, ni tan sensible que un tap tiemble y cuente como swipe, ni tan
// alto que haga falta un gesto exagerado.
const SWIPE_THRESHOLD = 40;

function useSwipe(onPrev: () => void, onNext: () => void) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - startX.current;
    const deltaY = e.changedTouches[0].clientY - startY.current;
    startX.current = null;
    startY.current = null;
    // Si el gesto fue más vertical que horizontal, es scroll de la página,
    // no un swipe de galería — no interceptarlo.
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (deltaX > 0) onPrev(); else onNext();
  };

  return { onTouchStart, onTouchEnd };
}

export function PropertyGallery({ fotos, titulo, tipo }: PropertyGalleryProps) {
  const total = Math.max(fotos.length, 1);
  const [active, setActive]   = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const prev = useCallback(() => setActive((c) => (c - 1 + total) % total), [total]);
  const next = useCallback(() => setActive((c) => (c + 1) % total), [total]);
  const swipe = useSwipe(prev, next);

  /* Keyboard navigation */
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape')     setLightbox(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, prev, next]);

  /* Lock scroll when lightbox open */
  useEffect(() => {
    document.body.style.overflow = lightbox ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  const openAt = (idx: number) => { setActive(idx); setLightbox(true); };

  return (
    <>
      {/* ── Gallery grid ── */}
      <div className="flex flex-col">
        {/* Main image */}
        <div
          className="relative aspect-video md:aspect-[16/9] cursor-zoom-in group bg-brand-pale overflow-hidden"
          onClick={() => openAt(active)}
          onTouchStart={swipe.onTouchStart}
          onTouchEnd={swipe.onTouchEnd}
        >
          <Photo src={fotos[active]} tipo={tipo} alt={titulo} className="transition-transform duration-300 group-hover:scale-[1.02]" />

          {/* Hover dim */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

          {/* Counter badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1.5 rounded-full">
            <Images size={12} />
            {active + 1} / {total}
          </div>

          {/* Navigation arrows on main image — visibles siempre en móvil
              (group-hover nunca se activa en touch, así que antes eran
              inalcanzables ahí), solo hover-reveal en desktop. */}
          {total > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-md p-2 rounded-full transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label="Anterior"
              >
                <ChevronLeft size={18} className="text-gray-700" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-md p-2 rounded-full transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label="Siguiente"
              >
                <ChevronRight size={18} className="text-gray-700" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {total > 1 && (
          <div className="bg-gray-50 border-t border-gray-100">
            <Carousel fadeFrom="from-gray-50" fadeWidth="w-8" showArrows={false} trackClassName="gap-1.5 p-2">
              {Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`relative flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all ${
                    i === active
                      ? 'ring-2 ring-brand ring-offset-1 opacity-100'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  aria-label={`Foto ${i + 1}`}
                >
                  <Photo src={fotos[i]} tipo={tipo} alt={`${titulo} — foto ${i + 1}`} />
                </button>
              ))}
            </Carousel>
          </div>
        )}
      </div>

      {/* ── Lightbox carousel ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={() => setLightbox(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/60 text-sm font-medium truncate max-w-xs">{titulo}</p>
            <button
              onClick={() => setLightbox(false)}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} className="text-white" />
            </button>
          </div>

          {/* Main image + arrows — antes gateado por md: (ancho), no por
              tipo de entrada: una laptop con la ventana angostada (mouse,
              sin touch) perdía las flechas Y el hint de swipe a la vez,
              sin ninguna forma de navegar más que la tira de miniaturas.
              pointer-fine: (mouse/trackpad) muestra las flechas sin
              importar el ancho; pointer-coarse: (dedo) muestra el hint de
              swipe en su lugar — el criterio real es el método de
              entrada, no cuánto espacio hay. */}
          <div
            className="flex-1 flex items-center justify-center relative px-4 pointer-fine:px-16 min-h-0"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={swipe.onTouchStart}
            onTouchEnd={swipe.onTouchEnd}
          >
            {total > 1 && (
              <button
                onClick={prev}
                className="hidden pointer-fine:flex absolute left-4 bg-white/10 hover:bg-white/25 text-white p-3 rounded-full transition-all shadow-lg"
                aria-label="Anterior"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <div className="w-full max-w-4xl max-h-full aspect-video rounded-xl overflow-hidden shadow-2xl">
              <Photo src={fotos[active]} tipo={tipo} alt={`${titulo} — foto ${active + 1}`} />
            </div>

            {total > 1 && (
              <button
                onClick={next}
                className="hidden pointer-fine:flex absolute right-4 bg-white/10 hover:bg-white/25 text-white p-3 rounded-full transition-all shadow-lg"
                aria-label="Siguiente"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Footer: counter + thumbnails */}
          <div className="flex-shrink-0 pb-6 pt-4 px-5 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/50 text-sm">
              {active + 1} de {total}
              <span className="hidden pointer-coarse:inline"> · desliza para ver más</span>
            </p>

            {total > 1 && (
              <Carousel fadeFrom="from-black" fadeWidth="w-10" showArrows={false} dark className="max-w-full" trackClassName="gap-2 px-1">
                {Array.from({ length: total }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`w-14 h-10 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
                      i === active
                        ? 'ring-2 ring-white opacity-100 scale-105'
                        : 'opacity-40 hover:opacity-70'
                    }`}
                    aria-label={`Foto ${i + 1}`}
                  >
                    <Photo src={fotos[i]} tipo={tipo} alt={`Miniatura ${i + 1}`} />
                  </button>
                ))}
              </Carousel>
            )}
          </div>
        </div>
      )}
    </>
  );
}
