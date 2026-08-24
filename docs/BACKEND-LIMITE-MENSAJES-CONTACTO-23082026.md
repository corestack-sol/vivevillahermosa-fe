# Backend — límite de mensajes a un propietario (2026-08-23)

## Contexto / por qué

`POST /propiedades/:id/contactar` (disparado por `ContactForm.tsx`) hoy no
tiene ningún límite — una cuenta con sesión puede mandar mensajes
ilimitados al mismo propietario. Cada mensaje genera un correo real vía
Resend (`fase1-spec.md`: "ContactForm real — envía correo real"), así que
esto no es solo un problema de spam molesto: es acoso real hacia una
persona real, y cada envío tiene un costo (Resend) que hoy no tiene techo.
Pedido explícito: que exista equilibrio, y que **cruzar el límite bloquee
el envío**, no solo lo advierta — a diferencia del límite de uso de IA
(`docs/BACKEND-LIMITE-USO-IA-23082026.md`), donde no bloquear era la
decisión correcta porque el volumen ahí no es necesariamente mala fe. Acá
sí: mandarle 40 mensajes al mismo propietario no tiene lectura legítima.

## Dos flujos de contacto — este documento solo cubre uno

La plataforma tiene dos caminos distintos para contactar a un propietario
(`Property.requiereMensajePrimero`, ver comentario en `src/types/property.ts`):

1. **Revelación instantánea** (default) — clic en WhatsApp/teléfono genera
   un link `tel:`/`wa.me` directo desde el navegador (`AgentCard.tsx`). **No
   hay ninguna llamada al backend** — el clic no genera ningún request que
   se pueda limitar hoy. Rate-limitar esto requeriría instrumentar el clic
   como evento propio (`POST /propiedades/:id/revelar-contacto` o similar),
   que es una feature nueva, no un límite sobre algo que ya existe. Fuera
   de alcance de este documento.
2. **Mensaje primero** (`ContactForm.tsx`, cuando el propietario activó esa
   opción) — **sí** es un request real al backend
   (`POST /propiedades/:id/contactar`). Es el que cubre este documento.

Si el volumen de reveleciones instantáneas también preocupa, es un
documento aparte — el mecanismo es distinto (no hay mensaje, no hay texto
que moderar, solo frecuencia de "quién le pidió el teléfono a quién").

## El obstáculo real: `Property.userId` no existe todavía

Igual que en el documento de límite de IA, el candado más obvio —"cuántos
mensajes le mandó esta cuenta a este propietario, sin importar en cuál de
sus propiedades"— necesitaría una relación real Property→User que hoy no
existe (gap conocido, Fase 2). **Puente pragmático, mismo truco que ya usa
el propio envío de correo:** `ContactForm`/el backend YA necesitan
resolver el correo real del propietario para poder mandarle el mail
(`agenteEmail` en el registro de la propiedad, no un `userId`). Ese mismo
dato — el correo de destino, que ya se calcula en cada envío — sirve como
identificador estable del propietario para el límite, sin necesitar
esperar a que `Property.userId` sea real.

## Modelo de datos nuevo

```
MensajeContacto
  id              String   @id
  propiedadId     String   // igual que Property, sin FK real, mismo patrón que Favorito/Cita
  remitenteId     String   // User.id de quien envía — el form ya exige sesión
  propietarioEmail String  // el correo real de destino ya resuelto para el envío — ver arriba
  createdAt       DateTime @default(now())

  @@index([remitenteId, propiedadId, createdAt])
  @@index([remitenteId, propietarioEmail, createdAt])
```

Se escribe un registro únicamente cuando el mensaje se envía de verdad
(después de que Resend confirma, o antes si se prefiere fail-safe — a
decidir por quien implemente, pero mejor contar de más que de menos).

## Topes — tres niveles, el equilibrio pedido

Un solo tope global no distingue "le escribo a 15 propietarios distintos
porque ando buscando casa" (legítimo, incluso deseable) de "le mando 15
mensajes al MISMO propietario" (acoso). Tres niveles, el más estricto que
se cruce primero bloquea:

| Nivel | Tope | Por qué |
|---|---|---|
| Por propiedad (`remitenteId` + `propiedadId`) | **2 mensajes / 7 días** | Un mensaje de interés inicial, como mucho un segundo si el primero no tuvo respuesta. Más que eso sobre LA MISMA publicación no tiene lectura legítima — el propietario ya vio el interés. |
| Por propietario real (`remitenteId` + `propietarioEmail`) | **4 mensajes / 7 días** | Cubre el caso real de que el mismo propietario tenga varias propiedades y a la persona le interesen 2-3 — sin este nivel, el tope por-propiedad se evade fácilmente escribiendo sobre cada anuncio del mismo dueño. |
| Global (`remitenteId`, cualquier destino) | **20 mensajes / día** | Protege contra mandar mensajes masivos a propietarios distintos el mismo día — generoso para alguien buscando casa activamente (puede escribirle a 15-20 anuncios distintos en un día de búsqueda intensa), sin dejar pasar un patrón de spam masivo. |

## Qué pasa al cruzar el límite — bloqueo real, no solo aviso

A diferencia del documento de IA, aquí sí se bloquea directamente al
cruzar cualquiera de los 3 topes:

- `POST /propiedades/:id/contactar` responde **429** con un mensaje claro
  y específico según cuál tope se cruzó (ej. "Ya le escribiste a este
  propietario recientemente, dale tiempo a responder" vs "Llegaste al
  límite de mensajes de hoy, vuelve a intentar mañana") — nunca un 429
  genérico sin explicación, mismo criterio de "todo error tiene salida"
  que ya sigue el resto de la plataforma.
- **El frontend no necesita ningún cambio para esto.** `ContactForm.tsx`
  ya captura `BackendApiError` y muestra `err.message` tal cual venga del
  backend (`src/components/forms/ContactForm.tsx:70`) — en cuanto el
  backend mande un mensaje claro en el 429, se ve tal cual, sin desplegar
  nada nuevo. Confirmado leyendo el catch actual, no es una suposición.
- No hay "strikes" ni bloqueo de cuenta aquí (a diferencia de
  `moderacionBusqueda.ts`) — cruzar el tope no es evidencia de mala fe
  server-side más allá de esa acción puntual, solo bloquea EL envío que lo
  cruzó. Si el patrón se repite de forma sistemática entre varios
  propietarios distintos, ahí sí podría escalar a revisión humana en
  `/admin` — mismo mecanismo que ya existe para
  `IntentoSospechoso`/apelaciones, no algo nuevo que inventar.

## Fuera de alcance de este documento

- Revelación instantánea (WhatsApp/teléfono) — no genera request al
  backend hoy, ver arriba.
- Bloqueo de cuenta / apelación — reusa el mecanismo ya existente si hace
  falta, no se duplica aquí.
- Cambiar el flujo de `requiereMensajePrimero` en sí — sin cambios, este
  documento solo agrega un límite sobre el envío que ya existe.
