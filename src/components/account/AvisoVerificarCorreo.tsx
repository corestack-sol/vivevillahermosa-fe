'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { backendFetch, esLimiteDePeticiones } from '@/lib/backendApi';
import { puedeReenviar, registrarIntentoReenvio, segundosHastaProximoReenvio } from '@/lib/limiteReenvioVerificacion';

const SONDEO_MS = 6000;
const ESPERA_REENVIO_S = 60;

/** "125" -> "3 min"; menos de 60s se muestra en segundos. */
function formatearEspera(segundos: number): string {
  return segundos > 60 ? `${Math.ceil(segundos / 60)} min` : `${segundos}s`;
}

/**
 * Aviso de correo sin verificar, con el mecanismo para resolverlo ahí mismo:
 *  - "Reenviar correo" (POST /auth/reenviar-verificacion) con espera de 60 s
 *    entre envíos (para no chocar con el límite de peticiones del servidor) y,
 *    aparte, el límite real de 3 por hora (limiteReenvioVerificacion.ts);
 *  - detecta SOLO cuando se verifica (pedido 2026-09-23): mientras la pestaña
 *    está visible vuelve a preguntar la sesión cada 6 s, y AuthContext ya la
 *    refresca al regresar a la pestaña — quien abre el enlace del correo en
 *    otra pestaña ve desaparecer el aviso sin recargar.
 * No renderiza nada si el correo ya está verificado.
 */
export function AvisoVerificarCorreo({ className = 'mb-5' }: { className?: string }) {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [reenviando, setReenviando] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const [espera, setEspera] = useState(0);
  const estabaSinVerificar = useRef(false);
  const sinVerificar = !!user && !user.emailVerificado;

  useEffect(() => {
    if (!sinVerificar) return;
    estabaSinVerificar.current = true;
    const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, SONDEO_MS);
    return () => clearInterval(id);
  }, [sinVerificar, refresh]);

  useEffect(() => {
    if (user?.emailVerificado && estabaSinVerificar.current) {
      estabaSinVerificar.current = false;
      toast.success('¡Correo verificado! Ya puedes publicar.');
    }
  }, [user?.emailVerificado, toast]);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((e) => e - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  if (!user || user.emailVerificado) return null;

  async function reenviar() {
    if (reenviando || espera > 0) return;
    // Límite real del backend: 3 por hora (docs/BACKEND-CONTACTO-DE-CUENTA-Y-VERIFICACION-23092026.md,
    // confirmado 2026-09-27). El candado de ESPERA_REENVIO_S de aquí abajo solo espacia
    // los clics 60s entre sí — sin esto, 3 clics en 3 minutos gastaban la hora completa y
    // el 4º clic recién se enteraba al chocar con el 429 real. Se revisa ANTES de llamar
    // al servidor, con el mismo conteo (localStorage) que sobrevive a un recargo de página.
    if (!puedeReenviar()) {
      const restante = segundosHastaProximoReenvio();
      toast.error(`Ya reenviaste el correo 3 veces esta hora. Vuelve a intentarlo en ${formatearEspera(restante)}.`);
      setEspera(restante);
      return;
    }
    setReenviando(true);
    try {
      await backendFetch('/auth/reenviar-verificacion', { method: 'POST' });
      registrarIntentoReenvio();
      toast.success('Te reenviamos el correo de verificación — revisa tu bandeja de entrada y la carpeta de spam.');
      setEspera(ESPERA_REENVIO_S);
    } catch (err) {
      // El 429 real del servidor (ej. otra pestaña ya gastó los 3 intentos) también
      // cuenta como un intento gastado, para que el conteo local no se desincronice.
      if (esLimiteDePeticiones(err)) registrarIntentoReenvio();
      toast.error(esLimiteDePeticiones(err) ? err.message : 'No se pudo reenviar el correo. Intenta de nuevo en unos minutos.');
    } finally {
      setReenviando(false);
    }
  }

  async function yaVerifique() {
    setComprobando(true);
    try {
      await refresh();
    } finally {
      setComprobando(false);
    }
  }

  return (
    <div role="status" className={`flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 ${className}`}>
      <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 text-xs text-amber-800 leading-relaxed">
        <p>
          <strong>Verifica tu correo para poder publicar.</strong> Te enviamos un mensaje a <strong className="break-all">{user.email}</strong>: abre el enlace y aquí lo detectamos solo, sin recargar.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
          <button
            type="button"
            onClick={reenviar}
            disabled={reenviando || espera > 0}
            className="flex items-center gap-1.5 font-semibold text-amber-900 underline underline-offset-2 disabled:opacity-50 disabled:no-underline"
          >
            {reenviando && <Loader2 size={12} className="animate-spin" />}
            {espera > 0 ? `Reenviar correo (${formatearEspera(espera)})` : 'Reenviar correo'}
          </button>
          <button
            type="button"
            onClick={yaVerifique}
            disabled={comprobando}
            className="flex items-center gap-1.5 font-semibold text-amber-900 underline underline-offset-2 disabled:opacity-50"
          >
            {comprobando && <Loader2 size={12} className="animate-spin" />}
            Ya lo verifiqué
          </button>
          <Link href="/dashboard/cuenta" target="_blank" rel="noopener" className="text-amber-800 underline underline-offset-2">
            ¿Correo equivocado? Cámbialo en Mi cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
