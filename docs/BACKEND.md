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
9. [Colonias descubiertas](#9-colonias-descubiertas)
10. [Contacto y reportes sobre una propiedad](#10-contacto-y-reportes-sobre-una-propiedad)
11. [Directorio de servicios — ⏸️ EN PAUSA](#11-directorio-de-servicios--en-pausa)
12. [Stats del dashboard](#12-stats-del-dashboard)
13. [Cambios necesarios en el frontend Next.js](#13-cambios-necesarios-en-el-frontend-nextjs)
14. [Seguridad e infraestructura](#14-seguridad-e-infraestructura)
15. [V2 — fuera de alcance del MVP](#15-v2--fuera-de-alcance-del-mvp)

---

## 1. Modelo de datos completo

> **`prisma/schema.prisma` (en la raíz de este mismo repo) es la fuente de verdad exacta — este resumen en prosa es solo para lectura rápida.** Ahí están los tipos precisos, `@default`, `@unique`, relaciones (`@relation`, `onDelete: Cascade`) e índices compuestos (`@@index`) tal cual, sin resumir. Los modelos 1-10 de abajo (`User` hasta `ColoniaDescubierta`) son una transcripción de los primeros ~225 líneas del archivo — ya existen y funcionan hoy dentro de Next.js. El modelo 11 (`Property`) es el sketch sugerido que está comentado (`//`) al final del mismo archivo — búscalo con `grep -n "MODELO Property" prisma/schema.prisma` — es nuevo, no existe como tabla real todavía en ningún lado. El backend nuevo no tiene por qué usar Prisma ni SQLite — pero esta es la forma de datos exacta que el frontend ya espera en cada respuesta, así que hay que replicarla, no reinventarla.

**1. `User`**
`id, email (único), password (nullable — vacío si es cuenta OAuth), nombre, rol ('buscador' | 'agente'), googleId? (único), facebookId? (único), avatar?, bloqueado (bool, default false), bloqueadoMotivo?, bloqueadoEn?, createdAt, updatedAt`

**2. `Favorito`** — `id, userId, propiedadId (string libre, no FK — el catálogo de propiedades hoy es estático), createdAt`. Único por `(userId, propiedadId)`.

**3. `Alerta`** — `id, userId, municipio?, tipo?, operacion?, precioMax?, dosBocas (bool), sinRiesgo (bool), createdAt`.

**4. `Notificacion`** — `id, userId, tipo (default 'alerta_match'), titulo, mensaje, propiedadId? (nullable — null hasta que exista Property real), leida (bool), createdAt`.

**5. `PerfilInmobiliaria`** — `id, userId (único), nombreEmpresa?, logoDataUrl? (data URI base64, máx 400,000 caracteres), updatedAt`.

**6. `ConfiguracionAgenda`** — `id, userId (único), diasLaborables (string CSV, ej "1,2,3,4,5"), horaInicio ("HH:mm"), horaFin ("HH:mm"), duracionCitaMin (int), recordatorioMinAntes (int), updatedAt`.

**7. `Cita`** — `id, userId, propiedadId? (referencia libre), titulo, nombreCliente, telefonoCliente?, emailCliente?, notas?, fecha (DateTime), duracionMin (int, default 30), estado ('confirmada' | 'cancelada' | 'completada', default 'confirmada'), recordatorioEnviado (bool, default false), createdAt, updatedAt`.

**8. `ServicioProveedor`** (⏸️ en pausa, ver §11) — `id, userId, categoria, nombre, descripcion, municipio, colonia?, telefono, whatsapp?, email?, fotoDataUrl?, activo (bool, default true), createdAt, updatedAt`.

**9. `TrabajoServicio`** (⏸️ en pausa, ver §11) — `id, servicioId, imagenDataUrl, descripcion?, createdAt`.

**10. `ColoniaDescubierta`** — `id, key (único), label, municipio, lat, lng, radioKm, aliasesJson? (JSON de array de strings), fuenteTipo, verificadoEn`.

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
agenteNombre, agenteTel?, agenteEmail?, agenteWhatsapp?, requiereMensajePrimero (bool, default false),
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

---

## 2. Autenticación

**Todo este dominio se reconstruye desde cero en el backend nuevo** — hoy vive en `src/lib/auth.ts` + `src/app/api/auth/**` dentro de Next.js. El JWT actual: `jose`, algoritmo `HS256`, payload `{ userId, email, nombre, rol }`, expira en 7 días (`TTL = 60*60*24*7` segundos). El backend nuevo puede mantener esta misma forma de payload (recomendado, para no tocar `AuthContext.tsx` del lado del frontend) o cambiarla — si cambia, el frontend necesita actualizarse también.

| Endpoint actual (Next.js) | Método | Body | Respuesta | Notas de comportamiento a replicar |
|---|---|---|---|---|
| `/api/auth/registro` | POST | `{ nombre, email, password, rol? }` | `{ user: {id,email,nombre,rol} }` + cookie de sesión | `password` mínimo 10 caracteres. `bcrypt` costo **12**. Rate limit 8/hora por IP. 409 si el email ya existe. |
| `/api/auth/login` | POST | `{ email, password }` | `{ user: {...} }` + cookie | Rate limit 20/15min por IP **y** 5/15min por IP+email (frena fuerza bruta dirigida). 403 si `bloqueado`. 401 si la cuenta es OAuth-only (`password` null) — mensaje explícito "usa Google/Facebook". |
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

**Revocación en tiempo real (parcial, no general):** en cada request autenticado, además de verificar la firma/expiración del JWT, se consulta `User.bloqueado` en la base de datos — si es `true`, la sesión se trata como inválida aunque el JWT siga siendo válido y no haya expirado. Esto es lo único "en tiempo real" que existe hoy; no hay tabla de revocación general (ver §14).

---

## 3. Propiedades — NUEVO, no existe hoy

Este es el módulo que no existe en ningún lado todavía — ni en Next.js ni en ningún backend. Usa el modelo `Property` de §1.

| Endpoint | Método | Auth | Qué hace |
|---|---|---|---|
| `/propiedades` | GET | No | Lista + filtros (municipio, tipo, operación, precio min/max, colonia, riesgoInundacion, texto libre) **+ paginación** (`page`/`perPage` o `limit`/`offset` — ver nota de paginación abajo). Solo `activa=true` y `estado='activa'`. Cada propiedad trae `latPublico`/`lngPublico`, nunca `lat`/`lng` real (ver aviso de privacidad de ubicación en §1). |
| `/propiedades/:id` | GET | **Opcional** | Por id o slug. Si no hay sesión o el `userId` de la sesión no coincide con el dueño → 404 si no está activa, y la respuesta trae `latPublico`/`lngPublico` únicamente. Si el `userId` de la sesión SÍ coincide con el dueño → devolverla aunque esté pausada/vencida/vendida/rentada (así el dueño puede ver/gestionar su propia ficha pausada desde la URL pública, igual que hoy), y esta vez sí puede incluir `lat`/`lng` real. |
| `/propiedades/mias` | GET | Sí | Todas las del usuario en sesión, sin filtrar por estado (incluye pausadas/vencidas). |
| `/propiedades` | POST | Sí | Crear. Ver validaciones obligatorias abajo. Rate limit sugerido: **10 publicaciones/día por usuario**, más 5/hora por IP como backstop contra creación de cuentas desechables. |
| `/propiedades/:id` | PATCH | Sí (dueño) | Editar campos, cambiar `estado`, marcar `featured`. 403 si `userId` no coincide. **Si el body incluye cambios a `precio`, `descripcion`, `titulo` o `fotos`, repetir los pasos 1-4 de las validaciones de `POST` sobre los datos nuevos** — sin esto, alguien podría publicar algo limpio y editarlo después a una estafa sin que nada lo detecte. **Si cambia `colonia`, `lat` o `lng`, recalcular `latPublico`/`lngPublico`** (paso 7 de `POST`) — si no, un cambio de colonia deja el punto público apuntando al centroide viejo. Si el body solo trae `estado`/`featured` (pausar/reactivar/destacar), no hace falta re-validar fraude ni recalcular ubicación. Rate limit sugerido: 20/hora por usuario. |
| `/propiedades/:id` | DELETE | Sí (dueño) | Soft-delete (`activa=false`), no borrar la fila. 403 si `userId` no coincide. Rate limit sugerido: 20/hora por usuario. |
| `/propiedades/fotos` | POST | Sí | **Endpoint de subida separado, no parte del `POST /propiedades`** — recibe un archivo (`multipart/form-data`, un archivo por request, máx. 8MB de origen igual que hoy en `resizeImageToDataUrl`), lo sube a storage (Cloudinary/S3, ver §15) y devuelve `{ url }`. El frontend sube cada foto (hasta 6) por separado ANTES de armar el `POST /propiedades`, y manda el array de URLs ya subidas en `fotos`. Evita mezclar JSON + archivos binarios en un solo request y permite mostrar progreso por foto. |

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
| `/ia/busqueda-inteligente` | POST | Opcional | `{ query: string, máx 300 chars }` | filtros de búsqueda interpretados | 30/10min por IP + backstop global 300/10min |
| `/ia/generar-anuncio` | POST | Opcional | `{ tipo, operacion, colonia, municipio, metros, precio, recamaras?, banos?, amenidades? }` | `{ descripcion: string }` | 20/10min por IP + backstop global 150/10min |
| `/ia/resumen-reporte` | POST | **Sí, obligatorio** | `{ totalPropiedades, totalVistas, totalContactos, totalFavoritos, porEstado, propiedades[] }` | `{ resumen: string \| null }` | 15/10min por IP + backstop global 100/10min |

**Por qué existe un "backstop global" además del límite por IP:** confirmado con pruebas reales que `X-Forwarded-For` no es confiable — cualquiera puede mandar un valor distinto en cada request y evadir el límite por IP por completo. El backstop es una cuota compartida entre TODOS los usuarios de esa ruta (sin distinguir IP) que acota el peor caso — protección burda pero necesaria mientras no haya un proxy de confianza que sobrescriba esa cabecera.

**Registro de intentos de manipulación (moderación del buscador):** cuando hay sesión y el input contiene un patrón de manipulación conocido (ej. intentos de "ignora las instrucciones anteriores"), se debe registrar contra la cuenta — a los 3 intentos, bloquear la cuenta (`User.bloqueado = true`). Esto hoy vive en `src/lib/moderacionBusqueda.ts` del lado de Next.js; el backend nuevo necesita su propia tabla equivalente a `IntentoSospechoso` (`id, userId, consulta, marcador, createdAt`).

---

## 9. Colonias descubiertas

| Endpoint | Método | Auth | Respuesta |
|---|---|---|---|
| `/colonias/descubiertas` | GET | No | Array de `ColoniaDescubierta` — `Cache-Control: public, max-age=300, stale-while-revalidate=3600` |

No hay un endpoint `POST` propio — nuevas filas se crean como efecto secundario de `/ia/busqueda-inteligente` cuando alguien menciona una colonia que no está en el catálogo estático del frontend: se geocodifica contra Nominatim (OpenStreetMap) con un filtro de dos niveles (solo `place/neighbourhood` o `leisure/park`, validando `state === 'Tabasco'` y el municipio contra la lista de §1) — si pasa el filtro, se guarda; si no, se descarta en silencio. Rate-limitado a ~1 request/segundo contra Nominatim (política de uso de OSM).

---

## 10. Contacto y reportes sobre una propiedad

| Endpoint | Método | Auth | Body | Notas |
|---|---|---|---|---|
| `/propiedades/:id/contacto` | GET | Sí | — | `{ tel, email, whatsapp }` del agente — revelado instantáneo con sesión, cero acceso anónimo. Rate limit 30/10min por IP. |
| `/propiedades/:id/contactar` | POST | No (público) | `{ nombre, telefono, email, mensaje }` | Manda un correo real al `emailCuenta`/`agenteEmail` del dueño con el mensaje. **No hay tabla `Contacto`** — el correo ES el único registro; si falla el envío, responde error real (502), no un éxito falso. Rate limit 10/10min por IP. |
| `/propiedades/reportar` | POST | Opcional | `{ propiedadId, motivo (info_falsa\|precio_sospechoso\|contenido_inapropiado\|posible_fraude\|otro), comentario? }` | **Hoy es un stub** — solo valida y responde éxito, no persiste nada. El backend nuevo debe construir esto de verdad: guardar en una tabla `ReporteAnuncio` (`id, propiedadId, userId?, motivo, comentario?, estado, createdAt`), y si una propiedad acumula 3+ reportes de "posible_fraude"/"info_falsa", marcarla `requiereModeracion=true` automáticamente. Rate limit 5/hora por IP (evita que alguien reporte en masa el anuncio de un competidor). |

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
- **Panel admin** — no existe ningún rol `admin` ni panel de moderación manual hoy.

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
