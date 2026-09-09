// wa.me exige el numero completo en formato internacional (codigo de pais,
// sin '+'). El formulario de publicar pide el telefono a 10 digitos SIN 52
// (publishSchema.ts/publishServicioSchema.ts), asi que ese codigo hay que
// agregarlo aqui — antes se mandaba el numero crudo a wa.me y el link salia
// invalido para cualquier numero guardado como el formulario lo pide.
export function whatsappUrl(numero: string, texto: string): string {
  const digits = numero.replace(/\D/g, '');
  const conCodigoPais = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${conCodigoPais}?text=${encodeURIComponent(texto)}`;
}

// Sin `?text=` — pensado para compartir el número PELADO como texto plano
// dentro de un mensaje de chat (ver "Compartir WhatsApp" en
// dashboard/mensajes/[conversacionId]/page.tsx). Reporte real 2026-09-08:
// el link con `?text=` prellenado se veía como basura codificada
// (%2C, %20, etc.) dentro del cuerpo del mensaje — ese parámetro solo tiene
// sentido cuando WhatsApp lo interpreta al abrir el link, no como texto
// visible en otro chat.
export function whatsappBaseUrl(numero: string): string {
  const digits = numero.replace(/\D/g, '');
  const conCodigoPais = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${conCodigoPais}`;
}

// Formatea EN VIVO mientras la persona escribe — pedido explícito
// 2026-09-08, tras un caso real: una propiedad quedó con "663" en vez de
// "993" en el WhatsApp guardado (9→6, un typo de tecla adyacente en el
// teclado numérico). El campo antes era texto libre sin agrupar — un typo
// así se pierde fácil a simple vista en 10 dígitos corridos. Agrupado como
// "993 123 4567" (mismo formato que ya pedía el placeholder) es más fácil
// de revisar antes de publicar. Nunca deja escribir más de 10 dígitos —
// letras/símbolos se descartan solos, no hace falta que el campo los
// rechace con un error después.
export function formatTelefonoInput(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 10);
  if (digits.length > 6) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length > 3) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return digits;
}
