import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AdminNav } from './AdminNav';

/**
 * Gate server-side, no el patrón client-side que usan las páginas de
 * /dashboard/* — para algo con estas implicaciones (bloquear cuentas,
 * promover admins) no basta con que el cliente decida no renderizar: si
 * no hay sesión o no es admin, nunca se manda ni un byte del panel.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session || !session.esAdmin) redirect('/');

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav nombre={session.nombre} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
