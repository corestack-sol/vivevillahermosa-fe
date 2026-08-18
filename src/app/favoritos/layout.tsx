import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

// Ver comentario en src/app/dashboard/layout.tsx — mismo reemplazo de
// src/proxy.ts, mismo motivo (Next.js 16 + Cloudflare).
export default async function FavoritosLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/auth/login?next=/favoritos');

  return <>{children}</>;
}
