'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';

export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  propiedadId: string | null;
  // Confirmado en vivo 2026-09-02 — el backend ya lo manda (ej.
  // "contacto_propiedad"). No exhaustivo a propósito: cualquier tipo
  // futuro que no sea de contacto simplemente cae en el destino genérico
  // de notificacionHref() de abajo.
  tipo?: string;
  leida: boolean;
  createdAt: string;
}

/**
 * A dónde manda el clic en una notificación — antes las 3 pantallas que
 * la muestran (campana, card del panel, inbox completo) mandaban SIEMPRE
 * a la ficha pública de la propiedad, que no muestra nada del interesado.
 * Bug real reportado 2026-09-02: "no muestra los datos del interesado".
 * Las de tipo "contacto_propiedad" ahora van directo a la bandeja de
 * mensajes de esa propiedad (dashboard/propiedades/[id]/mensajes/page.tsx,
 * construida hoy mismo) — ahí sí está nombre/teléfono/correo/mensaje real
 * de quien escribió. Cualquier otro tipo (o uno sin `propiedadId`) se
 * queda con el destino de antes.
 */
export function notificacionHref(n: Pick<Notificacion, 'tipo' | 'propiedadId'>): string {
  if (n.propiedadId && n.tipo === 'contacto_propiedad') return `/dashboard/propiedades/${n.propiedadId}/mensajes`;
  if (n.propiedadId) return `/propiedades/${n.propiedadId}`;
  return '/dashboard';
}

/**
 * Carga + acciones de notificaciones, en un solo lugar — antes
 * NotificationBell.tsx (campana del header) y dashboard/page.tsx (card
 * "Notificaciones recientes") repetían cada uno su propio fetch/marcar-
 * leída, y un tercer consumidor (dashboard/notificaciones/page.tsx, la
 * lista completa) hubiera sido una tercera copia.
 *
 * `GET /notificaciones` SÍ pagina hoy (confirmado en vivo 2026-09-02,
 * después de que antes no lo hiciera): acepta `page`, siempre trae
 * `total`/`page`/`perPage` — pero **`perPage` como query param da 400**
 * ("property perPage should not exist"), queda fijo en 20 del lado del
 * servidor. `cargarMas()`/`hayMas` acumulan páginas de 20 en 20 — la
 * campana y la card del panel no los usan (les basta con la página 1),
 * solo el inbox completo (dashboard/notificaciones/page.tsx) los necesita.
 *
 * El polling de 60s (antes solo en la campana, reporte real 2026-09-01:
 * el badge no se actualizaba solo) se salta mientras `page > 1` — si no,
 * cada recarga automática pisaría las páginas extra ya cargadas con solo
 * la página 1 de vuelta.
 */
export function useNotificaciones() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(1);

  const cargar = useCallback((pagina: number) => {
    if (!user) { setLoading(false); return; }
    return backendFetch<{ notificaciones: Notificacion[]; noLeidas: number; total?: number }>(`/notificaciones?page=${pagina}`)
      .then((d) => {
        pageRef.current = pagina;
        setItems((prev) => (pagina === 1 ? (d.notificaciones ?? []) : [...prev, ...(d.notificaciones ?? [])]));
        setNoLeidas(d.noLeidas ?? 0);
        setTotal(d.total ?? d.notificaciones?.length ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    function cargarInicial() { cargar(1); }
    cargarInicial();
    if (!user) return;
    const interval = setInterval(() => {
      if (pageRef.current === 1) cargar(1);
    }, 60_000);
    function onVisible() {
      if (document.visibilityState === 'visible' && pageRef.current === 1) cargar(1);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, cargar]);

  function cargarMas() {
    cargar(pageRef.current + 1);
  }

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

  return {
    items, noLeidas, loading, total,
    hayMas: items.length < total,
    cargarMas,
    marcarLeida, marcarTodasLeidas,
  };
}
