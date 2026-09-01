'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { backendFetch } from '@/lib/backendApi';

export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  propiedadId: string | null;
  leida: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notificacion[]>([]);
  // El backend ya devuelve un conteo dedicado (`noLeidas`) junto con la
  // lista — antes se descartaba y se recalculaba con `items.filter(...)`,
  // que solo es exacto si la lista trae TODAS las notificaciones no leídas
  // (si el endpoint algún día pagina, ese cálculo local quedaría corto).
  // Usar el campo real del servidor evita depender de ese supuesto.
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, open, () => setOpen(false));

  useEffect(() => {
    if (!user) return;
    function cargar() {
      backendFetch<{ notificaciones: Notificacion[]; noLeidas: number }>('/notificaciones')
        .then((d) => { setItems(d.notificaciones ?? []); setUnread(d.noLeidas ?? 0); })
        .catch(() => {});
    }
    cargar();
    // Antes solo se pedía una vez al montar — alguien que ya tenía la
    // pestaña abierta cuando le llegaba un mensaje nunca veía el badge
    // actualizarse sin recargar toda la página (reporte real 2026-09-01,
    // sobre notificaciones de contacto). Mismo patrón de `visibilitychange`
    // que ya usa AuthContext.tsx para revalidar sesión al volver a la
    // pestaña; el intervalo cubre el caso de quedarse en la misma pestaña
    // sin cambiar de foco.
    const interval = setInterval(cargar, 60_000);
    function onVisible() {
      if (document.visibilityState === 'visible') cargar();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  async function marcarTodasLeidas() {
    setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
    setUnread(0);
    try {
      await backendFetch('/notificaciones', {
        method: 'PATCH',
        body: JSON.stringify({ all: true }),
      });
    } catch { /* estado optimista ya aplicado; se resincroniza en la próxima carga */ }
  }

  async function marcarLeida(id: string) {
    const era = items.find((n) => n.id === id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    if (era && !era.leida) setUnread((u) => Math.max(0, u - 1));
    try {
      await backendFetch('/notificaciones', {
        method: 'PATCH',
        body: JSON.stringify({ id }),
      });
    } catch { /* idem */ }
  }

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
                items.map((n) => (
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
          </div>
      )}
    </div>
  );
}
