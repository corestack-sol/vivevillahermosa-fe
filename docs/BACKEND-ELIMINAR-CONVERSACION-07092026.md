# Eliminar una conversación/mensaje desde la bandeja — contrato para backend

**Fecha:** 2026-09-07. **Estado (2026-09-09): `DELETE /conversaciones/:id`
YA ES REAL** — confirmado en vivo con 2 cuentas de prueba desechables y
una conversación real: devuelve `{"ok":true}`, la conversación desaparece
de la bandeja de quien la borró, y sigue completa (con su último mensaje)
en la bandeja de la otra persona — exactamente la semántica "eliminar
para mí" que se pedía abajo. `src/app/dashboard/mensajes/page.tsx` ya
llamaba a este endpoint desde que se construyó el botón (2026-09-07), sin
esperar a que el backend lo tuviera — no hizo falta ningún cambio de
frontend, ya estaba listo.
`DELETE /propiedades/:id/mensajes/:mensajeId` (sistema legado) no se
volvió a confirmar con un mensaje real — el 404 de un id inventado ya no
trae el texto "Cannot DELETE ..." de antes (sugiere que también existe),
pero eso solo no alcanza para darlo por confirmado.

---

*Contrato original (2026-09-07), dejado como referencia de la semántica ya
implementada:*

**Pedido del usuario:** poder eliminar un chat completo desde
`/dashboard/mensajes`.

## Semántica recomendada: "eliminar para mí", no destruir para ambos

Igual que WhatsApp/Messenger — eliminar una conversación la saca de TU
bandeja, no borra el historial de la otra persona ni las filas de
`Mensaje` en la base (esas son evidencia real si algún día hay que
investigar un abuso reportado, ver `ReporteUsuario`). Si la otra persona
manda un mensaje nuevo después, la conversación debería reaparecer en tu
bandeja (comportamiento esperado de "eliminar", no de "silenciar para
siempre").

## Endpoints necesarios

| Ruta | Método | Qué hace |
|---|---|---|
| `/conversaciones/:id` | DELETE | Oculta la conversación `:id` para el usuario en sesión. No borra `Mensaje` ni afecta a la otra persona. Si ambas partes la eliminan, ahí sí se puede limpiar de verdad (opcional, no urgente). |
| `/propiedades/:id/mensajes/:mensajeId` | DELETE | Sistema legado — borra ese mensaje de contacto de la vista del dueño (solo el dueño lo ve de todos modos, así que aquí sí puede ser un borrado real). |

## Modelo sugerido (para la opción "oculta para mí")

```prisma
model ConversacionOculta {
  id             String   @id @default(cuid())
  conversacionId String
  userId         String
  createdAt      DateTime @default(now())

  @@unique([conversacionId, userId])
}
```

`GET /mensajes/conversaciones` debe excluir cualquier conversación donde
exista una fila `ConversacionOculta` para el usuario en sesión — y si
llega un mensaje nuevo a esa conversación después, borrar esa fila (o
ignorarla al listar) para que reaparezca.
