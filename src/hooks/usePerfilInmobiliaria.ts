'use client';

import { useEffect, useState } from 'react';

export interface PerfilInmobiliaria {
  nombreEmpresa: string | null;
  logoDataUrl: string | null;
}

/** Trae nombre/logo de la inmobiliaria para usarlos al generar el reporte PDF (ver src/lib/reportePdf.ts). */
export function usePerfilInmobiliaria(enabled: boolean): PerfilInmobiliaria | null {
  const [perfil, setPerfil] = useState<PerfilInmobiliaria | null>(null);

  useEffect(() => {
    if (!enabled) return;
    fetch('/api/perfil-inmobiliaria')
      .then((r) => r.json())
      .then((d) => setPerfil(d.perfil ?? null))
      .catch(() => {});
  }, [enabled]);

  return perfil;
}
