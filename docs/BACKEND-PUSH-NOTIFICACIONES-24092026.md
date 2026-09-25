# Push: qué se envía de verdad y un riesgo de seguridad (24-09-2026)

Auditoría en vivo (producción, cuentas desechables) para comprobar lo que promete el aviso de permisos de notificaciones del front (`PushOnboarding`).

## Cómo se probó

Dos cuentas desechables. Cada una registró una suscripción push con un `endpoint` propio en un receptor temporal (con claves falsas: sirve para ver si el backend **intenta** entregar, no para leer el contenido). Luego:

1. La cuenta B creó una alerta (Jonuta · casa · renta).
2. La cuenta A publicó una casa que coincide.
3. B escribió un mensaje a esa propiedad.

Todo se borró al final (propiedad, cuentas, receptor).

## Resultado

| Evento | Notificación dentro de la app | Push |
|---|---|---|
| Nueva propiedad que coincide con una alerta | Sí (`tipo: alerta_match`) | **Sí**: el backend hizo `POST` al endpoint de B ~1 s después de publicar (`aes128gcm`, `Authorization: vapid`, TTL 4 semanas) |
| Mensaje nuevo a una propiedad | Sí (`tipo: mensaje_nuevo`, "Prueba B te escribió sobre …") | **No**: 8 s después del mensaje no hubo ningún `POST` al endpoint de A (el push de la alerta sí había llegado en ~1 s) |

Por eso el aviso del front se limitó a prometer solo las alertas de propiedades.

## Pedidos

1. **Push para `mensaje_nuevo`.** Si el producto quiere que quien recibe un mensaje se entere aunque no tenga la app abierta, mandar también el push (mismo payload `{ titulo, mensaje, url, tag }` que ya entiende el service worker; `url` = `/dashboard/mensajes/<conversacionId>` y `tag` = id de la conversación para que varios mensajes del mismo hilo se reemplacen). Cuando esté, el front vuelve a listar "Mensajes" en el aviso.
2. **Validar el `endpoint` de `POST /push/suscripciones` (seguridad).** El backend aceptó (`201`) un endpoint `https://webhook.site/...` y **le hizo un `POST` desde el servidor** al disparar la alerta. Cualquier usuario registrado puede hacer que el servidor envíe peticiones a la URL que quiera (SSRF de salida). Aceptar solo hosts de servicios push reales (`fcm.googleapis.com`, `*.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`) y rechazar IPs/hosts internos.
3. Sigue abierto de antes (`BACKEND-LIMITES-Y-DUPLICADOS-23092026.md` §3): que `endpoint` sea único (upsert) para no duplicar avisos.

## Observaciones de la prueba (útiles para otras auditorías)

- `POST /auth/registro` y `POST /auth/login` responden con **dos** `Set-Cookie: vv_session`: la buena y otra vacía y expirada (sin `Domain`) que borra una cookie local. Un cliente que guarde "la última" se queda sin sesión.
- Throttling: tras ~13 registros y ~10 logins en pocos minutos, `registro` y `login` devolvieron `429` durante más de 10 minutos (registro, más de 20).
- `POST /propiedades` con un título/descripción que incluye "prueba" fue rechazado como "contenido señalado como fraudulento"; con texto realista, aceptado. Las fotos sintéticas fueron rechazadas ("parece un fondo abstracto").
