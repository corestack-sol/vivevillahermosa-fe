'use client';

import { MessageCircle, PauseCircle, Archive } from 'lucide-react';
import { usePropiedadEstado } from '@/hooks/usePropiedadEstado';

/** Botón "Contactar" de la barra fija móvil — se apaga si la propiedad está pausada o archivada (vendida/rentada). */
export function MobileContactCta({ propertyId }: { propertyId: string }) {
  const estadoNoDisponible = usePropiedadEstado(propertyId);

  if (estadoNoDisponible) {
    const archivada = estadoNoDisponible === 'vendida' || estadoNoDisponible === 'rentada';
    return (
      <span className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-400 font-bold text-sm py-3 rounded-xl">
        {archivada ? <Archive size={16} /> : <PauseCircle size={16} />}
        {estadoNoDisponible === 'vendida' ? 'Vendida' : estadoNoDisponible === 'rentada' ? 'Rentada' : 'Pausada'}
      </span>
    );
  }

  return (
    <a href="#contacto"
      className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold text-sm py-3 rounded-xl transition-colors">
      <MessageCircle size={16} /> Contactar
    </a>
  );
}
