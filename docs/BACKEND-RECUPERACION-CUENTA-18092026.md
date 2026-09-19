# Recuperación de cuenta cuando se perdió el correo — pedido al backend

Fecha: 18/09/2026

## Problema

En "Mis datos" (`/dashboard/cuenta`) el correo ya confirmado no se puede
cambiar (correcto, por seguridad). El mensaje decía "si perdiste acceso a
este correo, contáctanos" sin ningún canal real. Hoy una persona que perdió
su correo no tiene salida: "Recuperar contraseña" también depende de ese
correo.

Etapa 1 (este documento): solicitud **revisada por un administrador**. La
etapa 2 (cambio de correo autoservicio con contraseña + enlace al correo
nuevo + aviso al viejo) queda para después.

## Lo que el frontend ya hizo

- Pantalla pública `/cuenta/recuperar-acceso` (mismo patrón que
  `/cuenta/solicitar-revision`), enlazada desde "Mis datos" y desde
  "Recuperar contraseña".
- Llama a `POST /cuenta/solicitar-cambio-correo` (contrato abajo). Mientras
  el endpoint responda 404/405/501, la pantalla ofrece enviar los mismos
  datos por correo (`mailto:`) para que nadie se quede sin salida. Ese
  respaldo se borra cuando confirmen el endpoint.
- La pantalla del panel de administración NO está construida: se hace cuando
  confirmen los endpoints de admin de abajo (reusando el patrón de
  `/admin/solicitudes`).

## 1. `POST /cuenta/solicitar-cambio-correo` (público, sin sesión)

Body:

```json
{
  "email": "correo actual de la cuenta (ya sin acceso)",
  "emailNuevo": "correo al que sí tiene acceso",
  "nombre": "nombre completo",
  "pruebas": "texto libre: propiedades publicadas, colonias, teléfonos, fechas (20-1000 caracteres)"
}
```

Respuesta: **siempre el mismo 200 `{ "ok": true }`** exista o no la cuenta
(mismo criterio que `POST /cuenta/solicitar-revision` y
`POST /auth/recuperar-password`) — nunca confirmar ni desmentir que un correo
tiene cuenta. Errores de validación 400; 429 por límite.

Reglas sugeridas:

- Validar formato de ambos correos, que sean distintos, largo de `pruebas`.
- Límite por IP (ej. 3 por hora) y máximo 1 solicitud abierta por cuenta.
- Guardar IP y user-agent junto a la solicitud (para el revisor).
- Si la cuenta existe: **avisar al correo actual** ("alguien pidió cambiar el
  correo de tu cuenta; si fuiste tú, ignora este mensaje; si no, responde
  aquí"). Si la persona todavía tiene acceso, es la mejor defensa contra
  quien intente robar la cuenta con este flujo.
- Cuentas `esAdmin`: no permitir este flujo (rechazo silencioso).

## 2. Modelo sugerido: `SolicitudCambioCorreo`

`id`, `userId` (null si el correo no existe), `emailActual`, `emailNuevo`,
`nombre`, `pruebas`, `ip`, `userAgent`, `estado`
(`PENDIENTE | APROBADA | RECHAZADA | COMPLETADA | EXPIRADA`), `createdAt`,
`resueltaAt`, `resueltaPorAdminId`, `motivoRechazo`.

## 3. Endpoints de administración

- `GET /admin/solicitudes-correo?estado=` — lista paginada.
- `GET /admin/solicitudes-correo/:id` — detalle **con contexto de la cuenta**
  para que el revisor pueda contrastar `pruebas`: fecha de registro, último
  login, `emailVerificado`, rol, proveedor (correo/Google), y sus
  propiedades (título, colonia, teléfono de contacto publicado).
- `POST /admin/solicitudes-correo/:id/aprobar`
- `POST /admin/solicitudes-correo/:id/rechazar` con `{ motivo }`.
- Todo queda en el registro de auditoría existente (`/admin/auditoria`).

## 4. Qué hace "aprobar" (importante)

Aprobar **no cambia el correo directamente**. Sugerido:

1. Enviar al `emailNuevo` un enlace/código de un solo uso (vigencia 24 h)
   para demostrar que la persona controla ese correo.
2. Al confirmarlo: cambiar `email`, `emailVerificado = true`, **revocar todas
   las sesiones**, invalidar códigos de recuperación de contraseña
   pendientes, y avisar al correo viejo del cambio.
3. Recomendado: como el correo viejo pudo estar comprometido, obligar a
   crear contraseña nueva por el correo nuevo (no conservar la anterior).
4. Rechazar o expirar: avisar al `emailNuevo` con el resultado.

## Decisiones abiertas para el backend

1. ¿Retraso de 24–48 h entre aprobar y aplicar (como Google), con aviso al
   correo viejo para poder cancelar?
2. Cuentas creadas con Google: el correo está ligado a Google — ¿se permite
   cambiarlo, o solo cuentas con contraseña propia?
3. Si `emailNuevo` ya pertenece a otra cuenta: respuesta genérica igual,
   pero al revisor mostrarle el conflicto.
4. ¿Cuánto tiempo se conservan las solicitudes resueltas (datos personales
   en `pruebas`, IP)? Sugerido: purgar `pruebas`/IP a los 90 días.

## Etapa 2 (después)

Con sesión iniciada: pedir contraseña de nuevo, enlace de confirmación al
correo nuevo, aviso con enlace "no fui yo, revertir" al correo viejo, y el
viejo sigue válido hasta confirmar el nuevo. Recuperación por código al
teléfono/WhatsApp como canal secundario (todas las propiedades ya llevan
teléfono).

---

## Respuesta del backend (18/09/2026) y lo que hizo el frontend

Confirmado: falta `POST /cuenta/confirmar-cambio-correo` (público,
`{ token, password }`; 400 token inválido/vencido, 409 correo ya tomado, 429
límite). Cuentas solo Google/Facebook quedan fuera del flujo (rechazo
silencioso, siempre 200). No se guarda solicitud si el correo actual no
existe. Sin retraso 24–48 h en la etapa 1. El detalle de admin no trae
"último login".

Frontend, ya construido:

- `/cuenta/confirmar-cambio-correo?token=…` — el enlace del correo nuevo
  debe apuntar exactamente a esa ruta. Lee el token una vez y lo **borra de la
  URL de inmediato** (`history.replaceState`); pide contraseña nueva (mín. 10);
  maneja 400 → "enlace inválido o vencido", 409, 429 y éxito.
- `src/lib/redactarUrl.ts` + `sanitize_properties` de PostHog: cualquier
  `token=`, `codigo=` o `code=` en una URL se censura antes de mandarse a
  PostHog (que adjunta la URL a cada clic y salida de página).
- `/cuenta/recuperar-acceso`: el éxito dice "Si los datos coinciden con una
  cuenta…" y hay un aviso previo para quien entra con Google/Facebook.
- Pendiente: pantallas de admin (esperan los endpoints desplegados) y quitar
  el respaldo `mailto:` cuando avisen.

Pedido al backend sobre el token: un solo uso, guardado con hash (no en
claro), y enlace `…/cuenta/confirmar-cambio-correo?token=<token>`.

## Objeción del frontend al punto 8

Que `PATCH /auth/me` deje cambiar un correo **ya verificado** con solo tener
sesión (sin contraseña ni aviso al correo viejo) deja la Etapa 1 sin efecto
como protección: sesión robada (equipo compartido, XSS futuro) → cambiar el
correo → "recuperar contraseña" al correo nuevo → toma de la cuenta, sin pasar
por ninguna revisión. Se entiende el derecho de rectificación, pero se puede
cumplir sin abrir ese hueco. Mínimo sugerido para no esperar a la Etapa 2:
avisar siempre al correo viejo cuando cambie un correo verificado (con enlace
"no fui yo"); idealmente pedir contraseña actual. La interfaz ya muestra el
campo bloqueado, así que no cambia nada visible.
