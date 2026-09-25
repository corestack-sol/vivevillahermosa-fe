'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { obtenerEstadoPush, omitirPushAutomatico, suscribirPush } from '@/lib/push';
import {
  debeMostrarPushOnboarding, esAppInstalada, esDispositivoMovil, hayPushPendienteDeLogin,
  marcarPushOnboardingVisto, marcarPushPendienteDeLogin, yaSeMostroPushOnboarding,
} from '@/lib/pushOnboarding';

/**
 * Pide permiso de notificaciones push la primera vez que se abre la app ya
 * instalada en el celular — pedido explícito 2026-09-25. Antes el permiso
 * nativo del navegador saltaba sin contexto (o solo si la persona entraba a
 * "Mis alertas"); aquí se explica primero para qué sirve y a qué funciones
 * pertenece, y solo si acepta se lanza el aviso nativo.
 */
export function PushOnboarding() {
  const { user } = useAuth();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [activando, setActivando] = useState(false);

  // ¿Corresponde mostrarlo? Se decide una vez, con un respiro para que la app
  // pinte primero y el modal no le gane a lo que la persona vino a ver.
  useEffect(() => {
    let cancelado = false;
    const temporizador = window.setTimeout(async () => {
      if (!esDispositivoMovil() || !esAppInstalada() || yaSeMostroPushOnboarding()) return;
      const soportado = (await obtenerEstadoPush().catch(() => 'no-soportado')) !== 'no-soportado';
      if (cancelado) return;
      const permiso = typeof Notification === 'undefined' ? 'sin-api' : Notification.permission;
      if (debeMostrarPushOnboarding({ movil: true, instalada: true, soportado, permiso, yaVisto: false })) {
        setAbierto(true);
      }
    }, 1500);
    return () => { cancelado = true; window.clearTimeout(temporizador); };
  }, []);

  // Aceptó antes de iniciar sesión: el permiso ya está dado, falta guardar la
  // suscripción en el backend (que va ligada a la cuenta). Sin preguntar otra vez.
  useEffect(() => {
    if (!user || !hayPushPendienteDeLogin()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      marcarPushPendienteDeLogin(false);
      return;
    }
    suscribirPush()
      .catch(() => {})
      .finally(() => marcarPushPendienteDeLogin(false));
  }, [user]);

  const cerrarSinActivar = useCallback(() => {
    marcarPushOnboardingVisto();
    // "Ahora no" también vale para Mis alertas: que no pida el permiso solo al entrar.
    omitirPushAutomatico();
    setAbierto(false);
  }, []);

  async function activar() {
    setActivando(true);
    marcarPushOnboardingVisto();
    try {
      if (user) {
        await suscribirPush();
        toast.success('Listo, te avisaremos de lo importante.');
      } else {
        const permiso = await Notification.requestPermission();
        if (permiso !== 'granted') throw new Error('Permiso de notificaciones denegado');
        marcarPushPendienteDeLogin(true);
        toast.success('Listo. Cuando inicies sesión te avisaremos de lo importante.');
      }
      setAbierto(false);
    } catch (err) {
      setAbierto(false);
      const permiso = typeof Notification === 'undefined' ? 'default' : Notification.permission;
      if (permiso === 'granted') {
        // El permiso sí se dio pero no se pudo guardar la suscripción: aviso real.
        toast.error(err instanceof Error ? err.message : 'No se pudieron activar las notificaciones.');
      } else {
        // Rechazó o cerró el aviso nativo: tampoco se le vuelve a pedir solo en Mis alertas.
        omitirPushAutomatico();
        toast.info('No se activaron las notificaciones. Puedes hacerlo cuando quieras en Mis alertas.');
      }
    } finally {
      setActivando(false);
    }
  }

  return (
    <Modal isOpen={abierto} onClose={cerrarSinActivar} title="Activa las notificaciones" maxWidth="sm">
      <p className="text-sm text-gray-600 mb-4">
        Te avisamos al instante, aunque no tengas la app abierta.
      </p>

      {/* Solo se promete lo que hoy llega como push: las alertas de propiedades.
          Auditoría en vivo 2026-09-24: los mensajes nuevos generan aviso DENTRO de
          la app pero el backend no manda push (docs/BACKEND-PUSH-NOTIFICACIONES-24092026.md).
          Cuando lo haga, se vuelve a listar aquí. */}
      <ul className="space-y-3 mb-5">
        <li className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-brand-pale text-brand flex items-center justify-center flex-shrink-0">
            <BellRing size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-800">Alertas de propiedades</p>
            <p className="text-xs text-gray-500">Cuando se publica algo que coincide con tus alertas. Créalas en Mis alertas.</p>
          </div>
        </li>
      </ul>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={activar}
          disabled={activando}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
        >
          {activando && <Loader2 size={15} className="animate-spin" />}
          Activar notificaciones
        </button>
        <button
          type="button"
          onClick={cerrarSinActivar}
          disabled={activando}
          className="w-full text-sm font-semibold text-gray-500 hover:text-gray-700 py-2.5 rounded-xl transition-colors"
        >
          Ahora no
        </button>
      </div>
      <p className="text-[11px] text-gray-400 text-center mt-3">Puedes cambiarlo cuando quieras en Mis alertas.</p>
    </Modal>
  );
}
