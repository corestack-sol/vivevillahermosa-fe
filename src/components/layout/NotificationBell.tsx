'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useNotificaciones, type Notificacion } from '@/hooks/useNotificaciones';

export type { Notificacion };

export function NotificationBell() {
  const { user } = useAuth();
  const { items, noLeidas: unread, marcarLeida, marcarTodasLeidas } = useNotificaciones();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, open, () => setOpen(false));

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/8 transition-colors"
        aria-label={unread > 0 ? `Notificaciones — ${unread} sin leer` : 'Notificaciones'}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent ring-2 ring-brand-dark text-white text-[10px] font-bold leading-none flex items-center justify-center">
            {unread > 10 ? '10+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-white border border-gray-100 rounded-2xl shadow-xl z-30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-800">Notificaciones</p>
              {unread > 0 && (
                <button onClick={marcarTodasLeidas} className="text-xs text-brand font-semibold hover:underline">
                  Marcar todas leídas
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8 px-4">Sin notificaciones todavía</p>
              ) : (
                items.slice(0, 8).map((n) => (
                  <Link
                    key={n.id}
                    href={n.propiedadId ? `/propiedades/${n.propiedadId}` : '/dashboard'}
                    onClick={() => { setOpen(false); if (!n.leida) marcarLeida(n.id); }}
                    className={`block px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-brand-pale/40 transition-colors ${!n.leida ? 'bg-brand-pale/20' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.leida && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-snug">{n.titulo}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.mensaje}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
            {/* Este dropdown es para un vistazo rápido, no para revisar el
                historial completo — "ver todas" manda al inbox real
                (dashboard/notificaciones/page.tsx), sin tope de 8. */}
            <Link
              href="/dashboard/notificaciones"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-semibold text-brand hover:text-brand-dark py-2.5 border-t border-gray-50 hover:bg-gray-50 transition-colors"
            >
              Ver todas
            </Link>
          </div>
      )}
    </div>
  );
}
