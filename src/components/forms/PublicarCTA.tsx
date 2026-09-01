'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useLimitePropiedades, MENSAJE_LIMITE_PROPIEDADES } from '@/hooks/useLimitePropiedades';

/**
 * Reemplazo drop-in de `<Link href="/publicar">` para las páginas de
 * contenido (home, guías, nosotros, zonas) — sin esto, alguien ya logueado
 * y en el límite gratuito veía el mismo CTA "Publicar gratis" que cualquier
 * visitante, sin ningún indicio de que el clic solo lo iba a mandar de
 * vuelta al gate de PublishForm.tsx (reporte real 2026-09-01). Un
 * visitante SIN sesión nunca ve el chequeo (`useLimitePropiedades` no
 * dispara sin `user`) — ese caso ya lo resuelve el login/registro normal.
 *
 * Son Server Components (home, guías, nosotros, zonas) — este wrapper es
 * el único pedazo 'use client' que necesitan para este botón puntual, en
 * vez de convertir la página entera.
 */
export function PublicarCTA({
  className, style, children,
}: { className?: string; style?: CSSProperties; children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const limiteAlcanzado = useLimitePropiedades(!!user && user.rol !== 'agente');

  if (limiteAlcanzado) {
    return (
      <button
        type="button"
        onClick={() => toast.error(MENSAJE_LIMITE_PROPIEDADES)}
        className={`${className ?? ''} opacity-40 cursor-not-allowed`}
        style={style}
      >
        {children}
      </button>
    );
  }

  return (
    <Link href="/publicar" className={className} style={style}>
      {children}
    </Link>
  );
}
