/**
 * Un solo botón "Pausar" para sacar una publicación de circulación, sea cual
 * sea la razón (pedido 2026-09-23: menos botones, "pausa" para cualquier
 * motivo — otra vez disponible más adelante, ya se rentó, etc.).
 *
 * Por dentro NO son lo mismo, y por eso la decisión vive aquí y no en cada
 * pantalla: 'pausada' cuenta para el límite gratuito de 3 propiedades y se
 * muestra al público como "el propietario la pausó temporalmente", mientras
 * que 'vendida'/'rentada' liberan ese lugar, se muestran como operación
 * cerrada y guardan la respuesta de atribución ("¿te encontraron por la
 * plataforma?"). Si "ya se rentó" se guardara solo como pausada, ocuparía un
 * lugar del límite y diría algo falso en público.
 */
import type { EstadoPublicacion } from '@/lib/misPropiedades';

/** Valor del motivo que, al elegirlo, cierra la operación en vez de pausar. */
export const MOTIVO_OPERACION_CERRADA = 'operacion_cerrada';

export type ResultadoPausa =
  | { tipo: 'pausa'; motivo: string; motivoDetalle?: string }
  | { tipo: 'cerrada'; encontradoEnPlataforma: boolean; medioAlterno?: string; medioAlternoDetalle?: string };

/**
 * Estado y parámetros que se mandan a PATCH /propiedades/:id. `extra` viaja
 * como query params, nunca en el body: el backend rechaza con 400 cualquier
 * campo desconocido en el body (verificado en vivo 2026-08-23).
 */
export function resolverPausa(r: ResultadoPausa, operacion: 'venta' | 'renta'): { estado: EstadoPublicacion; extra: Record<string, string> } {
  if (r.tipo === 'cerrada') {
    return {
      estado: operacion === 'venta' ? 'vendida' : 'rentada',
      extra: {
        encontradoEnPlataforma: String(r.encontradoEnPlataforma),
        ...(r.medioAlterno && { medioAlterno: r.medioAlterno }),
        ...(r.medioAlternoDetalle && { medioAlternoDetalle: r.medioAlternoDetalle }),
      },
    };
  }
  return {
    estado: 'pausada',
    extra: { motivo: r.motivo, ...(r.motivoDetalle && { motivoDetalle: r.motivoDetalle }) },
  };
}
