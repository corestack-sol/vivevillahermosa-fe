'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';

export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  propiedadId: string | null;
  leida: boolean;
  createdAt: string;
}

/**
 * Carga + acciones de notificaciones, en un solo lugar — antes
 * NotificationBell.tsx (campana del header) y dashboard/page.tsx (card
 * "Notificaciones recientes") repetían cada uno su propio fetch/marcar-
 * leída, y un tercer consumidor (dashboard/notificaciones/page.tsx, la
 * lista completa) hubiera sido una tercera copia. `GET /notificaciones`
 * NO pagina hoy (verificado en vivo 2026-09-02: `page`/`perPage` como
 * query param se ignoran, la respuesta nunca trae `total`) — devuelve
 * todo de una vez, así que los 3 consumidores comparten exactamente el
 * mismo resultado sin necesidad de parámetros distintos entre ellos.
 *
 * El polling cada 60s + revalidar al volver a la pestaña (antes solo en
 * la campana, reporte real 2026-09-01: el badge no se actualizaba solo)
 * ahora vive aquí, para que cualquier pantalla que use este hook se
 * mantenga al día igual, no solo la campana.
 */
export function useNotificaciones() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(() => {
    if (!user) { setLoading(false); return; }
    return backendFetch<{ notificaciones: Notificacion[]; noLeidas: number }>('/notificaciones')
      .then((d) => { setItems(d.notificaciones ?? []); setNoLeidas(d.noLeidas ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    // Envuelto en una función local — mismo workaround ya usado en
    // dashboard/leads/page.tsx y admin/reportes/page.tsx para la regla de
    // lint react-hooks/set-state-in-effect, que marca error si `cargar`
    // (definida fuera del efecto) se llama directo en el cuerpo.
    function cargarInicial() { cargar(); }
    cargarInicial();
    if (!user) return;
    const interval = setInterval(cargar, 60_000);
    function onVisible() {
      if (document.visibilityState === 'visible') cargar();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, cargar]);

  async function marcarLeida(id: string) {
    const era = items.find((n) => n.id === id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    if (era && !era.leida) setNoLeidas((u) => Math.max(0, u - 1));
    try {
      await backendFetch('/notificaciones', { method: 'PATCH', body: JSON.stringify({ id }) });
    } catch { /* estado optimista ya aplicado; se resincroniza en la próxima carga */ }
  }

  async function marcarTodasLeidas() {
    setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
    setNoLeidas(0);
    try {
      await backendFetch('/notificaciones', { method: 'PATCH', body: JSON.stringify({ all: true }) });
    } catch { /* idem */ }
  }

  return { items, noLeidas, loading, marcarLeida, marcarTodasLeidas };
}
