'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import type { PropertyType } from '@/types/property';
import { getPropertyTypeConfig } from '@/lib/propertyTypeConfig';

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

export function PropertyGallery({ fotos, titulo, tipo }: PropertyGalleryProps) {
  const total = Math.max(fotos.length, 1);
  const [active, setActive]   = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const prev = useCallback(() => setActive((c) => (c - 1 + total) % total), [total]);
  const next = useCallback(() => setActive((c) => (c + 1) % total), [total]);

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
        >
          <Photo src={fotos[active]} tipo={tipo} alt={titulo} className="transition-transform duration-300 group-hover:scale-[1.02]" />

          {/* Hover dim */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

          {/* Counter badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1.5 rounded-full">
            <Images size={12} />
            {active + 1} / {total}
          </div>

          {/* Navigation arrows on main image */}
          {total > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-md p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                aria-label="Anterior"
              >
                <ChevronLeft size={18} className="text-gray-700" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-md p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                aria-label="Siguiente"
              >
                <ChevronRight size={18} className="text-gray-700" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {total > 1 && (
          <div className="flex gap-1.5 p-2 bg-gray-50 border-t border-gray-100">
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
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} className="text-white" />
            </button>
          </div>

          {/* Main image + arrows */}
          <div
            className="flex-1 flex items-center justify-center relative px-16 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {total > 1 && (
              <button
                onClick={prev}
                className="absolute left-4 bg-white/10 hover:bg-white/25 text-white p-3 rounded-full transition-all shadow-lg"
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
                className="absolute right-4 bg-white/10 hover:bg-white/25 text-white p-3 rounded-full transition-all shadow-lg"
                aria-label="Siguiente"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Footer: counter + thumbnails */}
          <div className="flex-shrink-0 pb-6 pt-4 px-5 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/50 text-sm">{active + 1} de {total}</p>

            {total > 1 && (
              <div className="flex gap-2">
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
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
