/**
 * Catálogos de motivos para pausar/eliminar/archivar una propiedad —
 * pedido explícito 2026-08-23: registrar POR QUÉ una propiedad sale de
 * circulación, para poder medir si la plataforma cumple su propósito
 * (facilitar encontrar comprador/inquilino). Las opciones de "vendida/
 * rentada" son las que más importan para eso — preguntan si la persona se
 * encontró A TRAVÉS de la plataforma o no.
 *
 * ⚠️ BACKEND: estos valores viajan tal cual en el body de
 * PATCH /propiedades/:id (pausar, archivar) y como query params en
 * DELETE /propiedades/:id (eliminar) — ver
 * docs/BACKEND-MOTIVOS-CIERRE-23082026.md para el contrato completo. Hoy
 * el backend no los persiste todavía; se mandan de todas formas (mismo
 * patrón que amenidadesDetectadas — el campo no hace daño si se ignora).
 */
export interface MotivoOption {
  value: string;
  label: string;
}

// Ordenados del motivo más probable al menos probable (pedido 2026-09-23) —
// criterio de producto, no medido: "ya se vendió/rentó" (va primero en el
// modal, ver PausarPropiedadModal.tsx), luego una pausa temporal genérica,
// luego editar la publicación, luego mensajes poco serios; "otro" siempre al
// final. Si PostHog/el backend llegan a mostrar la frecuencia real, reordenar
// con esos datos.
export const MOTIVOS_PAUSA: MotivoOption[] = [
  { value: 'pausa_temporal', label: 'Pausa temporal, sigo interesado en publicarla' },
  { value: 'actualizando', label: 'Voy a actualizar precio, fotos o descripción' },
  { value: 'mensajes_no_calificados', label: 'Recibí muchos mensajes que no eran serios' },
  { value: 'otro', label: 'Otro motivo' },
];

export const MOTIVOS_ELIMINAR: MotivoOption[] = [
  { value: 'ya_no_disponible', label: 'Ya no está disponible para vender/rentar' },
  { value: 'encontre_fuera_plataforma', label: 'Encontré comprador/inquilino por otro medio' },
  { value: 'duplicada_error', label: 'La publiqué por error o está duplicada' },
  { value: 'mala_experiencia', label: 'Tuve una mala experiencia con la plataforma' },
  { value: 'otro', label: 'Otro motivo' },
];

// Solo se pregunta cuando "¿la encontraste a través de la plataforma?" es No.
export const MEDIOS_ALTERNOS: MotivoOption[] = [
  { value: 'facebook_marketplace', label: 'Facebook / Marketplace' },
  { value: 'conocido_referido', label: 'Conocido o referido' },
  { value: 'otro_portal', label: 'Otro portal inmobiliario' },
  { value: 'contacto_directo', label: 'Me contactó por otro medio (WhatsApp, letrero, etc.)' },
  { value: 'otro', label: 'Otro' },
];
