'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AdSlot } from './AdSlot';

const SEGUNDOS_ESPERA = 5;

interface AdGatePublicarProps {
  /** false = pasa children directo, sin anuncio ni espera (1ra publicación de la cuenta). */
  activo: boolean;
  children: React.ReactNode;
}

/**
 * Gate de anuncio en /publicar/gracias — pedido explícito 2026-09-08: la
 * 1ra publicación de cada cuenta no lo muestra, de la 2da en adelante sí
 * (incluidas cuentas profesionales/agente, sin excepción — decisión
 * explícita del usuario). GraciasPage decide `activo` según
 * `numeroPublicacion`; este componente solo sabe bloquear su `children`
 * (los botones de "seguir") detrás de una espera mínima cuando `activo` —
 * nunca pide clic en el anuncio en sí, solo esperar unos segundos viéndolo,
 * que es lo que permiten las políticas de AdSense (incentivar/forzar el
 * clic SÍ está prohibido, forzar la espera no).
 */
export function AdGatePublicar({ activo, children }: AdGatePublicarProps) {
  const [segundosRestantes, setSegundosRestantes] = useState(SEGUNDOS_ESPERA);

  useEffect(() => {
    if (!activo || segundosRestantes <= 0) return;
    const id = setTimeout(() => setSegundosRestantes((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [activo, segundosRestantes]);

  if (activo && segundosRestantes > 0) {
    return (
      <div className="text-left">
        <AdSlot slot="publicarGracias" minHeight={250} />
        <div
          className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-400 font-semibold py-3 rounded-xl cursor-not-allowed select-none"
          aria-live="polite"
        >
          <Loader2 size={16} className="animate-spin" />
          Continuar en {segundosRestantes}s
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
