'use client';

import { useEsMiPropiedad } from '@/hooks/useEsMiPropiedad';

/**
 * "Renta"/"Venta" antes del precio en la barra fija de móvil — pedido
 * explícito 2026-09-03, solo cuando la propiedad es del usuario en sesión
 * (ahí MobileContactCta se esconde y sobra espacio; para cualquier otro
 * visitante el precio ya se entiende por el CTA de contacto al lado).
 */
export function PrecioOperacionLabel({ propertyId, operacion }: { propertyId: string; operacion: 'venta' | 'renta' }) {
  const esMia = useEsMiPropiedad(propertyId);
  if (!esMia) return null;
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide text-brand">
      {operacion === 'renta' ? 'Renta' : 'Venta'}
    </span>
  );
}
