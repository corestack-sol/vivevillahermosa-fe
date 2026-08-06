'use client';

import { useEffect, useState } from 'react';
import { getMisPropiedadesDemo, type EstadoPublicacion } from '@/lib/misPropiedadesDemo';
import { getEstadoOverride, ESTADO_OVERRIDE_EVENT } from '@/lib/estadoOverrides';

/**
 * Resuelve el estado actual (con override de localStorage aplicado) de esta
 * propiedad si es una de las "mis propiedades" de muestra, devolviendo
 * `null` cuando está activa o cuando no es una propiedad con dueño simulado
 * — en ambos casos no hay nada que ocultar. Para cualquier otro estado
 * (pausada/vencida/vendida/rentada) devuelve el estado puntual, para que
 * quien lo consuma pueda mostrar el motivo correcto en vez de asumir
 * siempre "pausada".
 *
 * Empieza en null y se resuelve en un efecto — así el render en servidor
 * nunca difiere del primer render en cliente. También escucha
 * ESTADO_OVERRIDE_EVENT: sin esto, archivar/pausar desde OwnerActionsBar
 * cambiaba localStorage pero ContactForm/AgentCard en esa misma página no
 * se enteraban hasta recargar (el evento nativo "storage" no dispara en la
 * pestaña que hizo el cambio).
 */
export function usePropiedadEstado(propertyId: string): EstadoPublicacion | null {
  const [estado, setEstado] = useState<EstadoPublicacion | null>(null);

  useEffect(() => {
    function recalcular() {
      const mine = getMisPropiedadesDemo().find((m) => m.property.id === propertyId);
      if (!mine) { setEstado(null); return; }
      const resuelto = getEstadoOverride(propertyId) ?? mine.estado;
      setEstado(resuelto === 'activa' ? null : resuelto);
    }
    recalcular();
    window.addEventListener(ESTADO_OVERRIDE_EVENT, recalcular);
    return () => window.removeEventListener(ESTADO_OVERRIDE_EVENT, recalcular);
  }, [propertyId]);

  return estado;
}
