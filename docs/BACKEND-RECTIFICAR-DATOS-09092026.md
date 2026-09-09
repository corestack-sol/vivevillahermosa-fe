# Rectificar nombre/correo de mi cuenta — contrato para backend

**Fecha:** 2026-09-07. **Estado (2026-09-09): `PATCH /auth/me` YA ES
REAL** — no existía en un primer chequeo el mismo 2026-09-09 (4 variantes,
todas 404 de ruta inexistente), pero un segundo chequeo minutos después ya
respondió real: `{ user: { id, email, nombre, rol, emailVerificado,
esAdmin } }`, 200. Confirmado con cuenta de prueba desechable: cambio de
nombre solo, correo solo, ambos a la vez, y los rechazos reales (sin
cambios → 400 "Envía un nombre o correo distinto al actual"; campo no
reconocido → 400 whitelist estricta, mismo patrón que el resto del
backend). `src/app/dashboard/cuenta/page.tsx` ya está conectado a este
endpoint real.

⚠️ **Pendiente de confirmar del lado del backend — correo ya verificado**:
el frontend bloquea cambiar el correo una vez que `emailVerificado` es
`true` (decisión explícita 2026-09-09, riesgo de secuestro de cuenta con
sesión robada) — pero esto es SOLO una restricción de interfaz. No se
probó si el backend también lo rechaza al llamar `PATCH /auth/me`
directo (sin pasar por el frontend) para una cuenta con correo ya
verificado — si no lo rechaza, cualquiera con acceso directo a la API
puede saltarse el bloqueo del frontend por completo. Recomendado: que el
backend también rechace `email` en el body si `emailVerificado` del
usuario en sesión ya es `true` (código de error propio, no un 500
genérico) — la única defensa real es la del servidor, la del frontend es
solo para no confundir a alguien que no sabía que estaba bloqueado.

**Por qué hace falta:** `/privacidad` (Aviso de privacidad) promete el
derecho ARCO completo, incluyendo "Rectificar" datos desactualizados. Hoy
solo existe de verdad Cancelar (`DELETE /auth/cuenta`, confirmado real) y
recuperar contraseña (`/auth/recuperar-password`) — nombre y correo no se
pueden editar en ningún lado, ni por el usuario ni por soporte vía la app.
Auditoría real 2026-09-09, hallazgo del usuario.

## Endpoint necesario

| Ruta | Método | Body | Qué hace |
|---|---|---|---|
| `/auth/me` | PATCH | `{ nombre?: string, email?: string }` | Actualiza el nombre y/o correo del usuario en sesión. |

## Puntos a decidir del lado del backend

- **Cambiar el correo probablemente necesita re-verificación** — mismo
  criterio que ya existe para `emailVerificado` en el registro (ver
  `AuthUser.emailVerificado` en `src/context/AuthContext.tsx`). Si el
  correo nuevo queda sin verificar hasta confirmarlo, el frontend necesita
  saberlo en la respuesta para avisarle a la persona.
- **Unicidad de correo** — igual que en `/auth/registro`, rechazar si el
  correo nuevo ya está en uso por otra cuenta (código de error claro, no
  un 500 genérico).
- **Nombre** — sin restricciones especiales conocidas más allá de lo que
  ya valida `/auth/registro` hoy (longitud mínima, etc.) — reusar esa
  misma validación aquí para no desalinearse.

## Frontend

Conectado (2026-09-09), `src/app/dashboard/cuenta/page.tsx` — enlazado
desde "Mi panel". Solo manda al backend el/los campos que de verdad
cambiaron (nunca el valor sin tocar, para no pegarle al rechazo de "sin
cambios"), llama a `refresh()` de `AuthContext` tras guardar, y lee
`emailVerificado` de la respuesta para avisar si el correo nuevo necesita
confirmarse. El campo de correo queda deshabilitado por completo si
`user.emailVerificado` ya era `true` antes de tocar nada — ver el aviso
de seguridad arriba.
