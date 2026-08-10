import type { Property } from '@/types/property';

export type EstadoPublicacion = 'activa' | 'pausada' | 'vencida' | 'vendida' | 'rentada';

// Estados que significan "ya no está en circulación porque se cerró con
// éxito" — a diferencia de pausada/vencida, que son estados temporales o de
// abandono, vendida/rentada son un registro permanente de una operación
// lograda. Se usa para filtros y para decidir cuándo ocultar el botón de
// archivar (ver OwnerActionsBar y /dashboard/propiedades).
export const ESTADOS_ARCHIVADOS: readonly EstadoPublicacion[] = ['vendida', 'rentada'];

// Config visual compartida por /dashboard/propiedades y el banner de dueño
// en la ficha de propiedad — un solo lugar para no desalinear colores/labels.
export const ESTADO_CFG: Record<EstadoPublicacion, { label: string; cls: string }> = {
  activa:  { label: 'Activa',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pausada: { label: 'Pausada',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  vencida: { label: 'Vencida',  cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  vendida: { label: 'Vendida',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  rentada: { label: 'Rentada',  cls: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export interface MiPropiedad {
  property: Property;
  estado: EstadoPublicacion;
  vistas: number;
  contactos: number;
  favoritos: number;
  publicadaHace: string;
}

/**
 * ⚠️ DATOS DE MUESTRA — el Módulo 2 de fase2-spec.md (Panel de Propietario)
 * todavía no tiene backend real: no existe `Propiedad.userId` en la base de
 * datos, así que hoy no hay forma de saber qué propiedades son "de" un
 * usuario. Esto reutiliza 4 propiedades reales del catálogo para que el
 * panel se pueda diseñar y probar de punta a punta — cuando exista
 * `GET /api/propiedades/mias` (ver docs/BACKEND.md),
 * esta función se reemplaza por esa llamada real, sin tocar el resto de la
 * página.
 */
// ⚠️ 2026-08-10: getPropertyById ya no lee src/data/properties.json (ver
// api.ts) — estos 4 ids de muestra ya no resuelven a nada real, así que esta
// función devuelve vacío desde esta fase. Se queda síncrona y así de
// simple a propósito por muy poco tiempo: la fase siguiente reemplaza por
// completo este archivo y sus consumidores (OwnerActionsBar.tsx,
// dashboard/propiedades) por GET /propiedades/mias real — no vale la pena
// volverla async ni parchear datos de muestra que están a punto de
// borrarse junto con todos sus call-sites.
export function getMisPropiedadesDemo(): MiPropiedad[] {
  return [];
}
