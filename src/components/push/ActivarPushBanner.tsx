'use client';

import { BellOff, Loader2 } from 'lucide-react';
import { usePushEstado } from '@/hooks/usePushEstado';

/**
 * Invitación a activar las notificaciones push — pedido explícito 2026-09-25:
 * en Mensajes (y, con su propia tarjeta, en Mis alertas), SOLO mientras aún no se hayan aceptado los
 * permisos (con el permiso ya dado no se pinta nada). Si el navegador no
 * soporta push, o la persona lo bloqueó (solo se quita desde la configuración
 * del navegador, no hay botón que lo arregle), tampoco. Mis alertas tiene su
 * propia tarjeta, que además explica el bloqueo (alertas/page.tsx).
 */
export function ActivarPushBanner({ className = '' }: { className?: string }) {
  const { estado, activando, activar } = usePushEstado();

  if (estado === 'inactivo') {
    return (
      <div className={`flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 ${className}`}>
        <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0">
          <BellOff size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800">Activa las notificaciones</p>
          <p className="text-xs text-gray-500">Te avisamos de las alertas de propiedades aunque no tengas la app abierta.</p>
        </div>
        <button
          type="button"
          onClick={activar}
          disabled={activando}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-60"
        >
          {activando && <Loader2 size={13} className="animate-spin" />}
          Activar
        </button>
      </div>
    );
  }

  return null;
}
