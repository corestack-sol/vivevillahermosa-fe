# Mensajería bidireccional entre interesado y propietario

**Fecha:** 2026-09-02
**Estado:** Aprobado para implementación (pendiente construir)

## Contexto

Hoy "contactar" es una vía muerta: el formulario ("Enviar mensaje") guarda
nombre/teléfono/correo como texto libre en una tabla `Mensaje` sin ligarla
a ninguna cuenta real, dispara una notificación al propietario, y ahí
termina. El propietario puede leer ese mensaje único en
`/dashboard/propiedades/[id]/mensajes` (construido 2026-09-02), pero no
hay forma de responder desde la plataforma, y **quien mandó el mensaje no
tiene absolutamente ningún lugar donde ver lo que escribió** — ni su
propio mensaje, ni una eventual respuesta (que hoy no puede llegar por
ningún canal salvo que el propietario decida escribirle por fuera, con el
teléfono/correo que dejó en el formulario).

Pedido explícito del propietario de la plataforma (2026-09-02): construir
mensajería real de ida y vuelta, con notificación de "mensaje nuevo" en
ambos sentidos y marca de leído/no leído.

## Decisión de arquitectura (ya discutida y aprobada con el usuario)

Restricción explícita: solución de **largo plazo**, **costo bajo**,
pensada para **miles de usuarios**, con **bajo consumo de memoria de
servidor**.

- **WebSockets sostenidos por sesión (todo el tiempo que alguien tiene
  sesión iniciada) se descarta** — el costo de memoria escala con la base
  total de usuarios logueados, no con el uso real del chat. Para un sitio
  inmobiliario regional (uso en ráfagas alrededor de negociaciones
  puntuales, no una app de mensajería de uso constante), eso es
  desperdiciar memoria en conexiones fantasma la inmensa mayoría del
  tiempo.
- **Polling constante también se descarta** para los hilos de chat en sí
  — cientos/miles de clientes preguntando "¿hay algo nuevo?" cada pocos
  segundos genera carga de base de datos sostenida las 24 horas,
  independiente de si hay actividad real.
- **Elegido: Server-Sent Events (SSE), abierto SOLO mientras un hilo de
  chat específico está montado en pantalla** (se abre al entrar a
  `/dashboard/mensajes/[conversacionId]`, se cierra al salir). El número
  de conexiones simultáneas queda acotado a "conversaciones que alguien
  está viendo ahora mismo", no a la base total de usuarios — la métrica
  correcta para mantener memoria baja a escala. SSE es unidireccional
  (servidor → cliente), que es todo lo que hace falta: mandar un mensaje
  sigue siendo un `POST` normal, sin necesidad de un canal bidireccional
  completo (WebSocket) ni su overhead de protocolo. NestJS lo soporta
  nativo (`@Sse()`), sin librería nueva ni infraestructura adicional
  (sin Redis, sin gateway de WebSockets).
- **La campana general de notificaciones (`NotificationBell.tsx`) se
  queda exactamente en su polling de 60s actual** — volumen trivial
  incluso a miles de usuarios, no vale la pena tocarlo para este cambio.

## Alcance

**Dentro de alcance:**
- Mensajería de texto entre un interesado y el propietario de UNA
  propiedad específica, iniciada siempre por el interesado.
- Notificación real (campana + marca de "nuevo") en ambos sentidos.
- Bandeja única de conversaciones (`/dashboard/mensajes`) — una cuenta
  puede ser interesada en unas propiedades y dueña de otras a la vez, no
  hay dos bandejas separadas.
- Vista de hilo tipo chat, con actualización en vivo vía SSE mientras
  está abierto.

**Fuera de alcance (decisión explícita, confirmada con el usuario):**
- El flujo de "Ver información de contacto" (revelar teléfono/WhatsApp/
  correo al instante, `AgentCard.tsx`, cuando el propietario no exige
  "mensaje primero") **no cambia** — sigue siendo una salida directa
  fuera de la plataforma (WhatsApp/llamada), no genera conversación.
- Adjuntar fotos/archivos al chat.
- Notificaciones push del navegador (fuera de la campana in-app).
- Convertir los mensajes viejos (tabla actual, sin remitente identificado)
  en conversaciones reales — ver "Migración" más abajo.

## Modelo de datos (backend — Prisma)

```prisma
model Conversacion {
  id              String    @id @default(cuid())
  propiedadId     String
  // "A" = quien inició (el interesado), "B" = el dueño de la propiedad
  // al momento de iniciar. Guardar el id del dueño en el momento de
  // creación (no derivarlo en vivo de Property.userId) importa si la
  // propiedad cambia de dueño o se elimina — la conversación no debe
  // quedar huérfana ni cambiar de destinatario sola.
  usuarioAId      String
  usuarioBId      String
  createdAt       DateTime  @default(now())
  // Denormalizado a propósito — ordenar la bandeja por actividad
  // reciente sin tener que hacer un JOIN + MAX(mensaje.createdAt) en
  // cada carga. Se actualiza en la misma transacción que crea un Mensaje.
  ultimoMensajeAt DateTime  @default(now())
  mensajes        Mensaje[]

  @@unique([propiedadId, usuarioAId, usuarioBId])
}

model Mensaje {
  id             String       @id @default(cuid())
  conversacionId String
  remitenteId    String
  texto          String
  leido          Boolean      @default(false)
  createdAt      DateTime     @default(now())
  conversacion   Conversacion @relation(fields: [conversacionId], references: [id])
}
```

`Notificacion` gana un campo nuevo:

```prisma
// en el modelo Notificacion ya existente
conversacionId String?
```

## Contrato de API (backend)

Todas las rutas exigen sesión iniciada. Ninguna acepta mensajes de
alguien que no sea parte de la conversación (`usuarioAId`/`usuarioBId`).

### `POST /propiedades/:id/mensajes`
Inicia una conversación nueva (o reutiliza la existente si ya hay una
entre este usuario y el dueño de esa propiedad — `@@unique` de arriba lo
garantiza). **Rechaza con 400 si quien llama es el propio dueño de la
propiedad** — un dueño no "inicia" contra sí mismo, solo responde dentro
de una conversación que ya existe (ver ruta de abajo).

Body: `{ "texto": string }` (mínimo 1 carácter no vacío, mismo límite de
longitud razonable que ya validaba el formulario viejo).

Respuesta 201:
```json
{ "conversacionId": "...", "mensaje": { "id": "...", "texto": "...", "remitenteId": "...", "createdAt": "..." } }
```

Efecto secundario: crea `Notificacion` (`tipo: "mensaje_nuevo"`,
`conversacionId`, `propiedadId`) para el dueño.

### `POST /conversaciones/:conversacionId/mensajes`
Responde dentro de una conversación ya existente — la usa tanto el
interesado como el propietario. 403 si quien llama no es `usuarioAId` ni
`usuarioBId` de esa conversación. Mismo body/respuesta que arriba (sin
`conversacionId` en el body, ya viene en la URL). Actualiza
`Conversacion.ultimoMensajeAt`. Efecto secundario: notificación al OTRO
participante (nunca a quien mandó el mensaje).

### `GET /mensajes/conversaciones`
Lista las conversaciones donde el usuario en sesión es `usuarioAId` o
`usuarioBId`, ordenadas por `ultimoMensajeAt` descendente. Paginada
(`page`, igual patrón que `GET /admin/reportes` — sin `perPage`
configurable, mismo criterio que `GET /notificaciones` ya confirmado en
vivo).

```json
{
  "conversaciones": [
    {
      "id": "...",
      "propiedad": { "id": "...", "titulo": "...", "slug": "...", "foto": "..." },
      "otraPersona": { "id": "...", "nombre": "..." },
      "ultimoMensaje": { "texto": "...", "createdAt": "...", "remitenteId": "..." },
      "noLeidos": 2
    }
  ],
  "total": 14, "page": 1
}
```

### `GET /conversaciones/:conversacionId/mensajes`
403 si quien llama no es parte de la conversación. Devuelve el historial
completo (sin paginar por ahora — un hilo de mensajería entre dos
personas sobre una propiedad no llega a los volúmenes que sí justifican
paginar, a diferencia de la bandeja general). **Efecto secundario:
marca como `leido: true` todos los mensajes de esta conversación
dirigidos al usuario en sesión** (mismo criterio que ya usa
`GET /notificaciones` — no hace falta una llamada aparte de "marcar
leído").

### `GET /conversaciones/:conversacionId/eventos` (SSE)
`Content-Type: text/event-stream`. 403 inicial si quien pide no es parte
de la conversación (chequeo una sola vez, al abrir el stream — no hay
"reconexión con nuevas credenciales" a mitad de una conexión SSE).
Emite un evento por cada `Mensaje` nuevo de esa conversación:

```
event: mensaje_nuevo
data: {"id":"...","texto":"...","remitenteId":"...","createdAt":"..."}
```

El backend cierra la conexión si el cliente no manda ningún ping/no hay
actividad en, por ejemplo, 30 minutos — evita conexiones colgadas
indefinidamente si alguien deja la pestaña abierta y se le corta la red
sin que el navegador dispare el evento de cierre.

## Frontend (lo construyo en este cambio)

- **`/dashboard/mensajes`** — reemplaza `/dashboard/propiedades/[id]/
  mensajes` (esa ruta se elimina). Lista de conversaciones — foto y
  título de la propiedad, nombre de la otra persona, preview del último
  mensaje, punto de no-leído si `noLeidos > 0`. Clic entra al hilo.
- **`/dashboard/mensajes/[conversacionId]`** — vista de chat: burbujas
  alineadas según `remitenteId === user.id` (derecha) o no (izquierda),
  input de texto + botón enviar abajo, fijo. Al montar: `GET
  /conversaciones/:id/mensajes` (trae historial + marca leído) y abre el
  `EventSource` de `/conversaciones/:id/eventos`. Al desmontar: cierra el
  `EventSource` — igual que cualquier otro cleanup de `useEffect` ya
  usado en este proyecto (mismo patrón que los `useEffect` con `cancelado`
  de todo el resto del código).
- **`ContactForm.tsx`** — se simplifica a un solo `textarea` (ya no pide
  nombre/teléfono/correo — la cuenta con sesión ya los tiene, pedirlos de
  nuevo por mensaje ya no tiene sentido con remitente real). `onSubmit`
  llama `POST /propiedades/:id/mensajes` y redirige a
  `/dashboard/mensajes/:conversacionId` con el id que devuelve la
  respuesta.
- **`notificacionHref()`** (`useNotificaciones.ts`) — nuevo caso: `tipo
  === 'mensaje_nuevo'` → `/dashboard/mensajes/${n.conversacionId}`.
- **`OwnerActionsBar.tsx`** / cualquier lugar que hoy enlace a la vieja
  ruta por-propiedad — se actualiza a `/dashboard/mensajes` (bandeja
  general, ya no hay una vista por-propiedad separada).

## Orden de despliegue — no romper el contacto de hoy

`ContactForm.tsx` es hoy el único camino de conversión real de la
plataforma (cualquier propiedad, primer contacto) — no se puede apagar
hasta confirmar que el backend nuevo existe. Orden real:

1. Este cambio construye `/dashboard/mensajes`, `/dashboard/mensajes/
   [conversacionId]`, `notificacionHref()` nuevo, y el doc de backend —
   todo aditivo, no toca `ContactForm.tsx` ni `POST /propiedades/:id/
   contactar` todavía.
2. Backend implementa el contrato de arriba.
3. Verificación en vivo (cuentas de prueba reales, mismo método de esta
   sesión) confirma que `POST /propiedades/:id/mensajes` y el resto
   responden como se espera.
4. **Recién ahí** se cambia `ContactForm.tsx` al endpoint nuevo y se
   borra la ruta vieja `/dashboard/propiedades/[id]/mensajes` — en un
   cambio aparte, después de confirmar que el reemplazo funciona de
   verdad, no antes.

## Migración de datos existentes

Los `Mensaje` de la tabla actual (nombre/teléfono/correo en texto libre,
sin `remitenteId`) **no se convierten** a `Conversacion`/`Mensaje` nuevos
— no hay forma honesta de saber qué cuenta (si acaso alguna) mandó cada
uno. Quedan como están, tabla vieja intacta, de solo lectura histórica
(el backend decide si le cambia el nombre a `MensajeLegado` o la deja
igual con un comentario). El sistema nuevo arranca en cero el día que se
active — ningún propietario pierde mensajes que ya recibió, simplemente
no aparecen en la bandeja nueva.

## Verificación (mismo método de esta sesión: cuentas de prueba reales, borradas al terminar)

1. Cuenta A publica propiedad. Cuenta B inicia conversación
   (`POST /propiedades/:id/mensajes`) → `Notificacion` para A con
   `conversacionId` correcto.
2. A abre `/dashboard/mensajes/:id` → historial correcto, mensaje de B
   marcado `leido: true` después de este GET.
3. A responde (`POST /conversaciones/:id/mensajes`) → `Notificacion` para
   B, no para A mismo.
4. B tiene la pestaña de esa conversación abierta cuando A responde → el
   evento SSE llega sin recargar.
5. B cierra la pestaña → confirmar (del lado del servidor, log o métrica)
   que la conexión SSE se cerró, no quedó colgada.
6. Intentar `POST /propiedades/:id/mensajes` como A sobre su propia
   propiedad → 400. Intentar `POST /conversaciones/:id/mensajes` con una
   tercera cuenta C que no es parte → 403.
