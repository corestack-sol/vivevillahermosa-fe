// Tipos del sistema de mensajería bidireccional — ver
// docs/superpowers/specs/2026-09-02-mensajeria-bidireccional-design.md
// para el contrato completo. Backend confirmado en vivo 2026-09-06 (2
// cuentas de prueba reales, flujo completo).

export interface MensajeChat {
  id: string;
  texto: string;
  remitenteId: string;
  createdAt: string;
}

export interface ConversacionResumen {
  id: string;
  propiedad: { id: string; titulo: string; slug: string; foto: string | null };
  otraPersona: { id: string; nombre: string };
  ultimoMensaje: { texto: string; createdAt: string; remitenteId: string } | null;
  noLeidos: number;
}

/** Forma real de `GET /propiedades/:id/mensajes` — el sistema VIEJO de
 *  contacto de una sola vía (antes de la mensajería bidireccional), sigue
 *  vivo con datos históricos aunque ya no recibe mensajes nuevos desde que
 *  ContactForm.tsx se migró al sistema nuevo (2026-09-06). Sin
 *  `remitenteId` — nunca guardó qué cuenta lo mandó, solo nombre/teléfono/
 *  correo como texto libre, así que no se puede convertir en una
 *  Conversacion real ni responder desde la app. */
export interface MensajeLegado {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  mensaje: string;
  leido: boolean;
  createdAt: string;
}

/** Una fila de la bandeja unificada de `/dashboard/mensajes` — pedido
 *  explícito 2026-09-06: "unificalos" para que un mensaje del sistema
 *  viejo (contacto_propiedad) se vea igual que uno del chat nuevo
 *  (mensaje_nuevo) en la misma lista, en vez de dos pantallas separadas.
 *  `tipo` decide a dónde navega la card al hacer clic (ver
 *  dashboard/mensajes/page.tsx) — 'legado' no tiene hilo real, solo el
 *  mensaje original + datos de contacto directo (tel/correo).
 *
 *  `soyDueno` — pedido explícito 2026-09-07: diferenciar "me contactaron
 *  en una propiedad mía" de "yo contacté a alguien más". El backend no
 *  manda esto directo; se calcula comparando `propiedad.id` contra las
 *  propiedades propias (ver combinarBandejaMensajes) — un `legado` SIEMPRE
 *  es `true` porque solo existe para propiedades propias (`GET
 *  /propiedades/:id/mensajes` es por-propiedad-propia, nunca se pide para
 *  la propiedad de alguien más). */
export type ItemBandejaMensajes =
  | {
      tipo: 'conversacion';
      id: string;
      propiedad: { id: string; titulo: string; slug: string; foto: string | null };
      otraPersonaNombre: string;
      ultimoTexto: string;
      fecha: string;
      noLeidos: number;
      soyDueno: boolean;
    }
  | {
      tipo: 'legado';
      id: string;
      propiedadId: string;
      mensajeId: string;
      propiedad: { id: string; titulo: string; slug: string; foto: string | null };
      otraPersonaNombre: string;
      ultimoTexto: string;
      fecha: string;
      noLeidos: number;
      soyDueno: true;
    };

/**
 * Junta conversaciones reales + mensajes del sistema viejo en una sola
 * lista ordenada por fecha (más reciente primero) — función pura para
 * poder probarla sin mockear fetch. `legados` ya viene aplanado (una
 * entrada por mensaje, con la propiedad a la que pertenece) porque
 * `GET /propiedades/:id/mensajes` es por-propiedad, no hay un endpoint
 * "todos mis mensajes viejos" — quien llama ya hizo ese join.
 * `misPropiedadIds` decide `soyDueno` en cada conversación (ver arriba).
 */
export function combinarBandejaMensajes(
  conversaciones: ConversacionResumen[],
  legados: { propiedad: { id: string; titulo: string; slug: string; foto: string | null }; mensaje: MensajeLegado }[],
  misPropiedadIds: Set<string> = new Set(),
): ItemBandejaMensajes[] {
  const deConversaciones: ItemBandejaMensajes[] = conversaciones.map((c) => ({
    tipo: 'conversacion',
    id: c.id,
    propiedad: c.propiedad,
    otraPersonaNombre: c.otraPersona.nombre,
    ultimoTexto: c.ultimoMensaje?.texto ?? '',
    fecha: c.ultimoMensaje?.createdAt ?? '',
    noLeidos: c.noLeidos,
    soyDueno: misPropiedadIds.has(c.propiedad.id),
  }));
  const deLegados: ItemBandejaMensajes[] = legados.map(({ propiedad, mensaje }) => ({
    tipo: 'legado',
    id: `legado:${propiedad.id}:${mensaje.id}`,
    propiedadId: propiedad.id,
    mensajeId: mensaje.id,
    propiedad,
    otraPersonaNombre: mensaje.nombre,
    ultimoTexto: mensaje.mensaje,
    fecha: mensaje.createdAt,
    noLeidos: mensaje.leido ? 0 : 1,
    soyDueno: true,
  }));
  return [...deConversaciones, ...deLegados].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
}
