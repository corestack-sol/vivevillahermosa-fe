'use client';

import { useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backendApi';

export interface ConfiguracionAgenda {
  id: string;
  userId: string;
  diasLaborables: string;
  horaInicio: string;
  horaFin: string;
  duracionCitaMin: number;
  recordatorioMinAntes: number;
  updatedAt: string;
}

/** Config de agenda (días laborables, horario, duración, recordatorio) — null hasta que el profesional la guarde por primera vez. */
export function useConfiguracionAgenda(enabled: boolean) {
  const [config, setConfig] = useState<ConfiguracionAgenda | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function cargar() {
      if (!enabled) { setLoading(false); return; }
      backendFetch<{ config: ConfiguracionAgenda | null }>('/configuracion-agenda')
        .then((d) => setConfig(d.config ?? null))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    cargar();
  }, [enabled]);

  return { config, setConfig, loading };
}
