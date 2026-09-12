# Bloquear y reportar usuarios en la mensajería — contrato para backend

**Fecha:** 2026-09-07. **Estado:** no existe nada de esto todavía —
confirmado en vivo, 8 variantes de endpoint probadas (bloquear,
desbloquear, reportar, listar bloqueados), todas 404 genuino.

**Pedido del usuario:** poder bloquear a alguien para que no siga
mandando mensajes, reportar a alguien (con modal de motivo: opciones +
campo libre "otro"), y poder desbloquear.

Distinto de lo que ya existe:
- `User.bloqueado` (admin/3-strikes) — bloquea la CUENTA completa de la
  plataforma. Esto es nuevo: un bloqueo de PERSONA A PERSONA, solo afecta
  si esas dos cuentas pueden mensajearse entre sí.
- `ReporteAnuncio` — reporta una PROPIEDAD. Esto es nuevo: reporta a una
  PERSONA (por su conducta en un chat), no un anuncio.

## Modelo de datos sugerido (Prisma)

```prisma
model BloqueoUsuario {
  id            String   @id @default(cuid())
  bloqueadorId  String
  bloqueadoId   String
  motivo        String
  motivoDetalle String?
  createdAt     DateTime @default(now())

  bloqueador User @relation("BloqueosHechos", fields: [bloqueadorId], references: [id])
  bloqueado  User @relation("BloqueosRecibidos", fields: [bloqueadoId], references: [id])

  @@unique([bloqueadorId, bloqueadoId])
}

model ReporteUsuario {
  id             String   @id @default(cuid())
  reportanteId   String
  reportadoId    String
  motivo         String
  motivoDetalle  String?
  conversacionId String?
  estado         String   @default("pendiente") // pendiente | revisado | descartado
  createdAt      DateTime @default(now())
}
```

## Endpoints necesarios

| Ruta | Método | Body / Query | Qué hace |
|---|---|---|---|
| `/usuarios/:id/bloquear` | POST | `{ motivo, motivoDetalle? }` | El usuario en sesión bloquea a `:id`. `motivo` es uno de los valores de la lista de abajo; `motivoDetalle` solo si `motivo === 'otro'`. |
| `/usuarios/:id/desbloquear` | POST | — | Quita el bloqueo (solo el bloqueador puede desbloquear). |
| `/usuarios/:id/bloqueado` | GET | — | `{ bloqueado: boolean }` — ¿el usuario en sesión bloqueó a `:id`? (No al revés — eso no debe saberse). |
| `/usuarios/:id/reportar` | POST | `{ motivo, motivoDetalle?, conversacionId? }` | Crea un `ReporteUsuario` para cola de revisión de admin. `conversacionId` opcional, da contexto de dónde vino. |

## Motivos (frontend ya los define, backend solo los guarda como texto)

Ver `src/lib/motivosModeracionUsuario.ts` en el frontend — valores exactos
que viajan en `motivo`:

**Bloquear:** `spam`, `ofensivo`, `fraude`, `no_quiero_contacto`, `otro`.
**Reportar:** `spam`, `acoso_ofensivo`, `fraude_estafa`, `contenido_inapropiado`, `otro`.

## El paso más importante — aplicación real, no solo cosmética

Sin esto, "bloquear" solo esconde el botón de escribir en el frontend —
la otra persona igual podría seguir mandando mensajes por su cuenta. Hace
falta que **`POST /conversaciones/:id/mensajes`** y **`POST
/propiedades/:id/mensajes`** rechacen con `403` cuando existe un
`BloqueoUsuario` entre las dos partes de la conversación (en cualquier
dirección — si A bloqueó a B, ni A ni B deberían poder mandarse mensajes
nuevos entre sí, aunque el que intenta escribir sea el que NO bloqueó).

## Fuera de alcance de este pedido, mencionarlo si preguntan

- Cola de admin para revisar `ReporteUsuario` (`/admin/reportes-usuario`)
  — no se pidió explícitamente, el frontend de hoy solo crea el reporte.
  Si se quiere revisar reportes desde el panel de admin más adelante, es
  trabajo aparte del mismo tamaño que ya tiene `/admin/reportes`
  (ReporteAnuncio).
- Página de "usuarios bloqueados" para gestionar la lista completa — el
  frontend de hoy solo permite desbloquear desde dentro del chat mismo
  (donde ya se sabe con quién), no hay una lista aparte.
