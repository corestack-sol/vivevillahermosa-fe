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
  // Nuevo — solo presente en notificaciones de tipo "mensaje_nuevo" del
  // sistema de mensajería bidireccional (ver docs/superpowers/specs/
  // 2026-09-02-mensajeria-bidireccional-design.md). `undefined` hasta que
  // el backend lo implemente; notificacionHref() cae al destino de antes
  // mientras tanto.
  conversacionId?: string;
  leida: boolean;
  createdAt: string;
}

/**
 * A dónde manda el clic en una notificación — antes las 3 pantallas que
 * la muestran (campana, card del panel, inbox completo) mandaban SIEMPRE
 * a la ficha pública de la propiedad, que no muestra nada del interesado.
 * Bug real reportado 2026-09-02: "no muestra los datos del interesado".
 *
 * "mensaje_nuevo" (sistema de mensajería bidireccional, todavía sin
 * construir del lado del backend) manda directo al hilo de chat — la
 * fuente de verdad real una vez exista. "contacto_propiedad" (el sistema
 * viejo, de una sola vía) sigue mandando a la bandeja por-propiedad de
 * hoy — esa ruta NO se toca todavía (ver el spec, "Orden de despliegue":
 * no se corta el flujo actual hasta confirmar que el nuevo funciona de
 * verdad). Cualquier otro tipo (o uno sin `propiedadId`) se queda con el
 * destino genérico.
 */
export function notificacionHref(n: Pick<Notificacion, 'tipo' | 'propiedadId' | 'conversacionId'>): string {
  if (n.tipo === 'mensaje_nuevo' && n.conversacionId) return `/dashboard/mensajes/${n.conversacionId}`;
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
