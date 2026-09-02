'use client';

import { MessageCircle } from 'lucide-react';
import { usePropiedadEstado } from '@/hooks/usePropiedadEstado';
import { useEsMiPropiedad } from '@/hooks/useEsMiPropiedad';
import { estadoNoDisponibleInfo } from '@/lib/misPropiedades';

/** Botón "Contactar" de la barra fija móvil — se apaga si la propiedad no está activa (pausada/vencida/vendida/rentada), y desaparece del todo si es tuya (la barra de gestión ya cubre esa función, ver OwnerActionsBar.tsx). */
export function MobileContactCta({ propertyId }: { propertyId: string }) {
  const estadoNoDisponible = usePropiedadEstado(propertyId);
  const esMiPropiedad = useEsMiPropiedad(propertyId);

  // `!== false` — mientras todavía no se sabe (`null`) también se
  // esconde, no solo cuando ya se confirmó dueño (`true`). Bug real
  // reportado 2026-09-02: con el valor inicial de antes, "Contactar"
  // aparecía un instante en la propia ficha antes de ocultarse.
  if (esMiPropiedad !== false) return null;

  if (estadoNoDisponible) {
    const info = estadoNoDisponibleInfo(estadoNoDisponible);
    return (
      <span className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-400 font-bold text-sm py-3 rounded-xl">
        <info.Icon size={16} />
        {info.label}
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
