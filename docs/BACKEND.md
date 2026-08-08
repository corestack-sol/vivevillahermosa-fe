# Guía de Backend — Vive Villahermosa (backend independiente)

> **⚠️ CAMBIO DE ARQUITECTURA — 2026-08-06.** Hasta ahora, "backend" significaba `src/app/api/**/route.ts` dentro de este mismo repo Next.js (Route Handlers reales, con Prisma/SQLite — no una simulación). **Decisión confirmada por el usuario:** eso se reemplaza por un **proyecto backend completamente separado** (otro repositorio, su propio servidor), que emite su propio JWT — no comparte `JWT_SECRET` con Next.js. **Todo** el backend se mueve ahí, sin excepción: auth, favoritos, alertas, notificaciones, servicios, citas — no solo lo nuevo (`Property`).
>
> Este documento ya no describe "qué falta implementar dentro de Next.js" — describe **el contrato completo que el backend nuevo debe replicar**, extraído leyendo el código real de cada endpoint que existe hoy (no inventado), más lo que falta construir desde cero (`Property`). Next.js pasa a ser **100% frontend**: sin `src/app/api/`, llamando a este backend nuevo por HTTP.
>
> **Lee la sección "Decisiones abiertas" al final antes de desplegar a producción** — hay preguntas de arquitectura sin responder (cómo viaja el token entre los dos servicios, si la base de datos se migra o se empieza de cero, dónde se guardan las fotos). **No bloquean empezar a desarrollar hoy** — la plataforma todavía no está desplegada, así que no hay dominios reales sobre los que decidir el punto más importante (el token); esa sección ya trae el default seguro para desarrollar en local mientras tanto.

---

## 🔒 Antes de escribir código — activa este modo

**Ahora más que nunca, no es opcional.** Como el backend nuevo va a re-emitir sesión desde cero (JWT propio, sin compartir secreto), cualquier diferencia de comportamiento respecto a lo que el frontend ya espera (cookies, expiración, qué campos trae el payload, qué pasa si el token es inválido) rompe la app en producción. Antes de tocar el módulo de auth del backend nuevo:

> Actúa como un Software Reverse Engineer, Senior Backend Engineer y Software Architect.
>
> Tu objetivo NO es resumir superficialmente el código.
>
> Tu objetivo es reconstruir con precisión absoluta el funcionamiento completo del flujo de autenticación de la aplicación **tal como existe hoy en el repo Next.js** (`src/lib/auth.ts`, `src/proxy.ts`, `src/app/api/auth/**`, `src/context/AuthContext.tsx`), para replicarlo exactamente en el backend nuevo — mismos payloads, mismos códigos de estado, mismas reglas de bloqueo.
>
> Debes analizar TODO el código relacionado sin asumir nada y sin omitir ningún paso, aunque parezca trivial. Piensa como si tu equipo fuera a reescribir exactamente el mismo comportamiento únicamente leyendo tu documentación.
>
> **Incluye:** login, logout, registro, JWT (algoritmo, claims exactos, expiración de 7 días), OAuth Google/Facebook (incluyendo la mitigación de account pre-hijacking — no fusionar automáticamente una cuenta social con una cuenta de contraseña existente), bloqueo de cuentas (`User.bloqueado`) y su verificación en tiempo real en cada request autenticado, rate limiting por IP y por cuenta en login/registro, manejo de sesión inválida/expirada, y qué ve el usuario mientras se resuelve la sesión inicial (`AuthContext`).
>
> **Entrega:** resumen ejecutivo, flujo cronológico numerado, diagrama Mermaid, tabla de estados, tabla de tokens (claims exactos del JWT), tabla de endpoints (ver la sección "Autenticación" de este documento, que ya la resume — verifica que no falte nada contra el código real), casos especiales (cuenta bloqueada, OAuth con email ya existente, rate limit alcanzado), y una sección final: **"¿existe algún comportamiento de autenticación que no haya documentado?"** — si la respuesta es sí, agrégalo antes de continuar.
>
> No simplifiques. No resumas. No omitas. Si tienes dudas sobre un comportamiento, indícalo explícitamente como inferencia y explica por qué.

---

## 📋 Registro de cambios de hoy (2026-08-07) — léelo si ya conocías este documento

Todo lo de abajo ya está integrado en las secciones correspondientes (§2, §3, §4, §8, §11, §16) — esto es solo un resumen con links, para no tener que releer el documento entero buscando qué cambió desde la última vez. Si es tu primera vez leyendo este documento, ignora esta sección y ve directo al Índice.

**Nuevo — panel de administración + apelaciones (§16), construido completo hoy:**
- `User.esAdmin`, `SolicitudRevision`, `ReporteAnuncio`, `AccionAdmin` — 3 modelos nuevos + 1 campo nuevo.
- Los 14 endpoints `/admin/**` (métricas, usuarios y sus 4 acciones, solicitudes de revisión, reportes, intentos sospechosos, servicios, auditoría).
- `POST /cuenta/solicitar-revision` — endpoint público nuevo (la apelación real para una cuenta bloqueada por error).
- `POST /propiedades/reportar` dejó de ser un stub — persiste de verdad en `ReporteAnuncio`.

**Corregido — 14 bugs reales encontrados en auditoría propia de todo lo anterior, con pruebas de concurrencia en vivo:**
- `User.bloqueoResueltoEn` (campo nuevo) — el conteo de "3 strikes" (§8) ya no cuenta el historial completo, solo desde el último desbloqueo. **Importante:** sin este campo, una cuenta reactivada se re-bloqueaba con un solo intento nuevo en vez de 3 — replicar el campo y el filtro por fecha, no solo el conteo simple.
- **Cinco condiciones de carrera corregidas con escritura atómica** (verificadas con 8-10 requests concurrentes reales cada una) — el patrón a replicar en el backend nuevo es *nunca* "leer, decidir, escribir" en pasos separados cuando dos requests del mismo recurso pueden llegar casi al mismo tiempo:
  - `revocar-admin` (último admin) — antes contaba admins y escribía en dos pasos; ahora en una sola transacción.
  - Resolver de `solicitudes-revision` y de `reportes` — antes el chequeo de "ya resuelto" corría separado de la escritura; ahora es un `updateMany` atómico con el estado en el `WHERE`.
  - `POST /favoritos` (toggle) — antes leía el estado y creaba/borraba en dos pasos; ahora intenta la escritura directo y absorbe el error esperado del "perdedor" de la carrera (`P2002`/`P2025`).
  - `POST /servicios/:id/trabajos` (tope de 24, ver §11) — antes contaba y creaba en dos pasos; ahora en una sola transacción.
- `/cuenta/solicitar-revision` — ahora responde en tiempo constante (antes filtraba por latencia si el email existía o no), solo crea una fila si la cuenta está REALMENTE bloqueada, y colapsa reintentos en una sola solicitud pendiente en vez de duplicar.
- **Normalización de email** (`.trim().toLowerCase()`) agregada a `registro`, `login` y `solicitar-revision` — antes "Juan@Gmail.com" y "juan@gmail.com" eran cuentas "distintas" para cualquier lookup exacto. **Gap conocido, no corregido:** el login por Google/Facebook todavía no normaliza el email del perfil OAuth (ver nota en §2).
- 4 rutas de usuarios (bloquear/desbloquear/promover/revocar-admin) ya no confunden "no encontrado" con un error real de base de datos.
- Búsqueda de usuarios en `/admin/usuarios` ahora ignora acentos.
- `GET /admin/solicitudes-revision`, `/admin/reportes` y `/admin/servicios` ahora tienen un `take: 200` — antes no tenían ningún límite y crecerían sin cota con el tiempo.
- Desbloquear una cuenta manualmente (`/admin/usuarios/:id/desbloquear`) ahora resuelve automáticamente cualquier `SolicitudRevision` pendiente de esa persona — antes se quedaba huérfana, visible para siempre como "pendiente" aunque el problema ya se hubiera resuelto por otra vía.

**Cambiado — límite de fotos por propiedad:** bajó de 6 a 4 (`/propiedades/fotos`, ver §3) — reflejar el nuevo máximo en cualquier validación del lado del backend nuevo, no solo en el frontend.

**Nuevo — límites geográficos del estado, obligatorio en `POST`/`PATCH /propiedades` (§3, punto 12):** rechazar (400) si `lat`/`lng` cae fuera del polígono real de Tabasco (`estaEnTabasco()`, ray casting contra un polígono de 212 puntos obtenido de OSM/Nominatim, sin dependencias) — no solo marcar para moderación como el punto 11 (pin/colonia). El mapa del formulario de publicar también restringe paneo/zoom a la caja envolvente del estado, pero eso es UX, no reemplaza esta validación server-side.

**Nuevo — filtros de búsqueda ampliados (§3, fila de `GET /propiedades`; §8, `/ia/busqueda-inteligente`):** `recamarasMax`, `banos`, `m2Min`/`m2Max`, `amenidad`, `zonaDestacada` (catálogo curado de 9 zonas con perfil de mercado, `src/lib/zonasDestacadas.ts`) y `sort` (`precio-asc`\|`precio-desc`\|`reciente` — antes no existía ninguna forma de pedir "la más barata", solo topes de precio). De paso se documentaron en la misma fila `landmark`/`categoriaLandmark`/`cercaDosoBocas`, que ya existían antes de hoy pero nunca habían quedado listados en `GET /propiedades`.

**Nuevo — observabilidad de horas pico del buscador con IA (§8, §16):** `busquedaStats.ts` (cache hits, llamadas reales a OpenRouter, caídas a heurística, búsquedas por hora en zona horaria de Tabasco) expuesto en `GET /admin/metricas` (`busquedaIA`) y visible en `/admin`. Junto con esto, backstop global de `/ia/busqueda-inteligente` subido de 300 a 900/10min, timeouts subidos (7s→9s servidor, 21s→25s cliente) y una caché en memoria de interpretaciones (TTL 1h) — todo medido con pruebas de carga concurrente reales, no estimado. Ver también el bug de `globalThis`/singleton que forzó este mismo fix en `busquedaStats.ts`, `busquedaCache.ts` y `rateLimit.ts`.

**Sin tocar, fuera de este resumen:** los fixes de responsive/mobile de hoy (zoom de iOS en inputs, swipe en galería de fotos, layout de formularios) y el endurecimiento de mensajes de error de `publishSchema.ts` (helper `str()`, resumen de campos con error en el wizard de publicar) son 100% frontend — no cambian ningún contrato de API ni agregan ninguna regla de negocio nueva que el backend deba replicar, no hace falta nada del lado del backend por esos.

---

## Índice

0. [Decisiones abiertas](#decisiones-abiertas--leer-primero) — léela antes que nada, aunque esté al final del documento.
1. [Modelo de datos completo](#1-modelo-de-datos-completo)
2. [Autenticación](#2-autenticación)
3. [Propiedades — NUEVO, no existe hoy](#3-propiedades--nuevo-no-existe-hoy)
4. [Favoritos](#4-favoritos)
5. [Alertas y notificaciones](#5-alertas-y-notificaciones)
6. [Citas y configuración de agenda](#6-citas-y-configuración-de-agenda)
7. [Perfil de inmobiliaria](#7-perfil-de-inmobiliaria)
8. [IA (proxy a OpenRouter/Gemini)](#8-ia-proxy-a-openroutergemini)
9. [Colonias descubiertas](#9-colonias-descubiertas) · [9.1 Colonias más solicitadas — NUEVO](#91-colonias-más-solicitadas--nuevo-no-existe-hoy)
10. [Contacto y reportes sobre una propiedad](#10-contacto-y-reportes-sobre-una-propiedad)
11. [Directorio de servicios — ⏸️ EN PAUSA](#11-directorio-de-servicios--en-pausa)
12. [Stats del dashboard](#12-stats-del-dashboard)
13. [Cambios necesarios en el frontend Next.js](#13-cambios-necesarios-en-el-frontend-nextjs)
14. [Seguridad e infraestructura](#14-seguridad-e-infraestructura)
15. [V2 — fuera de alcance del MVP](#15-v2--fuera-de-alcance-del-mvp)
16. [Panel de administración — NUEVO, ya existe hoy en Next.js](#16-panel-de-administración--nuevo-ya-existe-hoy-en-nextjs)

---

## 1. Modelo de datos completo

> **`prisma/schema.prisma` (en la raíz de este mismo repo) es la fuente de verdad exacta — este resumen en prosa es solo para lectura rápida.** Ahí están los tipos precisos, `@default`, `@unique`, relaciones (`@relation`, `onDelete: Cascade`) e índices compuestos (`@@index`) tal cual, sin resumir. Los modelos 1-10 de abajo (`User` hasta `ColoniaDescubierta`) son una transcripción de los primeros ~225 líneas del archivo — ya existen y funcionan hoy dentro de Next.js. El modelo 11 (`Property`) es el sketch sugerido que está comentado (`//`) al final del mismo archivo — búscalo con `grep -n "MODELO Property" prisma/schema.prisma` — es nuevo, no existe como tabla real todavía en ningún lado. El backend nuevo no tiene por qué usar Prisma ni SQLite — pero esta es la forma de datos exacta que el frontend ya espera en cada respuesta, así que hay que replicarla, no reinventarla.

**1. `User`**
`id, email (único), password (nullable — vacío si es cuenta OAuth), nombre, rol ('buscador' | 'agente'), googleId? (único), facebookId? (único), avatar?, bloqueado (bool, default false), bloqueadoMotivo?, bloqueadoEn?, esAdmin (bool, default false — ver §16, nunca va en el JWT), createdAt, updatedAt`

**2. `Favorito`** — `id, userId, propiedadId (string libre, no FK — el catálogo de propiedades hoy es estático), createdAt`. Único por `(userId, propiedadId)`.

**3. `Alerta`** — `id, userId, municipio?, tipo?, operacion?, precioMax?, dosBocas (bool), sinRiesgo (bool), createdAt`.

**4. `Notificacion`** — `id, userId, tipo (default 'alerta_match'), titulo, mensaje, propiedadId? (nullable — null hasta que exista Property real), leida (bool), createdAt`.

**5. `PerfilInmobiliaria`** — `id, userId (único), nombreEmpresa?, logoDataUrl? (data URI base64, máx 400,000 caracteres), updatedAt`.

**6. `ConfiguracionAgenda`** — `id, userId (único), diasLaborables (string CSV, ej "1,2,3,4,5"), horaInicio ("HH:mm"), horaFin ("HH:mm"), duracionCitaMin (int), recordatorioMinAntes (int), updatedAt`.

**7. `Cita`** — `id, userId, propiedadId? (referencia libre), titulo, nombreCliente, telefonoCliente?, emailCliente?, notas?, fecha (DateTime), duracionMin (int, default 30), estado ('confirmada' | 'cancelada' | 'completada', default 'confirmada'), recordatorioEnviado (bool, default false), createdAt, updatedAt`.

**8. `ServicioProveedor`** (⏸️ en pausa, ver §11) — `id, userId, categoria, nombre, descripcion, municipio, colonia?, telefono, whatsapp?, email?, fotoDataUrl?, activo (bool, default true), createdAt, updatedAt`.

**9. `TrabajoServicio`** (⏸️ en pausa, ver §11) — `id, servicioId, imagenDataUrl, descripcion?, createdAt`.

**10. `ColoniaDescubierta`** — `id, key (único), label, municipio, lat, lng, radioKm, aliasesJson? (JSON de array de strings), fuenteTipo, verificadoEn`.

**12. `SolicitudRevision`** (ver §16) — `id, userId, motivo, estado ('pendiente'|'aprobada'|'rechazada'), respuestaAdmin?, resueltoPorId?, createdAt, resueltoEn?`.

**13. `ReporteAnuncio`** (ver §10 y §16) — `id, propiedadId, userId?, motivo, comentario?, estado ('pendiente'|'revisado'|'descartado'), createdAt`.

**14. `AccionAdmin`** (ver §16) — `id, adminId, accion, objetivoId, detalle?, createdAt`.

**11. `Property`** — **NUEVO.** Campos que el frontend ya espera (`src/types/property.ts`):
```
id, slug (único), titulo, descripcion, tipo (casa|departamento|terreno|local|oficina|bodega|habitacion),
operacion (venta|renta), precio, m2Construidos, m2Terreno, recamaras, banos, mediosBanos,
estacionamientos, antiguedad, amenidades (array), servicios (array, opcional),
fotos (array de URLs — hoy son data URI base64 en el frontend, el backend nuevo debe recibir
  archivos y devolver URLs reales, no aceptar base64 gigante en el body),
municipio (uno de los 17 valores de MUNICIPIO_OPTIONS, ver más abajo), colonia, direccion,
lat, lng (coordenada EXACTA del pin que colocó el dueño — PRIVADA, ver aviso de privacidad de ubicación
  más abajo, justo antes de §2),
latPublico, lngPublico (el único punto que se le puede devolver a alguien que no es el dueño — lo calcula
  el backend al crear/editar, nunca el frontend, ver el mismo aviso),
riesgoInundacion (bajo|medio|alto), zonaEcologica (bool), cercaDosoBocas (bool), featured (bool, default false),
alertaFraude? ({ señales: string[] } — SOLO lo calcula el servidor, nunca aceptar del cliente),
requiereModeracion (bool, default false), aceptaTerminosAt (datetime),
agenteNombre, agenteTel?, agenteEmail?, agenteWhatsapp? (PRIVADOS — ver aviso más abajo, mismo trato que lat/lng),
requiereMensajePrimero (bool, default false),
estado (activa|pausada|vencida|vendida|rentada, default activa), activa (bool, default true — soft-delete),
userId, createdAt, updatedAt
```

**Los 17 municipios válidos** (`MUNICIPIO_OPTIONS` en `src/lib/publishSchema.ts` del frontend — validar `municipio` contra esta lista exacta, son sensibles a mayúsculas/acentos):
`Centro, Cárdenas, Comalcalco, Paraíso, Nacajuca, Jalpa de Méndez, Huimanguillo, Centla, Macuspana, Tenosique, Cunduacán, Emiliano Zapata, Balancán, Jonuta, Tacotalpa, Teapa, Jalapa`

> ⚠️ **Corrección 2026-08-06 — privacidad de ubicación, `lat`/`lng` vs `latPublico`/`lngPublico`.**
> Una versión anterior de este documento decía "no aproximar `lat`/`lng` en el backend, el frontend ya lo hace al mostrarla" — **esa suposición era incorrecta** y quedó corregida en el frontend el mismo día (ver `src/lib/colonias.ts:getPuntoPublico`, `src/lib/api.ts`). El enmascaramiento que existía antes (un círculo/jitter dibujado en el mapa) era solo visual: la coordenada exacta seguía viajando completa a cualquier navegador — no solo en el mapa, sino en el bundle de JS de cualquier página con una tarjeta de propiedad, porque el archivo de datos estático se importa también desde componentes cliente. Abrir devtools bastaba para leer la dirección exacta de cualquier propiedad, sin sesión.
>
> **Lo que el backend nuevo debe replicar (no lo que decía la versión vieja de este documento):**
> - `lat`/`lng` (coordenada real del pin) se guarda, pero es un dato **privado** — mismo nivel que el teléfono/correo de contacto (§10). Nunca debe salir en la respuesta de un endpoint público.
> - Al crear o editar una propiedad (`POST`/`PATCH /propiedades`), el servidor calcula `latPublico`/`lngPublico` una sola vez: si la `colonia` declarada coincide con el catálogo de `ColoniaDescubierta`/colonias verificadas (§9), es el centroide de esa colonia; si no coincide con ninguna, es un desplazamiento amplio (~500m) de la coordenada real, determinista por `id` (mismo algoritmo que `jitterCoord` en `src/lib/colonias.ts` — trivial de portar, es una función pura sin dependencias de Next.js).
> - `GET /propiedades` y `GET /propiedades/:id` (sin sesión, o con sesión de alguien que NO es el dueño) devuelven **solo** `latPublico`/`lngPublico` — el campo `lat`/`lng` real ni siquiera debe estar presente en el JSON de esa respuesta, no basta con "no usarlo en el frontend".
> - `GET /propiedades/:id` cuando el `userId` de la sesión SÍ es el dueño, y `GET /propiedades/mias`, pueden incluir la coordenada real además de la pública — el dueño es quien la puso, verla no es una fuga.
> - La plataforma **no necesita** un endpoint tipo "revelar ubicación exacta" (a diferencia del teléfono, que sí tiene uno, §10) — compartir la dirección real sigue siendo una decisión 100% manual del propietario, por WhatsApp, fuera de la plataforma. No hay que construir nada para ese flujo, solo no filtrar el dato por accidente.

> ⚠️ **Corrección 2026-08-06 — el mismo bug existía para `agenteTel`/`agenteEmail`/`agenteWhatsapp`.**
> El endpoint `GET /propiedades/:id/contacto` (§10) siempre estuvo bien diseñado — exige sesión, tiene rate limit. El bug estaba en otro lado: `GET /propiedades` (la lista) devolvía el objeto de cada propiedad con el contacto real incluido en `agente`, sin que nadie tuviera que pasar por el endpoint gateado. Confirmado en vivo: pedir la lista sin sesión traía el teléfono y correo real de cada agente, repetido una vez por cada propiedad suya — el endpoint gateado no protegía nada porque el mismo dato ya viajaba por otro camino sin ninguna de sus protecciones.
> - `GET /propiedades` y `GET /propiedades/:id` (para quien no es el dueño) deben devolver `agente` con **solo** `nombre`, `foto`, `verificado` — nunca `tel`/`email`/`whatsapp`, ni siquiera cuando hay sesión iniciada. El único camino para esos tres campos es `GET /propiedades/:id/contacto`.
> - `GET /propiedades/:id` cuando el `userId` de la sesión SÍ es el dueño, y `GET /propiedades/mias`, sí pueden incluir su propio contacto completo — es su propio dato de contacto, no una fuga.

---

## 2. Autenticación

**Todo este dominio se reconstruye desde cero en el backend nuevo** — hoy vive en `src/lib/auth.ts` + `src/app/api/auth/**` dentro de Next.js. El JWT actual: `jose`, algoritmo `HS256`, payload `{ userId, email, nombre, rol }`, expira en 7 días (`TTL = 60*60*24*7` segundos). El backend nuevo puede mantener esta misma forma de payload (recomendado, para no tocar `AuthContext.tsx` del lado del frontend) o cambiarla — si cambia, el frontend necesita actualizarse también.

**Normalización de email (2026-08-06):** `registro` y `login` aplican `.trim().toLowerCase()` al email ANTES de cualquier `findUnique`/`create` — antes no lo hacían, así que "Juan@Gmail.com" y "juan@gmail.com" se trataban como cuentas distintas en cualquier comparación exacta (SQLite compara `=` sensible a mayúsculas por defecto). El backend nuevo debe normalizar igual, en todo lookup por email (incluyendo `/cuenta/solicitar-revision`, §16) — sin esto, una persona que registra su cuenta con mayúsculas y después escribe su email distinto en otro formulario (muy plausible en móvil, por auto-capitalización) no encuentra su propia cuenta. **Nota:** cuentas creadas ANTES de este cambio pueden tener el email guardado con mayúsculas mixtas — no se corrió ninguna migración de datos sobre esto (base de desarrollo, sin usuarios reales todavía); si se migra la base existente al backend nuevo, normalizar también los valores ya guardados.

| Endpoint actual (Next.js) | Método | Body | Respuesta | Notas de comportamiento a replicar |
|---|---|---|---|---|
| `/api/auth/registro` | POST | `{ nombre, email, password, rol? }` | `{ user: {id,email,nombre,rol} }` + cookie de sesión | `email` normalizado (ver arriba). `password` mínimo 10 caracteres. `bcrypt` costo **12**. Rate limit 8/hora por IP. 409 si el email ya existe. |
| `/api/auth/login` | POST | `{ email, password }` | `{ user: {...} }` + cookie | `email` normalizado (ver arriba). Rate limit 20/15min por IP **y** 5/15min por IP+email (frena fuerza bruta dirigida). 403 si `bloqueado`. 401 si la cuenta es OAuth-only (`password` null) — mensaje explícito "usa Google/Facebook". |
| `/api/auth/logout` | POST | — | `{ ok: true }` | Borra la cookie de sesión (`maxAge: 0`). |
| `/api/auth/me` | GET | — | `{ user: SessionPayload \| null }` | Nunca da error si no hay sesión — devuelve `user: null` con 200. |
| `/api/auth/cuenta` | DELETE | — | `{ ok: true }` + borra cookie | Elimina la cuenta **de inmediato**, sin período de gracia. Cascada a Favoritos/Alertas/Notificaciones/etc. (todo lo que tenga `onDelete: Cascade` sobre `userId`). |
| `/api/auth/google` | GET | query `?next=` | redirect 302 a Google | Genera `state` random, lo guarda en cookie `oauth_state` (10 min) junto con `oauth_next` (a dónde volver). |
| `/api/auth/google/callback` | GET | query `?code&state` | redirect 302 a `next` + cookie de sesión | Ver lógica de merge de cuenta abajo — es la parte más delicada de todo el módulo. |
| `/api/auth/facebook` + `/callback` | GET | igual que Google | igual que Google | Mismo patrón exacto, campo `facebookId` en vez de `googleId`. |
| `/api/auth/activar-inmobiliaria` | POST | — (requiere sesión) | `{ user: {...} }` + nueva cookie | Cambia `rol` a `'agente'` y **reemite** el JWT (el rol viaja en el payload). Sin cobro real — ver §15. |

**Lógica de OAuth que hay que replicar exactamente (mitigación de account pre-hijacking):**
1. Buscar usuario por `googleId`/`facebookId`. Si existe, usar ese.
2. Si no existe, buscar por `email` del perfil de Google/Facebook.
   - Si existe una cuenta con ese email **y ya tiene `password`** → **rechazar** (`error=account_exists`), pedir iniciar sesión con contraseña primero. **Nunca fusionar automáticamente** — así es como un atacante podría secuestrar una cuenta registrando primero el email de otra persona con contraseña.
   - Si existe una cuenta con ese email **sin `password`** (creada antes por el otro proveedor social) → sí se puede vincular (`googleId`/`facebookId` + `avatar`), es seguro porque nadie pudo "reservar" ese email con un secreto que controla.
   - Si no existe ninguna cuenta → crear una nueva con `rol: 'buscador'`.
3. Verificar `bloqueado` antes de emitir sesión (igual que login por contraseña).

**Gap conocido, no corregido todavía:** el paso 2 busca por `profile.email` tal cual lo devuelve Google/Facebook, sin pasar por la misma normalización (`.trim().toLowerCase()`) que ya tienen `registro`/`login` (ver arriba). Google normalmente ya devuelve el email en minúsculas, pero no está garantizado para todos los proveedores — si alguien se registró con contraseña usando mayúsculas mixtas (cuentas de antes del fix de normalización) y luego entra con OAuth usando el email en otro casing, el `findUnique` no encuentra la cuenta existente y crea una duplicada en vez de vincular. No se corrigió en esta ronda porque el flujo OAuth no se tocó — pendiente para cuando se retome ese módulo.

**Revocación en tiempo real (parcial, no general):** en cada request autenticado, además de verificar la firma/expiración del JWT, se consulta `User.bloqueado` en la base de datos — si es `true`, la sesión se trata como inválida aunque el JWT siga siendo válido y no haya expirado. Esto es lo único "en tiempo real" que existe hoy; no hay tabla de revocación general (ver §14).

---

## 3. Propiedades — NUEVO, no existe hoy

Este es el módulo que no existe en ningún lado todavía — ni en Next.js ni en ningún backend. Usa el modelo `Property` de §1.

| Endpoint | Método | Auth | Qué hace |
|---|---|---|---|
| `/propiedades` | GET | No | Lista + filtros **+ paginación** (`page`/`perPage` o `limit`/`offset` — ver nota de paginación abajo). Solo `activa=true` y `estado='activa'`. Cada propiedad trae `latPublico`/`lngPublico`, nunca `lat`/`lng` real (ver aviso de privacidad de ubicación en §1). Filtros exactos que el frontend ya envía hoy (`src/types/search.ts` → `SearchFilters`, `src/lib/filters.ts`): `q` (texto libre), `tipo`, `operacion`, `municipio`, `colonia`, `precioMin`/`precioMax`, `recamaras` (mínimo) y **`recamarasMax`** (máximo — nuevo, 2026-08-07, se combinan para un rango), **`banos`** (mínimo, nuevo), **`m2Min`/`m2Max`** (nuevo — contra `m2Terreno` si `tipo==='terreno'`, si no contra `m2Construidos`), **`amenidad`** (nuevo — texto libre, coincide contra `Property.amenidades`), `riesgoInundacion`, `cercaDosoBocas`, `landmark` (key de `src/lib/landmarks.ts`), `categoriaLandmark` (`'salud'\|'educacion'\|'comercial'`, sin nombrar un landmark específico), **`zonaDestacada`** (nuevo — key de `src/lib/zonasDestacadas.ts`, ver nota abajo), y **`sort`** (nuevo — `'relevancia'\|'precio-asc'\|'precio-desc'\|'reciente'`, ver nota abajo). **Nota de esta auditoría:** `landmark`/`categoriaLandmark`/`cercaDosoBocas` ya existían antes de hoy y tampoco estaban en esta lista — se agregan aquí de paso para que la fila quede completa, no son parte de lo nuevo de hoy. |
| `/propiedades/:id` | GET | **Opcional** | Por id o slug. Si no hay sesión o el `userId` de la sesión no coincide con el dueño → 404 si no está activa, y la respuesta trae `latPublico`/`lngPublico` únicamente. Si el `userId` de la sesión SÍ coincide con el dueño → devolverla aunque esté pausada/vencida/vendida/rentada (así el dueño puede ver/gestionar su propia ficha pausada desde la URL pública, igual que hoy), y esta vez sí puede incluir `lat`/`lng` real. |
| `/propiedades/mias` | GET | Sí | Todas las del usuario en sesión, sin filtrar por estado (incluye pausadas/vencidas). |
| `/propiedades` | POST | Sí | Crear. Ver validaciones obligatorias abajo. Rate limit sugerido: **10 publicaciones/día por usuario**, más 5/hora por IP como backstop contra creación de cuentas desechables. |
| `/propiedades/:id` | PATCH | Sí (dueño) | Editar campos, cambiar `estado`, marcar `featured`. 403 si `userId` no coincide. **Si el body incluye cambios a `precio`, `descripcion`, `titulo` o `fotos`, repetir los pasos 1-4 de las validaciones de `POST` sobre los datos nuevos** — sin esto, alguien podría publicar algo limpio y editarlo después a una estafa sin que nada lo detecte. **Si cambia `colonia`, `lat` o `lng`, recalcular `latPublico`/`lngPublico` y repetir la validación de consistencia pin/colonia** (pasos 7 y 11 de `POST`) — si no, un cambio de colonia deja el punto público apuntando al centroide viejo, o una edición reintroduce la misma inconsistencia sin que nada la detecte. Si el body solo trae `estado`/`featured` (pausar/reactivar/destacar), no hace falta re-validar fraude ni recalcular ubicación. Rate limit sugerido: 20/hora por usuario. |
| `/propiedades/:id` | DELETE | Sí (dueño) | Soft-delete (`activa=false`), no borrar la fila. 403 si `userId` no coincide. Rate limit sugerido: 20/hora por usuario. |
| `/propiedades/fotos` | POST | Sí | **Endpoint de subida separado, no parte del `POST /propiedades`** — recibe un archivo (`multipart/form-data`, un archivo por request, máx. 8MB de origen igual que hoy en `resizeImageToDataUrl`), lo sube a storage (Cloudinary/S3, ver §15) y devuelve `{ url }`. El frontend sube cada foto (hasta 4) por separado ANTES de armar el `POST /propiedades`, y manda el array de URLs ya subidas en `fotos`. Evita mezclar JSON + archivos binarios en un solo request y permite mostrar progreso por foto. |

> **Nota — `zonaDestacada` y `sort` (nuevo, 2026-08-07).** `zonaDestacada` no es un dato de `Property` — es una consulta geográfica contra un catálogo curado a mano de zonas con perfil de mercado reconocido (`src/lib/zonasDestacadas.ts`: 9 zonas, cada una con `categoria` — `'plusvalia-alta'|'comercial-conectividad'|'residencial-satelite'|'industrial-popular'` — y una o más `fuentes` que apuntan a un landmark o colonia ya verificados, nunca una coordenada nueva). Filtrar por `zonaDestacada=X` significa "la propiedad está cerca de cualquiera de las fuentes de la zona X" — mismo cálculo de distancia que ya usa `landmark`. Hay un valor especial, `'cualquiera'` (`ZONA_DESTACADA_CUALQUIERA`), que significa "cerca de cualquier zona de la categoría `plusvalia-alta`" — NO de las otras tres categorías, es un alcance intencionalmente angosto. `sort` es independiente de los filtros: distingue orden relativo ("la más barata") de un filtro absoluto ("hasta 12 mil") — sin este campo, "muéstrame la propiedad en renta con menor precio" no tenía forma de pedir orden, solo tope de precio, y una búsqueda así devolvía cualquier propiedad dentro de rango en vez de la más barata. Como `Property` no es una tabla real todavía, esto hoy corre en memoria contra el catálogo de muestra (`src/lib/filters.ts`) — el backend nuevo necesita un `ORDER BY precio ASC/DESC` (o `createdAt DESC` para `'reciente'`) real cuando `GET /propiedades` sea sobre datos reales, y replicar (o exponer como su propio catálogo estático) las 9 zonas de `zonasDestacadas.ts` para resolver el filtro del lado del servidor.

**Validaciones obligatorias en `POST` (ninguna existe hoy en el frontend de forma confiable — todas son evadibles con devtools tal como está hoy):**
1. Volver a correr el análisis de fraude (ver §8, proxy a `analizarFraude`) con los datos recién recibidos — nunca confiar en un resultado que venga del cliente. Si el resultado da `bloqueado: true`, rechazar con 400. Si da `riesgo: 'alto'`, guardar `alertaFraude` calculado aquí.
2. Volver a correr el análisis de imagen (§8, `analizarImagenPropiedad`) por cada foto antes de aceptarla.
3. Detección de lenguaje sensible/discriminatorio sobre título y descripción.
4. Si fraude alto o lenguaje discriminatorio → `requiereModeracion = true` en vez de publicar directo.
5. Validar `municipio` contra los 17 valores de §1.
6. Generar `id`/`slug` en el servidor — nunca aceptar uno que venga del cliente.
7. Guardar `lat`/`lng` exactos (privados, ver el aviso de privacidad de ubicación en §1) **y** calcular `latPublico`/`lngPublico` aquí mismo, en el servidor — nunca aceptar `latPublico`/`lngPublico` que vengan en el body del request, son calculados, no datos de entrada.
8. `fotos` en el body ya son URLs (ver el endpoint `/propiedades/fotos` de arriba) — validar que sean URLs del propio storage configurado, no aceptar URLs arbitrarias de otro dominio.
9. Rate limit por usuario/IP (ver tabla de arriba).
10. Al crear con éxito, disparar el matching de alertas (§5) con los datos ya persistidos, pasando el `id`/`slug` real (para que `Notificacion.propiedadId` deje de ser `null`).
11. **Consistencia pin/colonia (nuevo, 2026-08-06):** si `colonia` coincide con el catálogo verificado (§9) y el pin (`lat`/`lng` recién recibidos) está a más de 3km de ese centroide, marcar `requiereModeracion = true` (mismo campo que ya usa el fraude/lenguaje sensible) en vez de rechazar — el frontend (`PublishForm.tsx`) ya avisa esto de forma no bloqueante, pero es evadible con devtools tal como cualquier otra validación de esta lista; el backend es quien debe hacerlo cumplir de verdad. Se encontraron dos casos reales de esta exacta inconsistencia en el catálogo de muestra durante esta auditoría (una colonia apuntando a un lugar a 2-3.5km de donde debía) — no es un caso hipotético.
12. **Límites geográficos del estado (nuevo, 2026-08-07):** `lat`/`lng` recién recibidos deben caer dentro del polígono real de Tabasco — **rechazar con 400 si no**, a diferencia del punto 11 (que solo marca para moderación). El frontend ya lo valida en `src/lib/tabascoBoundary.ts` (`estaEnTabasco(lat, lng)`, ray casting/algoritmo de Jordan, sin dependencias) contra un polígono real (no una caja) obtenido de OpenStreetMap vía Nominatim (`relation 2556680`, licencia ODbL) y simplificado en el servidor (`polygon_threshold=0.01`, Douglas-Peucker, ~19,000 → 212 puntos, tolerancia ~1.1km) — verificado sin falsos positivos contra los 17 centros de municipio, los 88 landmarks y las 88+753 colonias catalogadas. El archivo `src/data/tabasco-boundary.json` (un solo anillo `[lng,lat][]`, formato GeoJSON) es trivial de portar: es una función pura sin dependencias de Next.js, igual que `jitterCoord` (ver aviso de privacidad en §1). **Esta validación es evadible con devtools tal como el resto de esta lista** — el frontend también restringe el paneo/zoom del mapa a la caja envolvente del estado (`MapPicker.tsx`, `MapView.tsx`, `TABASCO_BOUNDS` del mismo archivo, con ~0.15° de margen) pero eso es solo UX de navegación, no reemplaza esta validación del servidor. Aplica igual en `PATCH /propiedades/:id` si el body cambia `lat`/`lng` (mismo punto donde ya se repite la validación de consistencia pin/colonia, ver la fila de `PATCH` arriba).

**Nota de paginación (importante — dos consumidores internos necesitan la lista COMPLETA, no paginada):**
- `sitemap.xml` (hoy `src/app/sitemap.ts`) necesita iterar TODAS las propiedades activas para generar sus URLs.
- Las estadísticas por municipio/zona/colonia de `/zonas` (hoy `getMunicipalitiesWithLiveStats`/`getZonesWithLiveStats`/`getColoniasRankedByPropiedades` en `src/lib/api.ts`) hoy filtran sobre el catálogo completo para calcular conteos y precios promedio.
- Si `GET /propiedades` pagina por defecto (recomendado para la búsqueda normal), estos dos casos necesitan una forma de pedir todo — ya sea un `limit` alto explícito, un parámetro `all=true` para uso interno, o (mejor a mediano plazo) endpoints de agregación dedicados (`GET /propiedades/stats?groupBy=municipio`) en vez de traer cada propiedad completa solo para contarlas.

**Criterio de aceptación** (igual entre dos navegadores/dispositivos distintos):
1. Usuario A publica → Usuario B, sin sesión, la encuentra en `GET /propiedades` con los filtros correctos.
2. B abre `GET /propiedades/:id` sin error.
3. A pausa (`PATCH estado=pausada`) → desaparece de la búsqueda de B, A la sigue viendo/gestionando en `GET /propiedades/mias` **y en `GET /propiedades/:id` con su propia sesión**.
4. A edita el precio a algo sospechoso → el análisis de fraude vuelve a correr y lo marca, igual que si lo hubiera puesto así desde el principio.
5. A elimina (`DELETE`) → desaparece para todos.

---

## 4. Favoritos

| Endpoint | Método | Auth | Body | Respuesta |
|---|---|---|---|---|
| `/favoritos` | GET | Sí | — | `{ favoritos: string[] }` — array de `propiedadId` |
| `/favoritos` | POST | Sí | `{ propiedadId }` | `{ favorito: boolean }` — **toggle**: si ya existía lo elimina y devuelve `false`, si no existía lo crea y devuelve `true` |

Único por `(userId, propiedadId)` — el toggle depende de este índice único para saber si ya existe.

> ⚠️ **Patrón a replicar con cuidado — no "leer, decidir, escribir" en dos pasos.** La primera versión de este endpoint hacía `findUnique` para decidir si crear o borrar, en dos operaciones separadas. Bajo concurrencia real (doble tap rápido en el corazón de favoritos, o un reintento de red) dos requests casi simultáneos pueden leer el mismo estado antes de que cualquiera escriba — el segundo `create`/`delete` choca con lo que el primero ya hizo y truena con un error de base de datos sin manejar (500). **Fix aplicado (2026-08-07), verificado con 10 requests concurrentes reales:** se intenta la escritura directo y se atrapa el error esperado del "perdedor" de la carrera (`P2002` en `create` = ya lo creó otro request; `P2025` en `delete` = ya lo borró otro request) — en ambos casos el estado final que la persona quería ya se logró, así que el perdedor solo confirma el mismo resultado en vez de fallar. El backend nuevo debe usar el mismo criterio: nunca decidir con una lectura previa lo que después se escribe en un paso aparte cuando dos requests del mismo usuario pueden llegar casi al mismo tiempo.

---

## 5. Alertas y notificaciones

| Endpoint | Método | Auth | Body | Respuesta |
|---|---|---|---|---|
| `/alertas` | GET | Sí | — | `{ alertas: Alerta[] }` |
| `/alertas` | POST | Sí | `{ municipio?, tipo?, operacion?, precioMax?, dosBocas, sinRiesgo }` | `{ alerta: Alerta }` |
| `/alertas?id=` | DELETE | Sí | — | `{ ok: true }` — solo si `id` pertenece al usuario en sesión |
| `/notificaciones` | GET | Sí | — | `{ notificaciones: Notificacion[], noLeidas: number }` — últimas 30 |
| `/notificaciones` | PATCH | Sí | `{ id }` **o** `{ all: true }` | `{ ok: true }` — marca una o todas como `leida` |

**Matching de alertas** (hoy en `src/lib/alertaMatching.ts`, se dispara desde `POST /propiedades` — ver §3, punto 10 de las validaciones): comparar la propiedad recién creada contra todas las `Alerta` guardadas por `municipio + tipo + operacion + precioMax + dosBocas`. Por cada coincidencia: crear una `Notificacion` (`tipo: 'alerta_match'`) **y** mandar un correo real (proveedor de email a elegir — hoy es Resend). El criterio `sinRiesgo` se compara contra `riesgoInundacion !== 'alto'`.

---

## 6. Citas y configuración de agenda

| Endpoint | Método | Auth | Body | Notas |
|---|---|---|---|---|
| `/citas?desde=&hasta=` | GET | Sí | — | Filtra por rango de `fecha` si se manda, solo las del usuario |
| `/citas` | POST | Sí | `{ propiedadId?, titulo, nombreCliente, telefonoCliente?, emailCliente?, notas?, fecha (ISO), duracionMin }` | Rate limit 30/hora por usuario. Validar que `fecha` sea una fecha real. |
| `/citas/:id` | PATCH | Sí (dueño) | Campos parciales + `estado` (`confirmada\|cancelada\|completada`) | Si se cambia `fecha`, resetear `recordatorioEnviado` a `false` para que el recordatorio vuelva a dispararse |
| `/citas/:id` | DELETE | Sí (dueño) | — | 404 si no es del usuario |
| `/configuracion-agenda` | GET | Sí | — | `{ config: ConfiguracionAgenda \| null }` |
| `/configuracion-agenda` | PUT | Sí | `{ diasLaborables?, horaInicio?, horaFin?, duracionCitaMin?, recordatorioMinAntes? }` | Upsert. Validar `horaInicio < horaFin`. Formatos: días `^[0-6](,[0-6]){0,6}$`, horas `HH:mm`. |
| `/citas/recordatorios/procesar` | POST | Secreto compartido (header `Authorization: Bearer <CRON_SECRET>`, no sesión de usuario) | — | Revisa citas confirmadas con `recordatorioEnviado=false` cuya `fecha` ya está dentro de la ventana `recordatorioMinAntes` configurada, manda correo (al profesional y al cliente si dejó email) y marca `recordatorioEnviado=true`. **Necesita que algo externo lo llame cada 1-5 minutos** (cron real — Vercel Cron, GitHub Actions `schedule`, cron-job.org) — no hay proceso en segundo plano en un backend típico sin esto. |

---

## 7. Perfil de inmobiliaria

| Endpoint | Método | Auth | Body | Notas |
|---|---|---|---|---|
| `/perfil-inmobiliaria` | GET | Sí | — | `{ perfil: PerfilInmobiliaria \| null }` |
| `/perfil-inmobiliaria` | PUT | Sí | `{ nombreEmpresa?, logoDataUrl? }` | Upsert. `logoDataUrl` máx. 400,000 caracteres, debe matchear `^data:image\/(png|jpeg|jpg|webp);base64,` |

---

## 8. IA (proxy a OpenRouter/Gemini)

El backend nuevo necesita sus propias credenciales de OpenRouter/Gemini y replicar esta lógica — no es un simple passthrough, cada endpoint tiene su propia validación y rate limit.

| Endpoint | Método | Auth | Body | Respuesta | Rate limit |
|---|---|---|---|---|---|
| `/ia/analizar-fraude` | POST | Opcional (registra intento sospechoso contra la cuenta si hay sesión) | `{ titulo, descripcion, precio, municipio, tipo, operacion }` | resultado de análisis de fraude (riesgo, señales, bloqueado) | 20/10min por IP + backstop global 200/10min |
| `/ia/analizar-imagen` | POST | No | `{ imagen: data URI, máx 2MB }` | resultado de análisis de imagen | 30/10min por IP + backstop global **18/24h** (Gemini gratis da solo 20/día compartidas) |
| `/ia/busqueda-inteligente` | POST | Opcional | `{ query: string, máx 300 chars }` | filtros de búsqueda interpretados | 30/10min por IP + backstop global **900**/10min (subido de 300, ver nota de escala abajo) — **ver nota de resiliencia abajo: el límite ya NO produce una respuesta vacía** |
| `/ia/generar-anuncio` | POST | Opcional | `{ tipo, operacion, colonia, municipio, metros, precio, recamaras?, banos?, amenidades? }` | `{ descripcion: string }` | 20/10min por IP + backstop global 150/10min |
| `/ia/resumen-reporte` | POST | **Sí, obligatorio** | `{ totalPropiedades, totalVistas, totalContactos, totalFavoritos, porEstado, propiedades[] }` | `{ resumen: string \| null }` | 15/10min por IP + backstop global 100/10min |

**Por qué existe un "backstop global" además del límite por IP:** confirmado con pruebas reales que `X-Forwarded-For` no es confiable — cualquiera puede mandar un valor distinto en cada request y evadir el límite por IP por completo. El backstop es una cuota compartida entre TODOS los usuarios de esa ruta (sin distinguir IP) que acota el peor caso — protección burda pero necesaria mientras no haya un proxy de confianza que sobrescriba esa cabecera.

**Registro de intentos de manipulación (moderación del buscador):** cuando hay sesión y el input contiene un patrón de manipulación conocido (ej. intentos de "ignora las instrucciones anteriores"), se debe registrar contra la cuenta — a los 3 intentos, bloquear la cuenta (`User.bloqueado = true`). Esto hoy vive en `src/lib/moderacionBusqueda.ts` del lado de Next.js; el backend nuevo necesita su propia tabla equivalente a `IntentoSospechoso` (`id, userId, consulta, marcador, createdAt`).

> ⚠️ **Resiliencia de `/ia/busqueda-inteligente` (2026-08-07) — un "buscador inteligente" que se apaga en cuanto algo falla no cumple su propósito.** Existe una heurística determinística completa sin IA (`busquedaInteligenteHeuristica` en `src/lib/ai.ts` — regex + coincidencia de texto contra los catálogos de municipios/colonias/landmarks/categorías, capaz de extraer tipo, operación, precio, recámaras, colonia y landmark) que YA se usaba como respaldo dentro de la llamada a OpenRouter (sin API key, intento de inyección detectado, o la llamada al modelo falla). El hueco real estaba en la ruta: un rate-limit alcanzado o cualquier error inesperado — no solo uno de OpenRouter — hacía que el handler completo devolviera `{}`/error, sin pasar por esa heurística ya construida. **Corregido:** la ruta ahora usa la heurística como último recurso en ambos casos, no solo dentro del intento de llamar a OpenRouter — la única respuesta realmente vacía es cuando ni siquiera hay un `query` válido que interpretar (400, body malformado). El límite de tasa protege el presupuesto de OpenRouter (la llamada real cuesta dinero); la heurística no llama a ningún servicio externo, así que no hay ninguna razón para negársela a alguien rate-limiteado — verificado en vivo con 32 requests seguidas pasando el límite de 30/10min, las últimas 2 (ya rate-limiteadas) devolviendo el mismo resultado correcto que las primeras 30 (con IA). **El backend nuevo debe replicar este mismo criterio:** cualquier camino que llegue a "no se pudo usar el modelo" — falta de API key, límite de tasa, timeout, error de red, cualquier excepción no prevista — debe caer a la heurística determinística antes de rendirse a una respuesta vacía. Un simple *"si algo falla, retorna `{}`"* deja al buscador dependiendo por completo de que un servicio de terceros nunca falle, lo cual no es una expectativa razonable para producción.

> ⚠️ **Escala y horas pico (2026-08-08) — el cuello de botella real es OpenRouter, no este servidor.** Con la plataforma esperando miles de búsquedas/día y horas pico, se corrió una prueba de carga concurrente real (40 solicitudes simultáneas, no secuenciales) contra `/ia/busqueda-inteligente`: cero errores/caídas (el diseño "fail open" de arriba aguanta bien), pero la latencia de OpenRouter bajo concurrencia **se triplicó** frente a llamadas aisladas (promedio 2.5s → 5.8s, máximo tocando el timeout). Dos cambios en respuesta:
> 1. **`TIMEOUT_BUSQUEDA_MS` subido de 7s a 9s** (`src/lib/ai.ts`) — medido en vivo con 8 llamadas aisladas y espaciadas (no en ráfaga): 2 de 8 (25%) pasaron de 5s, una tocando el límite exacto de 7s. La cola larga de OpenRouter es real, no un artefacto de las pruebas. `TIMEOUT_CLIENTE_MS` en `interpretarBusqueda.ts` (frontend) subido en cascada de 21s a 25s para mantener el mismo margen sobre el nuevo peor caso del servidor (9s + hasta 3 llamadas de resolución de colonia/landmark de 4.5s c/u).
> 2. **Caché en memoria de interpretaciones** (`src/lib/busquedaCache.ts`, nuevo) — clave: texto normalizado (sin acentos, minúsculas, espacios colapsados), TTL 1 hora, solo cachea resultados que sí vinieron de una llamada real y exitosa a OpenRouter (nunca heurística ni intentos de inyección — esos siguen evaluándose cada vez). Reduce llamadas reales a OpenRouter para búsquedas repetidas/casi-idénticas ("casa en renta", "depa en Cárdenas"), que a esta escala son comunes — verificado en vivo: primera llamada 2.9s, segunda idéntica 17ms, variante sin acentos/mayúsculas distinta también 23ms (cache hit). **El backend nuevo debe replicar esto con una caché compartida real** (Redis/Upstash, no en memoria de un solo proceso — mismo motivo que ya aplica al rate limiter, ver `src/lib/rateLimit.ts`) para que el beneficio se comparta entre instancias en un despliegue multi-proceso.
> 3. **Backstop global subido de 300 a 900/10min** — el tráfico esperado tiene dos formas: concentrado geográficamente en Centro (mismas colonias/landmarks mencionados una y otra vez) y, si la plataforma se viraliza, un pico nacional de búsquedas genéricas ("casas en Tabasco"). Ambas formas tienen alta afinidad de caché (búsquedas repetidas/parecidas), así que más solicitudes no se traduce 1:1 en más llamadas reales a OpenRouter — la razón por la que 900 es defendible sin ser temerario. Sigue siendo una cota razonada, no medida contra tráfico real (no hay cifras de producción todavía).
> 4. **Observabilidad nueva para calibrar esto con datos reales** — `src/lib/busquedaStats.ts` (contadores en memoria: cache hits, llamadas reales exitosas a OpenRouter, veces que se cayó a heurística, **y búsquedas por hora del día en zona horaria de Tabasco — America/Mexico_City, nunca la del servidor**) expuesto en `GET /api/admin/metricas` (`busquedaIA`, incluye `porHora`: array de 24 posiciones, y `horaPico`: la hora con más búsquedas) y visible en `/admin` (tarjeta "Buscador con IA", con gráfico de barras por hora). Es a propósito el ÚNICO dato de "uso de la plataforma" que se muestra ahí — las cifras de "vistas" que existen en otros lados (`analiticaDemo.ts`) son de muestra, no tráfico real (`Property` no es una tabla real todavía), y mezclarlas habría presentado un número inventado como si fuera medido. El backend nuevo debe replicar el contrato de estos contadores + `porHora`/`horaPico` — idealmente respaldado por algo persistente/compartido (no en memoria de un proceso), para que sobreviva un reinicio y sea comparable entre instancias.
> 5. **Bug real encontrado y corregido mientras se construía lo anterior — relevante para TODO módulo con estado a nivel de módulo, no solo este:** en `next dev`, `src/lib/busquedaStats.ts` mostraba `{}` al consultarlo desde `/api/admin/metricas` inmediatamente después de una búsqueda real hecha contra `/ia/busqueda-inteligente` — confirmado con una prueba en vivo (dos rutas API, no una página vs. una API). La causa: sin `globalThis` (mismo patrón que ya usa `src/lib/db.ts` para el cliente de Prisma), Next.js/Turbopack puede re-evaluar un módulo por separado según qué ruta lo importó, dando una instancia de estado distinta en vez de un singleton real dentro del mismo proceso. Corregido en `busquedaStats.ts`, `busquedaCache.ts` y **`src/lib/rateLimit.ts`** (el más importante de los tres — lo usan casi todas las rutas de la plataforma; sin este fix, es plausible que el rate limiting tampoco se compartiera de forma confiable entre rutas en dev). **El backend nuevo, si usa algún framework con re-evaluación de módulos en desarrollo (o bundling por ruta en producción), debe verificar explícitamente que su propio mecanismo de estado compartido en memoria sea un singleton real** — este bug es fácil de no notar porque cada ruta individualmente "funciona" (el estado se acumula correctamente dentro de sí misma), solo se nota al comparar entre rutas distintas, que es exactamente lo que hace un panel de métricas.

---

## 9. Colonias descubiertas

| Endpoint | Método | Auth | Respuesta |
|---|---|---|---|
| `/colonias/descubiertas` | GET | No | Array de `ColoniaDescubierta` — `Cache-Control: public, max-age=300, stale-while-revalidate=3600` |

No hay un endpoint `POST` propio — nuevas filas se crean como efecto secundario de `/ia/busqueda-inteligente` cuando alguien menciona una colonia que no está en el catálogo estático del frontend: se geocodifica contra Nominatim (OpenStreetMap) con un filtro de dos niveles (solo `place/neighbourhood` o `leisure/park`, validando `state === 'Tabasco'` y el municipio contra la lista de §1) — si pasa el filtro, se guarda; si no, se descarta en silencio. Rate-limitado a ~1 request/segundo contra Nominatim (política de uso de OSM).

### 9.1 Colonias más solicitadas — NUEVO, no existe hoy

`/zonas` muestra tarjetas de colonias con un ícono de llama en la que tiene más actividad — hoy ese ranking (`getColoniasRankedByPropiedades`, `src/lib/api.ts`) es por **oferta** (cuántas propiedades activas tiene la colonia), que es real y dinámico, pero **no** es lo mismo que "más solicitada/con más movimiento del momento" (demanda). Verificado que ese segundo dato no existe en ningún lado de la plataforma: cero modelos de eventos en `prisma/schema.prisma`, cero integración de analytics en `layout.tsx`. A propósito no se fabricó del lado del frontend — mostrarle a un visitante real un ícono de "tendencia" con un número inventado repetiría el mismo problema que ya hizo que el ranking público de inmobiliarias se dejara en pausa (ver `docs/plan-inmobiliarias.md`): nunca presentarle a un usuario real un dato fabricado como si fuera real.

**Lo que hace falta construir:**
1. Un registro de eventos (nuevo modelo, ej. `SolicitudColonia`: `id, coloniaKey, municipio, tipo ('busqueda' | 'vista_propiedad' | 'contacto'), createdAt`) — se escribe en 3 momentos que ya existen en el código y solo hay que instrumentar:
   - Cuando `/ia/busqueda-inteligente` (o su heurística de respaldo) resuelve una colonia desde la consulta del usuario (mismo punto donde hoy se crea `ColoniaDescubierta` si la colonia es nueva — ver 9 arriba).
   - Cuando se sirve `GET /propiedades/:id` con éxito (colonia = `property.colonia`).
   - Cuando se sirve `GET /propiedades/:id/contacto` con éxito (§10) — la señal de intención más fuerte de las tres.
2. Un endpoint de agregación, ej. `GET /colonias/tendencia`, que cuenta esos eventos agrupados por colonia dentro de una ventana de tiempo reciente y devuelve el ranking completo (no solo el top 9 — el frontend decide cuántas tarjetas mostrar, ver abajo) — `Cache-Control` corto (unos minutos) porque el dato cambia seguido.
3. **Decisión abierta, no la asumas:** cuánto dura "del momento" (¿últimas 24h? ¿7 días?) — es una decisión de producto, coordinar con el equipo antes de implementar la ventana.

**Los dos requisitos exactos, para que no quede ambiguo:**
- **Badge dinámico** — el ícono de llama es solo para la(s) colonia(s) que llegan o superan el TOP de la lista de más solicitadas (empate incluido) — no es "las 9 de la tarjeta", es específicamente la primera posición del ranking de demanda.
- **Tarjetas dinámicas de "más solicitadas"** — las tarjetas grandes de `/zonas` (máximo 9, `MAX_CARDS` en `zonas/page.tsx`) se ordenan por este mismo ranking de demanda, no por cantidad de propiedades. El resto de colonias con actividad pero fuera del top 9 se siguen viendo como chip debajo (mismo patrón que hoy).

**Cambio en el frontend cuando este endpoint exista:** en `src/app/zonas/page.tsx`, reemplazar `coloniasRanked` (hoy `getColoniasRankedByPropiedades()`, por oferta) por el resultado de `GET /colonias/tendencia` (por demanda) para decidir tanto el orden de las tarjetas como a cuál le toca la llama — el resto del componente (slice a 9, chips, tooltip) ya está listo, es un cambio de una sola fuente de datos. El tooltip vuelve a decir "más solicitada ahora mismo" en cuanto el dato sea real (hoy dice honestamente "más propiedades publicadas").

---

## 10. Contacto y reportes sobre una propiedad

| Endpoint | Método | Auth | Body | Notas |
|---|---|---|---|---|
| `/propiedades/:id/contacto` | GET | Sí | — | `{ tel, email, whatsapp }` del agente — revelado instantáneo con sesión, cero acceso anónimo. Rate limit 30/10min **por IP Y por `userId` a la vez, los dos límites deben pasar** — confirmado con una prueba real que el límite solo por IP (`X-Forwarded-For`, falsificable por el cliente sin proxy de confianza en frente) no evitaba que una sola cuenta autenticada scrapeara el contacto de todas las propiedades sin fricción (60/60 solicitudes exitosas falsificando la IP en cada una). El límite por `userId` (sale de la sesión firmada, no falsificable desde el cliente) es el que de verdad detiene esto — no omitirlo pensando que el de IP ya alcanza. |
| `/propiedades/:id/contactar` | POST | No (público) | `{ nombre, telefono, email, mensaje }` | Manda un correo real al `emailCuenta`/`agenteEmail` del dueño con el mensaje. **No hay tabla `Contacto`** — el correo ES el único registro; si falla el envío, responde error real (502), no un éxito falso. Rate limit 10/10min por IP. |
| `/propiedades/reportar` | POST | Opcional | `{ propiedadId, motivo (info_falsa\|precio_sospechoso\|contenido_inapropiado\|posible_fraude\|otro), comentario? }` | **Ya persiste de verdad** en `ReporteAnuncio` (ver §16, panel admin en `/admin/reportes`) — dejó de ser un stub 2026-08-06. Pendiente para el backend nuevo: si una propiedad acumula 3+ reportes de "posible_fraude"/"info_falsa", marcarla `requiereModeracion=true` automáticamente (esto todavía no está implementado ni en Next.js). Rate limit 5/hora por IP (evita que alguien reporte en masa el anuncio de un competidor). |

---

## 11. Directorio de servicios — ⏸️ EN PAUSA

**No priorizar — decisión explícita del usuario (2026-08-06): construir esto compite por tiempo con cerrar `Property`, que es lo que hoy bloquea el resto.** Se documenta el contrato completo igual, para cuando se retome — no hace falta implementarlo ahora.

| Endpoint | Método | Auth | Notas |
|---|---|---|---|
| `/servicios?categoria=&municipio=` | GET | No | Lista pública, solo `activo=true`, nunca expone teléfono/whatsapp/email |
| `/servicios/:id` | GET | No | Ficha pública, mismos campos que la lista |
| `/servicios` | POST | Sí | Publicar — rate limit 10/10min por IP |
| `/servicios/:id` | PATCH | Sí (dueño) | Editar contenido + toggle `activo` (pausar/reactivar) |
| `/servicios/:id` | DELETE | Sí (dueño) | Eliminar de verdad (no soft-delete, a diferencia de Property) |
| `/servicios/mios` | GET | Sí | Todos los del usuario, incluye pausados |
| `/servicios/:id/contacto` | GET | Sí | `{ telefono, whatsapp, email }` — mismo patrón que propiedades |
| `/servicios/:id/trabajos` | GET | No (o dueño si `activo=false`) | Portafolio — si el servicio está pausado, solo el dueño lo ve |
| `/servicios/:id/trabajos` | POST | Sí (dueño) | Agregar entrada al portafolio — tope de 24 entradas, rate limit 20/10min por IP |
| `/servicios/:id/trabajos/:trabajoId` | DELETE | Sí (dueño) | Eliminar una entrada del portafolio |

Categorías válidas: `plomeria, pintura, mudanza, remodelacion, albanileria, electricidad, jardineria, limpieza, carpinteria, cerrajeria, fumigacion, aire_acondicionado`.

> ⚠️ **Mismo patrón a replicar con cuidado que en Favoritos (§4) — el tope de 24 debe verificarse y escribirse en una sola operación atómica.** La primera versión de `POST /servicios/:id/trabajos` contaba las entradas existentes y creaba la nueva en dos pasos separados — varias subidas concurrentes podían leer el mismo conteo antes de que cualquiera escribiera y pasarse del tope. **Fix aplicado (2026-08-07):** el conteo y la creación ahora corren dentro de la misma transacción (verificado con 10 subidas concurrentes reales — el conteo final nunca superó 24). El backend nuevo debe envolver el chequeo de un límite y la escritura que lo respeta en una sola transacción/operación atómica, nunca en dos pasos separados.

---

## 12. Stats del dashboard

`GET /me/stats` (auth requerida) hoy devuelve `{ vistas, contactos }` — **pero son un mock determinístico** calculado con un hash del `userId`, no cuentan nada real. Para que sea real hace falta una tabla de eventos (`vista`, `contacto`, `favorito` con `propiedadId` + fecha) que hoy no existe en ningún lado — no es parte del MVP, pero si se construye, este es el endpoint a reemplazar.

---

## 13. Cambios necesarios en el frontend Next.js

Con el backend en un proyecto separado, esto deja de ser "frontend + backend en un repo" y pasa a ser dos servicios:

1. **Borrar `src/app/api/**`** (los 33 archivos `route.ts` listados arriba) una vez el backend nuevo cubra el mismo contrato — no antes, para no romper la app a mitad de migración.
2. **Nueva variable de entorno** `NEXT_PUBLIC_API_URL` (o similar) apuntando al backend nuevo.
3. **Actualizar cada `fetch('/api/...')`** en el código del frontend para apuntar a `${NEXT_PUBLIC_API_URL}/...` en vez de una ruta relativa. Son decenas de call-sites — buscar con `grep -rn "fetch('/api" src/` para ubicarlos todos.
4. **`src/proxy.ts` (el guard de rutas protegidas) necesita rediseñarse** — hoy verifica el JWT localmente con `jwtVerify` porque comparte `JWT_SECRET` con las API routes del mismo proceso. Sin ese secreto compartido (ver Decisiones Abiertas, punto 1), ya no puede validar el token él solo — las opciones son:
   - Llamar al backend nuevo (`GET /auth/me` equivalente) desde el propio `proxy.ts` para verificar sesión en cada navegación a una ruta protegida (agrega latencia de red a cada navegación).
   - Mover todo el gate de rutas protegidas al cliente (perder la protección server-side que hoy existe — regresión de seguridad, ver hallazgo M1 en §14).
   - (Si se elige la opción de secreto compartido después de todo, `proxy.ts` no cambia.)
5. **`AuthContext.tsx`** — sigue funcionando igual en términos de forma de datos (`{ id, email, nombre, rol }`) si el backend nuevo mantiene el mismo payload de JWT; si cambia el mecanismo de entrega del token (cookie → Bearer), este archivo sí necesita cambios para guardar/enviar el token manualmente.
6. **CORS — no todas las llamadas lo necesitan por igual.** Distinguir dos tipos de consumo, porque hoy casi todo es lo primero y con el backend nuevo una parte importante pasa a ser lo segundo:
   - **Server-to-server** (Server Components de Next.js, ej. `/propiedades` renderizando la lista, `generateMetadata`) — el propio servidor de Next.js le hace `fetch` al backend nuevo. No es un request de navegador, no necesita CORS, pero sí necesita que el backend nuevo sea alcanzable desde donde corra Next.js.
   - **Client-side** (casi todas las mutaciones: publicar, favoritos, editar, eliminar, contacto, y cualquier lectura que hoy dispara un componente `'use client'`) — corre en el navegador del usuario, SÍ necesita CORS explícito (origen exacto, no `*`) y es donde el mecanismo de token cross-origin (Decisión abierta #1) importa de verdad.
7. **SSG de fichas de propiedad y zonas se rompe con datos dinámicos.** `propiedades/[id]/page.tsx` y `zonas/[slug]/page.tsx` usan `generateStaticParams` — genera las páginas **en build time**. Con `Property` real (propiedades que se crean después del último deploy), una propiedad publicada hoy nunca tendría ficha hasta el próximo build+deploy completo. Hay que cambiar a ISR (`export const revalidate = <segundos>`) o renderizado dinámico (`export const dynamic = 'force-dynamic'`) en ambas páginas, y quitar o ajustar `generateStaticParams` en consecuencia.
8. **Estrategia de caché explícita en cada `fetch()` nuevo.** Next.js cachea `fetch()` por defecto (comportamiento propio del App Router, no configurable "para todos a la vez"). Sin `cache: 'no-store'` o `next: { revalidate: N }` explícito en cada llamada al backend nuevo, una propiedad recién publicada/editada podría no reflejarse para otros usuarios hasta que expire un caché que nadie decidió a propósito — revisar caso por caso cuál necesita datos siempre frescos (búsqueda, ficha de detalle) vs. cuál puede tolerar unos segundos/minutos de caché (stats de zonas).
9. **El `.env.local` de Next.js se reduce bastante** — `JWT_SECRET`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, credenciales de OAuth (`GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`) dejan de hacerle falta a Next.js por completo — se mueven al `.env` del backend nuevo. Next.js se queda solo con `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_BASE_URL`.
10. **`src/app/robots.ts`** bloquea `/api/*` hoy — esa ruta deja de existir en el dominio de Next.js, ajustar la regla (ya no hace falta, o apunta a otra cosa si el backend nuevo queda en un subdominio distinto).
11. **Todo lo que hoy simula backend guardando en `localStorage` del navegador se borra por completo** — no se migra, no se conserva como fallback, se reemplaza directo por llamadas reales. Cada archivo ya tiene su propio comentario `⚠️ BACKEND` explicándolo; esta es la lista completa en un solo lugar:
    - `src/lib/propiedadesLocales.ts` — propiedades creadas/editadas/eliminadas/destacadas desde `/publicar` o `/dashboard/propiedades/importar`. Se reemplaza por `POST`/`PATCH`/`DELETE /propiedades` reales (§3).
    - `src/lib/estadoOverrides.ts` — pausar/archivar/reactivar una propiedad. Se reemplaza por el campo `estado` real de `Property` (§3), vía `PATCH /propiedades/:id`.
    - `src/lib/leadsDemo.ts` — en qué etapa del pipeline está cada lead del CRM ligero (`/dashboard/leads`). No hay modelo de leads real todavía en ningún lado de este documento — si el CRM se construye de verdad, necesita su propio modelo nuevo (`Lead` o similar), fuera de alcance del MVP descrito aquí (ver §15).
    - `src/app/dashboard/leads/page.tsx` (columnas ocultas del tablero) — esta sí podría quedarse como preferencia de UI en el navegador aun con backend real (no es un dato que otra persona necesite ver), a discreción de quien construya esa pantalla.
    - `src/lib/equipoDemo.ts` — miembros de equipo simulados en `/dashboard/equipo`; hoy "invitar" no manda nada real. Necesita un modelo de verdad (cuentas vinculadas a una `PerfilInmobiliaria`) si esta función se construye — no está especificado en este documento.
    - `src/lib/verificacionDemo.ts` — estado de solicitud de verificación de agencia. Necesita un campo real (ej. `PerfilInmobiliaria.verificado`/`verificacionEstado`) y, del lado humano, un proceso real de revisión de documentos — no solo un campo en base de datos.
    - **Estas SÍ son razonables que se queden en `localStorage` aunque exista backend real** — son preferencias del navegador, no datos de la plataforma, mismo patrón que usa cualquier sitio con backend real (Amazon, Airbnb, etc.): `src/context/CompareContext.tsx` (propiedades a comparar), `src/lib/recentlyViewed.ts` (vistas recientemente), `src/lib/recentSearches.ts` (búsquedas recientes).

---

## 14. Seguridad e infraestructura

Transversal, aplica igual con backend separado o no.

**Ya resuelto (no reintroducir la regresión al migrar):**
- Contraseña mínima 10 caracteres, bcrypt costo 12.
- Rate limiting en memoria en login/registro/reportar/IA/contacto (interino — ver siguiente punto).
- Cabeceras de seguridad (CSP, X-Frame-Options, etc.) — hoy en `next.config.ts` de Next.js; si el backend nuevo sirve algo directamente (no solo JSON), replicar.
- Mitigación de account pre-hijacking en OAuth (§2).
- Detector de intento de inyección de prompt en búsqueda con IA (no-LLM, heurística determinística) + fusión conservadora con el resultado real del modelo.

**Pendiente, para el backend nuevo:**
- **Rate limiting distribuido** — el `Map` en memoria de hoy no sirve si el backend nuevo corre en múltiples instancias. Usar Redis (Upstash Ratelimit) o una tabla propia.
- **Verificación de correo electrónico** — no existe. Cierra el hallazgo de seguridad más grave pendiente (permite que el account pre-hijacking mitigado en §2 se resuelva del todo: una vez hay `emailVerificado`, sí se puede fusionar cuentas OAuth con cuentas de contraseña existentes, pero solo si el email ya estaba verificado).
- **Revocación de sesiones real** — hoy solo existe el chequeo de `bloqueado`. Para invalidar un token robado sin bloquear la cuenta completa, o para "cerrar sesión en todos los dispositivos", hace falta una tabla `SesionRevocada { jti, expiresAt }` (JWT ID por sesión) o tokens de vida corta + refresh rotado.
- **Moderación de reportes** — ver §10, hoy es un stub.
- **Cuotas de IA por usuario** — hoy solo hay rate limit por IP + backstop global (control de tráfico, no de gasto). Con OpenRouter de pago, esto es control de costo real, no solo de abuso.
- **Migración a PostgreSQL** — sigue en SQLite.

---

## 15. V2 — fuera de alcance del MVP

No construir como parte de este trabajo — el foco es replicar §1-§10, 12-14 (todo excepto el directorio de servicios, que se documentó en §11 pero está en pausa).

- **Cobro real / suscripciones** — hoy `POST /auth/activar-inmobiliaria` (§2) solo demuestra el resultado final (cambiar `rol`), sin pasarela de pago real. Para cobrar de verdad: Stripe/Conekta/Mercado Pago, modelo `Suscripcion`, webhook de confirmación, cron de vencimiento, página de facturación.
- **Panel profesional avanzado para inmobiliarias** — CRM de leads, verificación de agencia, anuncios destacados con ordenamiento real, cuentas multi-agente, carga masiva CSV, analítica con tabla de eventos real. Todo esto ya tiene UI construida en el frontend (sobre datos simulados) — el trabajo pendiente es solo de backend, y depende de que `Property` (§3) exista primero.
---

## 16. Panel de administración — NUEVO, ya existe hoy en Next.js

**A diferencia del resto de este documento (contrato a replicar), este módulo se construyó 2026-08-06 directo dentro de Next.js, con datos 100% reales — no hay nada que migrar desde una simulación.** Motivo del cambio: hasta ahora el único bloqueo de cuenta era el automático de moderación del buscador (§8, `IntentoSospechoso`, 3 strikes), sin ninguna forma de que un humano revisara un caso ni ningún panel para gestionar nada de la plataforma. El pedido explícito fue que una detección automática pueda equivocarse con un usuario honesto, y que exista una salida real para ese caso — no un trámite burocrático, la prioridad es que nadie honesto se quede mal etiquetado sin recurso.

**Fuera de alcance a propósito:** moderar/editar publicaciones de propiedad — `Property` no es una tabla real todavía (§3), no hay ningún registro del lado del servidor al que un admin pueda entrar. Se documenta como bloqueado-hasta-que-`Property`-sea-real, igual criterio que el resto de este documento con datos que no se fabrican.

**Modelo de datos nuevo** (`prisma/schema.prisma`):
- **`User.esAdmin`** (bool, default false) — campo aparte de `rol` (que significa "buscador/agente", una cosa distinta de "tiene permisos de administración"), mismo patrón que `bloqueado` ya es independiente de `rol`. **Se lee fresco de la base en cada request** (nunca va en el payload del JWT) — así revocar el permiso de un admin corta el acceso de inmediato, sin esperar a que expire su sesión ni a que vuelva a iniciar sesión. Primera cuenta admin se crea con un script fuera de banda (`scripts/hacer-admin.ts <email>`), no hay ningún toggle público.
- **`User.bloqueoResueltoEn`** (DateTime?) — cuándo se resolvió el bloqueo más reciente (manual o por apelación aprobada). El conteo de "3 strikes" en `registrarIntentoSospechoso()` (§8) cuenta solo `IntentoSospechoso` con `createdAt` posterior a este campo, nunca el historial completo — sin esto, una cuenta reactivada con 3+ intentos históricos se re-bloqueaba con un solo intento nuevo (el 4to acumulado ≥ 3), no con 3 nuevos de verdad. El historial completo se conserva igual (nunca se borra, sigue sirviendo de auditoría).
- **`SolicitudRevision`** — `id, userId, motivo, estado ('pendiente'|'aprobada'|'rechazada', default pendiente), respuestaAdmin?, resueltoPorId?, createdAt, resueltoEn?`.
- **`ReporteAnuncio`** — antes era un stub (§10), ahora persiste de verdad: `id, propiedadId, userId?, motivo, comentario?, estado ('pendiente'|'revisado'|'descartado'), createdAt`.
- **`AccionAdmin`** (auditoría) — `id, adminId, accion, objetivoId, detalle?, createdAt`. Sin esto, este log tendría el mismo problema de "solo escritura, nadie lo lee" que ya tenía `IntentoSospechoso` antes de este panel.

**El flujo de apelación — por qué el endpoint de solicitud es público:** `getSession()` invalida en tiempo real una sesión con `bloqueado=true`, y login/OAuth la rechazan de entrada — una cuenta bloqueada no puede autenticarse, así que no puede llegar a ningún endpoint que exija sesión.

**Frontend público:** `src/app/cuenta/solicitar-revision/page.tsx` — formulario real (email + motivo), enlazado desde el mensaje de error de login (`src/app/auth/login/page.tsx`) cuando el login falla con 403 o el callback de OAuth vuelve con `?error=bloqueado`. **Este endpoint existió una sesión entera sin ninguna página que lo llamara** — el mensaje de error solo decía "contáctanos" sin ningún link; se corrigió el mismo día que se detectó en auditoría.

| Endpoint | Método | Auth | Body | Notas |
|---|---|---|---|---|
| `/cuenta/solicitar-revision` | POST | **No (público)** | `{ email, motivo }` | Identificado por email (normalizado a minúsculas antes de buscar, igual que `registro`/`login`), no por sesión — es el único canal posible para una cuenta bloqueada. Rate limit 5/hora por IP. **Responde siempre el mismo mensaje genérico de éxito, en tiempo aproximadamente constante** (piso de 200ms — sin esto, el branch que sí escribe a la base tarda medible más que el que no, filtrando por latencia lo que el mensaje genérico busca ocultar), exista o no la cuenta, y solo persiste una fila si la cuenta está REALMENTE bloqueada (antes creaba una fila para cualquier cuenta existente). Como mucho una `SolicitudRevision` pendiente por cuenta — un reintento actualiza el motivo de la ya existente en vez de duplicar. |

**Rutas admin nuevas** (`/admin/**`, todas exigen `esAdmin: true` — 401 sin sesión, 403 si `esAdmin` es false):

| Ruta | Método | Qué hace |
|---|---|---|
| `/admin/metricas` | GET | Conteos reales sobre User, SolicitudRevision, ReporteAnuncio, IntentoSospechoso, Favorito, Alerta, Cita, ServicioProveedor, más flags de qué integraciones (Resend/OpenRouter/Gemini) tienen variable de entorno configurada. Sin ninguna métrica de propiedades — no hay tabla real que contar. **Incluye también `busquedaIA`** (nuevo, 2026-08-07 — ver §8: cache hits, llamadas reales a OpenRouter, caídas a heurística, y `porHora`/`horaPico` en zona horaria de Tabasco), consumido por la tarjeta "Buscador con IA" de `/admin`. |
| `/admin/usuarios` | GET | Lista/busca (`q` sobre email/nombre)/filtra (`bloqueados=1`)/pagina (20 por página). |
| `/admin/usuarios/:id/bloquear` | POST | `{ motivo }` (mín. 5 caracteres) — bloqueo manual, primero que existe fuera del automático de 3 strikes. Rechaza si el objetivo es uno mismo. |
| `/admin/usuarios/:id/desbloquear` | POST | Limpia `bloqueado`/`bloqueadoMotivo`/`bloqueadoEn`, marca `bloqueoResueltoEn=now()` (ver arriba). También resuelve automáticamente (a `aprobada`, con nota) cualquier `SolicitudRevision` pendiente de esa persona — sin esto quedaba huérfana, visible para siempre como "pendiente" aunque el problema ya se hubiera resuelto por esta vía. |
| `/admin/usuarios/:id/promover` | POST | `esAdmin = true`. |
| `/admin/usuarios/:id/revocar-admin` | POST | `esAdmin = false` — bloquea la operación si el objetivo es uno mismo y es el último admin restante. **El conteo y la escritura corren dentro de la misma transacción de Prisma** (no como dos pasos separados) — dos auto-revocaciones concurrentes cuando quedan exactamente 2 admins ya no pueden ambas leer "quedan 2" antes de que cualquiera escriba; verificado en vivo con 10 pares de solicitudes simultáneas, nunca bajó de 1 admin. |
| `/admin/intentos-sospechosos` | GET | Primer consumidor real de `IntentoSospechoso` (§8) — filtrable por `userId`. |
| `/admin/solicitudes-revision` | GET | Cola de apelaciones, filtrable por `estado`. `take: 200` (backstop, sin paginación completa todavía). |
| `/admin/solicitudes-revision/:id/resolver` | POST | `{ estado: 'aprobada'\|'rechazada', respuestaAdmin? }`. La resolución es un `updateMany` atómico con `estado: 'pendiente'` en el WHERE (no un `findUnique`+`update` separados) — dos resoluciones concurrentes de la misma solicitud (doble clic, reintento de red) ya no pueden ambas pasar el chequeo antes de escribir; verificado en vivo con 8 requests simultáneas, solo 1 tuvo éxito. Si `aprobada`: además actualiza `User.bloqueado=false` + `bloqueoResueltoEn=now()` y crea una `Notificacion`. Registra en `AccionAdmin`. **En ambos casos manda un correo real** (no solo la `Notificacion` in-app) — si queda rechazada, la cuenta sigue bloqueada y jamás podría iniciar sesión para ver una notificación in-app; el correo es el único canal que de verdad le llega. |
| `/admin/reportes` | GET | Cola de `ReporteAnuncio`, filtrable por `estado`. `take: 200`. |
| `/admin/reportes/:id/resolver` | POST | `{ estado: 'revisado'\|'descartado' }`. Mismo `updateMany` atómico con `estado: 'pendiente'` en el WHERE que el resolver de solicitudes — antes no tenía ningún guard contra resolver el mismo reporte dos veces. |
| `/admin/servicios` | GET | Lista completa de `ServicioProveedor` (activos e inactivos) con datos del dueño — a diferencia de `GET /servicios` público (§11), que solo trae activos y nunca el dueño. `take: 200`. |
| `/admin/servicios/:id` | PATCH | `{ activo }` — toggle con permiso de admin, bypassa el chequeo de dueño que tiene el `PATCH /servicios/:id` normal (§11). |
| `/admin/auditoria` | GET | Lista `AccionAdmin`, filtrable por `adminId`/`accion`, últimas 200. |
| `/admin/usuarios` búsqueda | — | `q` compara email/nombre sin distinguir acentos (normaliza NFD en el servidor sobre un candidate set acotado a 1000 filas) — SQLite pliega mayúsculas/minúsculas de `contains` solo en ASCII, así que "andres" no encontraba "Andrés" sin este paso extra. |

**Frontend** (`src/app/admin/**`, gate server-side en `admin/layout.tsx` vía `getSession()` + `redirect()` si no es admin — más estricto que el patrón client-side que usan las páginas de `/dashboard/*`, que es anterior a `proxy.ts`): página de métricas, usuarios (buscar/bloquear/desbloquear/promover/revocar), solicitudes de revisión (aprobar/rechazar con respuesta opcional), reportes (marcar revisado/descartar), intentos sospechosos (solo lectura), servicios (pausar/reactivar), auditoría (solo lectura). `src/proxy.ts` agrega `/admin` a `PROTECTED_PATHS` como defensa en profundidad (exige sesión válida en el edge; la verificación real de `esAdmin` sigue siendo server-side en cada página/ruta, porque el edge runtime no puede consultar `esAdmin` fresco de la base).

**Para el backend nuevo:** replicar el mismo contrato — `esAdmin` nunca debe viajar en el JWT por el mismo motivo que aquí (revocación inmediata), y el endpoint de apelación debe seguir siendo público e identificado por email, no por sesión.

---

## Decisiones abiertas — leer primero

Preguntas de arquitectura sin responder todavía. No inventar una respuesta por conveniencia — confirmar antes de construir, porque cambian el diseño de varios módulos de arriba:

1. **¿Cómo viaja el token entre los dos servicios?**

   **Explicación en simple, para quien no venga del lado de infraestructura:** cuando alguien inicia sesión, el servidor necesita "recordar" quién es en cada clic siguiente — para eso sirve una **cookie**: un dato que el navegador guarda y **manda solo, automáticamente**, en cada petición a ese sitio. "HttpOnly" significa que JavaScript no puede leerla (protección extra si algún día hay un bug de XSS) — el navegador la maneja solo, sin que el código del sitio tenga que hacer nada.

   Hoy, con todo en un solo proyecto Next.js, la cookie la pone y la lee el mismo servidor — cero complicación. Con **dos servidores separados** (Next.js por un lado, el backend nuevo por otro), la pregunta es: la cookie que pone el backend nuevo, ¿el navegador la va a mandar de vuelta cuando visite las páginas de Next.js? Eso depende de si los dos terminan viviendo en el **mismo dominio** (por ejemplo `api.vivevillahermosa.mx` y `vivevillahermosa.mx` — mismo dominio raíz, cookie funciona simple) o en **dominios sin relación** (ahí las cookies necesitan configuración extra, o conviene usar otro mecanismo).

   **Por qué no es urgente:** la plataforma todavía no está desplegada — no existe todavía ni el dominio de Next.js ni el del backend nuevo, así que no hay nada real que decidir hoy. Esto solo importa una vez que ambos estén corriendo en internet con URLs de verdad.

   **Default para empezar a desarrollar hoy, sin bloquear a nadie:** cookie HttpOnly, igual que ahora, funcionando en `localhost` (backend nuevo y Next.js corriendo cada uno en su puerto local) — eso no requiere ninguna configuración especial de dominio. Cuando haya un plan de hosting/dominio real, retomar esta decisión con la información concreta — se resuelve en minutos una vez se sepa dónde va a vivir cada servicio:
   - **Cookie HttpOnly cross-origin** (`SameSite=None; Secure`, o `SameSite=Lax` si el backend queda en un subdominio del mismo dominio raíz que Next.js) — el backend nuevo la setea directo, el navegador la manda sola en cada request con `credentials: 'include'`. Requiere HTTPS en producción, y el backend necesita CORS con `credentials: true` y origen exacto (no `*`). **Recomendado si el backend termina en un subdominio del mismo dominio** (ej. `api.vivevillahermosa.mx`) — evita la complejidad de cookies verdaderamente cross-domain.
   - **Bearer token** (`Authorization: Bearer <jwt>`) — el frontend lo recibe en el body de la respuesta de login, lo guarda (¿dónde? — `localStorage` es legible por XSS, memoria se pierde al refrescar) y lo manda a mano en cada `fetch`. Más portable entre dominios sin relación entre sí, pero mueve la responsabilidad de guardarlo bien al frontend. **Recomendado si el backend termina en un dominio completamente distinto** al de Next.js.
   - Esto determina directamente el diseño de `src/proxy.ts` (§13, punto 4) y de `AuthContext.tsx` — pero solo hace falta resolverlo antes de desplegar a producción, no antes de empezar a construir el módulo de auth.
2. **¿El backend nuevo usa la misma base de datos (SQLite/su sucesora) o una nueva, vacía?** Si es una nueva: las cuentas, favoritos, alertas, citas, etc. que ya existen hoy en `prisma/vivevillahermosa.db` se pierden a menos que se migren explícitamente. Si es la misma (o una copia migrada): decidir si el backend nuevo sigue usando Prisma o cambia de ORM. **Si se migran los usuarios existentes:** las contraseñas están hasheadas con `bcryptjs` costo 12 (`$2b$12$...`) — el backend nuevo debe usar una librería bcrypt compatible con ese formato de hash para que las cuentas existentes puedan seguir iniciando sesión sin tener que resetear su contraseña. Tampoco es urgente mientras no haya usuarios reales que perder.
3. **Storage de fotos** (`Property.fotos`, §3, y `PerfilInmobiliaria.logoDataUrl`/`ServicioProveedor.fotoDataUrl` si se migran) — Cloudinary, S3, u otro. No decidido, no bloquea empezar (se puede desarrollar con storage local/temporal y cambiar después).
4. **Dominio/URLs** — mismo motivo que el punto 1: no hay nada que decidir todavía porque no hay despliegue. Cuando se elija hosting, esto resuelve automáticamente el punto 1.
