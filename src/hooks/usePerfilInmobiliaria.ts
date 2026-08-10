'use client';

import { useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backendApi';

export interface PerfilInmobiliaria {
  nombreEmpresa: string | null;
  logoDataUrl: string | null;
}

/** Trae nombre/logo de la inmobiliaria para usarlos al generar el reporte PDF (ver src/lib/reportePdf.ts). */
export function usePerfilInmobiliaria(enabled: boolean): PerfilInmobiliaria | null {
  const [perfil, setPerfil] = useState<PerfilInmobiliaria | null>(null);

  useEffect(() => {
    if (!enabled) return;
    backendFetch<{ perfil: PerfilInmobiliaria | null }>('/perfil-inmobiliaria')
      .then((d) => setPerfil(d.perfil ?? null))
      .catch(() => {});
  }, [enabled]);

  return perfil;
}
