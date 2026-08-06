'use client';

import Link from 'next/link';
import { Scale, X } from 'lucide-react';
import { useCompare } from '@/context/CompareContext';

/** Barra flotente global — visible en cualquier página mientras haya propiedades seleccionadas para comparar. */
export function CompareBar() {
  const { ids, clear } = useCompare();

  if (ids.length === 0) return null;

  return (
    // bottom-20 en móvil/tablet: deja espacio libre para la barra de
    // acción fija de la ficha de propiedad (Contactar), que también vive
    // pegada abajo — en lg+ esa barra no existe, así que baja a bottom-4.
    <div className="fixed inset-x-0 bottom-20 lg:bottom-4 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 bg-brand-dark text-white rounded-2xl shadow-2xl pl-4 pr-2 py-2 animate-toast-in">
        <Scale size={16} className="text-accent flex-shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap">
          {ids.length} propiedad{ids.length !== 1 ? 'es' : ''} para comparar
        </span>
        <Link
          href="/comparar"
          className="bg-white hover:bg-white/90 text-brand-dark text-sm font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
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
