import type { Property } from '@/types/property';
import { mapBackendProperty, type BackendPublicProperty } from '@/lib/api';
import { formatRelativeDate } from '@/lib/format';
import { Archive, PauseCircle, Clock, type LucideIcon } from 'lucide-react';

// Renombrado 2026-08-17 (antes misPropiedadesDemo.ts) — el nombre ya no
// describía el contenido: mapea datos reales de GET /propiedades/mias, no
// una simulación. Solo vistas/contactos/favoritos siguen en 0 (ver
// mapMiaBackend abajo) porque no hay tabla de eventos real todavía —
// documentado ahí puntualmente, no hace falta que el archivo entero se
// llame "Demo" por 3 campos.

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

export interface EstadoNoDisponibleCopy {
  label: string;
  Icon: LucideIcon;
  archivada: boolean;
  titulo: string;
  mensaje: string;
}

/**
 * Copy centralizado para los 4 estados en los que una propiedad deja de
 * aceptar contacto (todo menos 'activa') — usado por AgentCard.tsx,
 * ContactForm.tsx y MobileContactCta.tsx. Antes cada uno tenía su propio
 * ternario de 3 vías (vendida/rentada/lo-que-sea-más → "pausada"), así que
 * 'vencida' (ya estaba en EstadoPublicacion arriba, pero ningún componente
 * lo manejaba) caía en el mismo branch que 'pausada' — un mensaje real
 * pero equivocado ("el propietario la pausó") para un caso muy distinto
 * (venció sola, sin que el dueño hiciera nada). Reporte del backend
 * 2026-09-02: el enum de Postgres ya reserva 'vencida' para cuando se
 * construya la expiración automática de anuncios — no está en producción
 * todavía, pero el día que se active no debe quedar sin manejar aquí.
 *
 * El `switch` es exhaustivo a propósito (`never` en el default) — agregar
 * un estado nuevo algún día se vuelve un error de compilación en vez de
 * un mensaje equivocado en producción, sin depender de acordarse de tocar
 * los 3 componentes que lo consumen.
 */
export function estadoNoDisponibleInfo(estado: Exclude<EstadoPublicacion, 'activa'>): EstadoNoDisponibleCopy {
  switch (estado) {
    case 'vendida':
      return {
        label: 'Vendida', Icon: Archive, archivada: true,
        titulo: 'Propiedad vendida',
        mensaje: 'Esta operación ya se cerró — el anuncio se conserva como registro, pero no está recibiendo mensajes nuevos.',
      };
    case 'rentada':
      return {
        label: 'Rentada', Icon: Archive, archivada: true,
        titulo: 'Propiedad rentada',
        mensaje: 'Esta operación ya se cerró — el anuncio se conserva como registro, pero no está recibiendo mensajes nuevos.',
      };
    case 'pausada':
      return {
        label: 'Pausada', Icon: PauseCircle, archivada: false,
        titulo: 'Publicación pausada',
        mensaje: 'El propietario pausó temporalmente este anuncio — no está recibiendo mensajes por ahora.',
      };
    case 'vencida':
      return {
        label: 'Vencida', Icon: Clock, archivada: false,
        titulo: 'Publicación vencida',
        mensaje: 'Esta publicación venció y ya no está recibiendo mensajes — puede que el propietario la renueve más adelante.',
      };
    default: {
      const _exhaustivo: never = estado;
      throw new Error(`Estado no manejado: ${_exhaustivo}`);
    }
  }
}

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
 * `favoritos` se queda en 0: no hay forma de saber cuánta gente marcó
 * como favorita UNA propiedad específica (el backend solo expone los
 * favoritos DEL visitante que pregunta, nunca por propiedad — pedirlo
 * necesitaría un endpoint nuevo, fuera de alcance de este cambio).
 * `vistas`/`contactos` sí leen el campo real del backend cuando existe
 * (ver docs/BACKEND-VISTAS-CONTACTOS-02092026.md) — `?? 0` es el estado
 * honesto mientras el backend no lo mande, no un placeholder inventado.
 */
export function mapMiaBackend(bp: BackendPublicProperty): MiPropiedad {
  return {
    property: mapBackendProperty(bp),
    estado: bp.estado as EstadoPublicacion,
    vistas: bp.vistas ?? 0,
    contactos: bp.contactosReales ?? 0,
    favoritos: 0,
    publicadaHace: formatRelativeDate(bp.createdAt),
  };
}
