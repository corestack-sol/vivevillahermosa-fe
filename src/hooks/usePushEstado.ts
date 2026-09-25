'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { obtenerEstadoPush, suscribirPush, type EstadoPush } from '@/lib/push';

/**
 * Estado real de las notificaciones push y la acción de activarlas, para
 * mostrar el botón "Activar" en las secciones que lo ofrecen (Mensajes, Mis
 * alertas). `estado` es `null` mientras no se sabe (no se pinta nada: evita
 * mostrar el botón un instante y quitarlo).
 */
export function usePushEstado() {
  const { user } = useAuth();
  const toast = useToast();
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [activando, setActivando] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    obtenerEstadoPush()
      .then((e) => { if (!cancelado) setEstado(e); })
      .catch(() => { if (!cancelado) setEstado('no-soportado'); });
    return () => { cancelado = true; };
  }, [user]);

  async function activar() {
    setActivando(true);
    try {
      await suscribirPush();
      setEstado('activo');
      toast.success('Notificaciones activadas.');
    } catch (err) {
      // Rechazó el aviso nativo (o el backend no guardó la suscripción): se relee el estado real.
      setEstado(await obtenerEstadoPush().catch(() => 'inactivo' as const));
      toast.error(err instanceof Error ? err.message : 'No se pudieron activar las notificaciones.');
    } finally {
      setActivando(false);
    }
  }

  return { estado, activando, activar };
}
