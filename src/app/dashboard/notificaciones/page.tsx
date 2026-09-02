'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotificaciones } from '@/hooks/useNotificaciones';
import { formatRelativeDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Inbox completo — antes solo existían las 5 más recientes en
 * dashboard/page.tsx (sin forma de ver el resto) y las ~8 del dropdown de
 * la campana. Pedido explícito 2026-09-02: "qué va a pasar cuando existan
 * cientos de notificaciones". Respuesta real hoy: `GET /notificaciones`
 * NO pagina (verificado en vivo, `page`/`perPage` se ignoran, nunca trae
 * `total`) — esta página ya muestra la lista completa que el backend
 * devuelve, sin controles de paginación falsos. Cuando el backend agregue
 * paginación real (ver docs/BACKEND-NOTIFICACIONES-PAGINACION-02092026.md),
 * esta pantalla es el lugar natural para agregarla.
 */
export default function NotificacionesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items: notificaciones, noLeidas, loading, marcarLeida, marcarTodasLeidas } = useNotificaciones();

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [authLoading, user, router]);

  if (authLoading || !user || loading) {
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
          <p className="text-sm text-gray-500">Todo lo que te ha llegado, más reciente primero</p>
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
              href={n.propiedadId ? `/propiedades/${n.propiedadId}` : '/dashboard'}
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
    </div>
  );
}
