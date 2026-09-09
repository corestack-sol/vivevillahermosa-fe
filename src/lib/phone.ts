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
