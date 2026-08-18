import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

/**
 * Reemplaza el guardia que antes vivía en src/proxy.ts (hallazgo M1 de la
 * auditoría) — se movió aquí porque Next.js 16 obliga a proxy.ts a correr
 * en runtime Node.js, y el adaptador de Cloudflare (@opennextjs/cloudflare)
 * todavía no soporta ese runtime para proxy/middleware. getSession() pide
 * el estado fresco al backend en cada request (no solo verifica un JWT
 * local), mismo patrón que /admin/layout.tsx — por eso este guardia es
 * igual o más seguro que el de proxy.ts, no un workaround a la baja.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/auth/login?next=/dashboard');

  return <>{children}</>;
}
