// Ocultar un mensaje de "Compartir WhatsApp" — pedido explícito 2026-09-08.
// El backend NO tiene (todavía) ningún endpoint para borrar un mensaje —
// confirmado en vivo, ver docs/BACKEND-ELIMINAR-CONVERSACION-07092026.md
// (mismo hallazgo, mismo día). Pedido explícito del usuario: implementarlo
// de todos modos aunque el backend no lo tenga — esto es honesto sobre esa
// limitación: solo OCULTA el mensaje en ESTE navegador/dispositivo (mismo
// criterio de "eliminar para mí" que ya documenta ese archivo para
// conversaciones completas). El mensaje real sigue existiendo en el
// backend y la otra persona lo sigue viendo — no hay forma de cambiar eso
// sin un endpoint real. El día que el backend tenga DELETE de mensajes,
// esto se reemplaza por la llamada real; mientras tanto es la única opción
// honesta disponible.
function key(conversacionId: string): string {
  return `mensajesOcultos:${conversacionId}`;
}

export function getMensajesOcultos(conversacionId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key(conversacionId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function ocultarMensaje(conversacionId: string, mensajeId: string): Set<string> {
  const actuales = getMensajesOcultos(conversacionId);
  actuales.add(mensajeId);
  try {
    localStorage.setItem(key(conversacionId), JSON.stringify([...actuales]));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena) — no es crítico.
  }
  return actuales;
}
