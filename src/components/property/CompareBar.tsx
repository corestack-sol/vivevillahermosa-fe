'use client';

import Link from 'next/link';
import { Scale, X } from 'lucide-react';
import { useCompare } from '@/context/CompareContext';

/** Barra flotente global — visible en cualquier página mientras haya propiedades seleccionadas para comparar. */
export function CompareBar() {
  const { ids, clear } = useCompare();

  if (ids.length === 0) return null;

  return (
    // Antes bottom-20 fijo en móvil/tablet, pensado solo para dejar
    // espacio a la barra de acción fija de la ficha de propiedad
    // (Contactar) — en CUALQUIER OTRA página (sin esa barra) quedaba
    // innecesariamente lejos del borde inferior (reporte real
    // 2026-09-02). Ahora usa una variable CSS que solo la ficha de
    // propiedad enciende mientras está montada (ReservaEspacioCompareBar,
    // ver PropertyDetailView.tsx) — en el resto de páginas queda en 0 y
    // esta barra se acerca al borde como cualquier toast normal. `lg:`
    // sigue como clase real (no inline style) para que la cascada de
    // Tailwind pueda seguir pisándola en escritorio, donde nunca hay nada
    // que evitar abajo.
    // + env(safe-area-inset-bottom) — auditoría PWA 2026-09-02: instalada
    // en iOS, esta barra quedaba pegada al indicador de inicio (home
    // indicator) en cualquier página sin la barra de "Contactar" debajo
    // (esa sí ya tenía su propio margen real de sistema, esta no). 0 en
    // cualquier navegador normal, no cambia nada ahí.
    <div className="fixed inset-x-0 bottom-[calc(var(--compare-bar-bottom-offset,0px)+1rem+env(safe-area-inset-bottom))] lg:bottom-4 z-40 flex justify-center px-5 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 bg-brand-dark text-white rounded-2xl shadow-2xl pl-3 sm:pl-4 pr-2 py-2 animate-toast-in max-w-full">
        <Scale size={16} className="text-accent flex-shrink-0" />
        {/* "para comparar" se recorta en pantallas angostas (<640px) — con
            3 propiedades ("3 propiedades para comparar") el texto completo
            no cabía en un viewport de 390px y desbordaba la barra por
            ambos lados, perdiendo las esquinas redondeadas (reporte real
            2026-09-02). */}
        <span className="text-sm font-medium whitespace-nowrap">
          {ids.length} propiedad{ids.length !== 1 ? 'es' : ''}
          <span className="hidden sm:inline"> para comparar</span>
        </span>
        <Link
          href="/comparar"
          className="bg-white hover:bg-white/90 text-brand-dark text-sm font-bold px-3 sm:px-4 py-2 rounded-xl transition-colors whitespace-nowrap flex-shrink-0"
        >
          Comparar
        </Link>
        <button
          type="button"
          onClick={clear}
          aria-label="Quitar todas las propiedades de comparar"
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
