import type { MotivoOption } from './motivosCierre';

/**
 * Motivos para bloquear/reportar a otra persona en un chat — pedido
 * explícito 2026-09-07. Backend nuevo, ver
 * docs/BACKEND-BLOQUEO-REPORTE-USUARIOS-07092026.md — estos `value`
 * viajan tal cual en el body de `POST /usuarios/:id/bloquear` y
 * `POST /usuarios/:id/reportar`.
 */
export const MOTIVOS_BLOQUEO: MotivoOption[] = [
  { value: 'spam', label: 'Me manda spam o publicidad' },
  { value: 'ofensivo', label: 'Lenguaje ofensivo o acoso' },
  { value: 'fraude', label: 'Parece un intento de fraude' },
  { value: 'no_quiero_contacto', label: 'Prefiero no tener más contacto' },
  { value: 'otro', label: 'Otro motivo' },
];

export const MOTIVOS_REPORTE_USUARIO: MotivoOption[] = [
  { value: 'spam', label: 'Spam o publicidad no deseada' },
  { value: 'acoso_ofensivo', label: 'Lenguaje ofensivo o acoso' },
  { value: 'fraude_estafa', label: 'Intento de fraude o estafa' },
  { value: 'contenido_inapropiado', label: 'Contenido inapropiado' },
  { value: 'otro', label: 'Otro motivo' },
];
