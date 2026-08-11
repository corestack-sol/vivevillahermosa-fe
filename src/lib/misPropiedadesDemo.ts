import type { Property } from '@/types/property';
import { mapBackendProperty, type BackendPublicProperty } from '@/lib/api';
import { formatRelativeDate } from '@/lib/format';

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
 * Adapta una propiedad del backend (GET /propiedades/mias) a la forma que
 * usa el panel del dueño — compartida por dashboard/propiedades,
 * dashboard/analitica y dashboard/page.tsx para no triplicar el mapeo.
 * vistas/contactos/favoritos en 0: sin backend de analítica todavía
 * (BACKEND.md §12, fuera del MVP).
 */
export function mapMiaBackend(bp: BackendPublicProperty): MiPropiedad {
  return {
    property: mapBackendProperty(bp),
    estado: bp.estado as EstadoPublicacion,
    vistas: 0,
    contactos: 0,
    favoritos: 0,
    publicadaHace: formatRelativeDate(bp.createdAt),
  };
}
