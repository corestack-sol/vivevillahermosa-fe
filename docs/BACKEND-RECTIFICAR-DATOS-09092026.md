# Rectificar nombre/correo de mi cuenta — contrato para backend

**Fecha:** 2026-09-09. **Estado:** no existe — confirmado en vivo con
cuenta de prueba desechable, 4 variantes probadas (`PATCH /auth/me`,
`PATCH /usuarios/me`, `PUT /auth/me`, `PATCH /auth/perfil`), las 4 dan 404
de ruta inexistente (`Cannot PATCH/PUT ...`), no 405/401 — el endpoint no
existe, no es un tema de permisos.

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

Pantalla lista para conectar en cuanto exista el endpoint — no se
construye "a ciegas" contra un contrato adivinado (mismo criterio que el
resto de `docs/BACKEND-*.md`). Cuando el endpoint esté real, agregar una
sección "Mis datos" en `/dashboard` (o página propia `/dashboard/cuenta`)
con `Input` de nombre/correo, guardado vía `PATCH /auth/me`, y actualizar
`AuthContext` (`refresh()`) para reflejar el cambio sin recargar la
página.
