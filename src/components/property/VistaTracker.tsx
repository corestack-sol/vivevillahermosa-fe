'use client';

import { useEffect, useRef } from 'react';
import { useEsMiPropiedad } from '@/hooks/useEsMiPropiedad';
import { backendFetch } from '@/lib/backendApi';

/**
 * Registra una vista real contra el backend — pedido explícito
 * 2026-09-02, ver docs/BACKEND-VISTAS-CONTACTOS-02092026.md (el endpoint
 * todavía no existe del lado del servidor, esto queda listo para cuando
 * exista). Fire-and-forget: un 404/error no debe afectar la navegación de
 * quien visita, así que se traga en silencio — el día que el backend lo
 * implemente, empieza a funcionar solo, sin tocar este archivo.
 *
 * Espera a que `useEsMiPropiedad` confirme `false` (nunca dispara en
 * `null`/`true`) — el propio dueño viendo su ficha no debe contarse como
 * una vista real, mismo criterio que ya evita mostrarle el formulario de
 * contacto a sí mismo (ver ContactCard.tsx).
 */
export function VistaTracker({ propertyId }: { propertyId: string }) {
  const esMiPropiedad = useEsMiPropiedad(propertyId);
  const enviadaRef = useRef(false);

  useEffect(() => {
    if (esMiPropiedad !== false || enviadaRef.current) return;
    enviadaRef.current = true;
    backendFetch(`/propiedades/${propertyId}/vista`, { method: 'POST' }).catch(() => {});
  }, [esMiPropiedad, propertyId]);

  return null;
}
