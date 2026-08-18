import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

// Ver comentario en src/app/dashboard/layout.tsx — mismo reemplazo de
// src/proxy.ts, mismo motivo (Next.js 16 + Cloudflare). Cubre /publicar Y
// /publicar/gracias (subruta), igual que el matcher que tenía proxy.ts.
export default async function PublicarLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/auth/login?next=/publicar');

  return <>{children}</>;
}
