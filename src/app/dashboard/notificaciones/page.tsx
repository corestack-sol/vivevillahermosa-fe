'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotificaciones, notificacionHref } from '@/hooks/useNotificaciones';
import { formatRelativeDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

/**
 * Inbox completo — antes solo existían las 5 más recientes en
 * dashboard/page.tsx (sin forma de ver el resto) y las ~8 del dropdown de
 * la campana. Pedido explícito 2026-09-02: "qué va a pasar cuando existan
 * cientos de notificaciones". `GET /notificaciones` ya pagina de verdad
 * (confirmado en vivo, ver docs/BACKEND-NOTIFICACIONES-PAGINACION-
 * 02092026.md) — `page` funciona, `perPage` queda fijo en 20 del lado del
 * servidor (rechazado como query param). "Cargar más" pide la siguiente
 * página de 20 en vez de traer todo de una sola vez.
 */
export default function NotificacionesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items: notificaciones, noLeidas, total, hayMas, loading, cargarMas, marcarLeida, marcarTodasLeidas } = useNotificaciones();

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [authLoading, user, router]);

  if (authLoading || !user || (loading && notificaciones.length === 0)) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="w-48 mb-8" />
        <Skeleton variant="image" className="w-full h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-gray-400 hover:text-brand transition-colors flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-heading font-bold text-gray-900">Notificaciones</h1>
          <p className="text-sm text-gray-500">
            {total > 0 ? `${total} en total, ` : ''}más reciente primero
          </p>
        </div>
        {noLeidas > 0 && (
          <button onClick={marcarTodasLeidas} className="text-xs text-brand font-semibold hover:underline flex-shrink-0">
            Marcar todas leídas
          </button>
        )}
      </div>

      {notificaciones.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={32} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Sin notificaciones todavía</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
          {notificaciones.map((n) => (
            <Link
              key={n.id}
              href={notificacionHref(n)}
              onClick={() => { if (!n.leida) marcarLeida(n.id); }}
              className={`flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors ${!n.leida ? 'bg-brand-pale/20' : ''}`}
            >
              {!n.leida && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />}
              <div className={`min-w-0 ${n.leida ? 'ml-[18px]' : ''}`}>
                <p className="text-sm font-medium text-gray-800 leading-snug">{n.titulo}</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-snug">{n.mensaje}</p>
                <p className="text-xs text-gray-400 mt-1">{formatRelativeDate(n.createdAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hayMas && (
        <div className="text-center mt-5">
          <Button variant="ghost" onClick={cargarMas} isLoading={loading}>
            Cargar más
          </Button>
        </div>
      )}
    </div>
  );
}
