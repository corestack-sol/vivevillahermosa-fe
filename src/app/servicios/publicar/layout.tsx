import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

// Ver comentario en src/app/dashboard/layout.tsx — mismo reemplazo de
// src/proxy.ts, mismo motivo (Next.js 16 + Cloudflare). Scoped solo a
// /servicios/publicar (este directorio) — /servicios y /servicios/[id]
// siguen públicos, el layout de un nivel arriba no existe así que no hay
// nada que este archivo esté "sobre-protegiendo".
export default async function ServiciosPublicarLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/auth/login?next=/servicios/publicar');

  return <>{children}</>;
}
