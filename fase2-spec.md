# Fase 2 — Plataforma Funcional con Propietarios y IA
## Vive Villahermosa — Plataforma Inmobiliaria de Tabasco

> **Verificado y actualizado 2026-08-06 contra el código real.** El Módulo 1 (Publicación Real con Backend) tiene su propia guía priorizada y actualizada: **[`docs/BACKEND.md`](docs/BACKEND.md)** — es el documento a seguir para implementar, este spec queda como referencia del roadmap original y el resto de módulos (2-12) con su estado corregido. Varios módulos que este documento marcaba como pendientes ya están resueltos de verdad: OAuth completo, logout, IA (aunque con OpenRouter, no Claude — ver Módulo 3), notificaciones de alertas por email, sitemap/robots.

**Objetivo:** Convertir la plataforma de catálogo estático a marketplace real de dos lados: propietarios publican y gestionan sus propiedades desde su panel; buscadores reciben notificaciones y contactan directamente. Se integra IA para reducir fricción al publicar.

**Prerrequisito:** Fase 1 completa al 100% (incluyendo publicación con persistencia y storage) — **este es el único prerrequisito que sigue sin cumplirse**, ver `docs/BACKEND.md`.

**Audiencias nuevas en Fase 2:**
- Propietarios particulares (publican, editan, renuevan)
- Agentes independientes (múltiples propiedades, perfil verificable)
- Inmobiliarias pequeñas (primeros clientes B2B — semilla del plan Pro)

---

## Módulo 1 — Publicación Real con Backend

**Objetivo negocio:** Sin este módulo no hay marketplace. Es el corazón de la Fase 2.

**➡️ Ver `docs/BACKEND.md` para el modelo `Property` actualizado, los 6 endpoints necesarios en orden de implementación, y el criterio de aceptación.** La tabla original de este módulo se deja abajo como referencia histórica — varios de sus supuestos ya cambiaron (por ejemplo, la validación anti-fraude/moderación **ya corre de verdad en el navegador** vía OpenRouter/Gemini, solo falta repetirla server-side; no es un stub como decía este documento originalmente).

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| API `POST /api/propiedades` — crear propiedad | 🔴 CRÍTICO | ❌ No existe. `PublishForm.tsx` persiste en `localStorage`, no en BD |
| Modelo `Property` en Prisma | 🔴 CRÍTICO | ❌ No existe — sketch completo al final de `prisma/schema.prisma` |
| Upload fotos a Cloudinary/Supabase Storage | 🔴 CRÍTICO | ❌ No existe — fotos son data URI base64 |
| Límite 4 fotos por propiedad | 🔴 CRÍTICO | ✅ Ya en UI (`MAX_FOTOS=4`) |
| Estado de publicación: `activa / pausada / vencida / vendida / rentada` | 🔴 CRÍTICO | ⚠️ Existe en `localStorage` (`estadoOverrides.ts`), no como columna real |
| Propiedad visible en catálogo al publicar | 🔴 CRÍTICO | ⚠️ Visible solo en el mismo navegador desde 2026-08-06 (antes ni eso) |
| Validación anti-spam básica (rate limit, campos mínimos) | 🟡 ALTA | ⚠️ Rate limit existe para otros endpoints (`src/lib/rateLimit.ts`), falta aplicarlo a publicar real |
| Moderación: fraude/imagen/lenguaje al publicar | 🟡 ALTA | ⚠️ **Ya es real** (no un stub) vía OpenRouter/Gemini, pero la decisión de bloquear la toma el navegador — repetir server-side es lo que falta |
| Renovación automática (activa 60 días, luego notificar) | 🟠 MEDIA | ❌ No existe |

---

## Módulo 2 — Panel de Propietario

**Objetivo negocio:** Retención del lado de oferta. Un propietario que gestiona sus propiedades aquí no se va a otro portal.

**Estado real 2026-08-06: el frontend completo de este módulo ya está construido** (`/dashboard/propiedades`), funcionando como simulación honesta en `localStorage` — ver `docs/BACKEND.md`, sección V1 y V2.A. Solo falta la persistencia real (Módulo 1) para que deje de ser una simulación de un solo navegador.

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| `/dashboard/propiedades` — lista mis publicaciones | 🔴 CRÍTICO | ✅ Frontend completo (filtro por estado, stats mock por propiedad) |
| Editar propiedad publicada | 🔴 CRÍTICO | ✅ Frontend completo (`/dashboard/propiedades/[id]/editar`) — falta `PATCH /api/propiedades/[id]` real |
| Pausar / activar publicación | 🔴 CRÍTICO | ✅ Frontend completo, funciona para cualquier cuenta desde 2026-08-06 |
| Eliminar publicación | 🟡 ALTA | ✅ Frontend completo (soft-delete en `localStorage`) |
| Ver stats: vistas, contactos, favoritos por propiedad | 🟡 ALTA | ⚠️ Números fijos/mock, no hay tabla de eventos real |
| Renovar propiedad vencida | 🟡 ALTA | ❌ Botón muestra un toast "próximamente" |
| Subir/reordenar/eliminar fotos existentes | 🟡 ALTA | ⚠️ Se pueden reemplazar al editar, no hay reordenamiento |
| Preview de cómo se ve la publicación antes de activar | 🟠 MEDIA | ❌ No existe |
| Anuncios destacados | — | ✅ Frontend completo (`destacarPropiedad()`), a propósito no reordena búsqueda pública todavía |
| Carga masiva CSV | — | ✅ Frontend completo (`/dashboard/propiedades/importar`, `papaparse`) — no estaba en el spec original |

---

## Módulo 3 — IA para Descripción de Anuncios

**Objetivo negocio:** Reducir fricción al publicar. Un propietario sin experiencia redactando puede generar un texto profesional en segundos. Diferenciador vs portales tradicionales.

**✅ Implementado — pero con OpenRouter, no Claude/Anthropic como planeaba este documento originalmente.** El ejemplo de código de abajo (SDK de Anthropic) **es obsoleto, no reflejaba lo que se construyó** — se deja tachado como referencia histórica del plan original.

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| Botón "Generar con IA" en paso Descripción del form | 🔴 CRÍTICO | ✅ Completo |
| API `POST /api/ia/generar-anuncio` | 🔴 CRÍTICO | ✅ Completo — OpenRouter (`meta-llama/llama-3.3-70b-instruct`, slug de pago), no Claude |
| Input: tipo, operación, precio, m², recámaras, colonia, servicios | 🔴 CRÍTICO | ✅ Completo |
| Output: título sugerido + descripción | 🔴 CRÍTICO | ✅ Completo |
| El usuario puede editar antes de publicar | 🔴 CRÍTICO | ✅ Completo |
| Regenerar descripción | 🟡 ALTA | ⚠️ No hay límite explícito de 3 intentos, sí rate limit por IP |
| Tono adaptado a tipo de audiencia | 🟡 ALTA | ❌ No implementado (prompt genérico) |
| Detector de fraude/contenido inapropiado | 🟠 MEDIA | ✅ Completo — `analizarFraude()` real, blindado contra inyección de prompt (confirmado con pruebas: un intento de "ignora las instrucciones anteriores" ya no engaña al detector) |
| Búsqueda inteligente con IA | — | ✅ Completo — no estaba en el spec original. `busquedaInteligente()`, interpreta lenguaje natural en el buscador |
| Análisis de fotos con IA | — | ✅ Completo — no estaba en el spec original. `analizarImagenPropiedad()`, real vía Gemini |

**Implementación real** (`src/lib/ai.ts`, `src/lib/openRouterClient.ts`):
```typescript
import { openrouter, OPENROUTER_MODEL } from './openRouterClient';

export async function generarDescripcionAnuncio(datos: DatosAnuncio, userId?: string): Promise<string> {
  const completion = await openrouter.chat.completions.create({
    model: OPENROUTER_MODEL, // 'meta-llama/llama-3.3-70b-instruct' — slug de pago, el :free devolvió 404 real en pruebas
    messages: [{ role: 'user', content: buildPrompt(datos) }],
  });
  return completion.choices[0].message.content ?? '';
}
```
~~El ejemplo original con `@anthropic-ai/sdk` y `claude-sonnet-4-6` nunca se implementó así~~ — decisión tomada durante la sesión de integración: Groq primero (tier gratis agotado dos veces solo con tráfico de pruebas), luego OpenRouter (más barato que Groq de pago, sin tope diario de tokens). Ver `docs/BACKEND.md`, sección "Cuotas de uso para IA real" para la economía medida.

---

## Módulo 4 — Notificaciones de Alertas (Email)

**Objetivo negocio:** Retención pasiva. El usuario no necesita regresar — la plataforma trabaja por él. Cada email es un re-engagement gratuito.

**✅ Implementado — pero event-driven, no un job diario como planeaba este documento.**

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| Job diario: propiedades nuevas vs alertas activas | 🔴 CRÍTICO | ⚠️ No es un job diario — se dispara al momento de publicar (`POST /api/alertas/notificar`, llamado desde `PublishForm.onSubmit`). Funcionalmente cubre el mismo caso de uso, con distinta arquitectura |
| Matching: municipio + tipo + precio + riesgo | 🔴 CRÍTICO | ✅ Completo — `src/lib/alertaMatching.ts`, incluye `cercaDosoBocas` que el spec original no mencionaba (aunque hoy `PublishForm` no captura ese dato, así que ese criterio específico se ignora al comparar) |
| Email con propiedades coincidentes | 🔴 CRÍTICO | ✅ Completo vía Resend, no limitado a 5 explícitamente |
| Enlace directo a propiedad desde email | 🔴 CRÍTICO | ⚠️ `Notificacion.propiedadId` se guarda `null` hasta que exista `Property` real (Módulo 1) |
| Unsubscribe por alerta | 🟡 ALTA | ❌ No implementado — se elimina la alerta manualmente desde `/alertas` |
| Frecuencia configurable: diaria / semanal | 🟠 MEDIA | ❌ No aplica con el modelo event-driven actual |
| Template responsive mobile-first | 🟡 ALTA | ✅ Completo |
| Notificación in-app (no solo email) | — | ✅ Completo — no estaba en el spec original (`Notificacion` en Prisma, `NotificationBell` en el header) |

**Stack email real:** Resend, conectado (`RESEND_API_KEY` en `.env.local`) — coincide con lo planeado.

---

## Módulo 5 — OAuth Completo (Google + Facebook)

**Objetivo negocio:** Reducir fricción de registro.

**✅ Completo.**

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| `GET /api/auth/google` — redirect a Google | 🔴 CRÍTICO | ✅ Completo |
| `GET /api/auth/google/callback` — procesar token | 🔴 CRÍTICO | ✅ Completo |
| `GET /api/auth/facebook` + callback | 🔴 CRÍTICO | ✅ Completo |
| Vincular cuenta OAuth a cuenta email existente | 🟡 ALTA | ⚠️ A propósito NO se fusiona automáticamente (mitigación de account pre-hijacking) — devuelve `error=account_exists` y pide iniciar sesión con contraseña primero. Fusión segura pendiente de verificación de correo, ver `docs/BACKEND.md` |
| Avatar desde OAuth | 🟠 MEDIA | ✅ Completo (`User.avatar`) |

---

## Módulo 6 — ContactForm Real

**Objetivo negocio:** La conversión final. Cada contacto = lead potencial para el propietario = valor demostrable de la plataforma.

**✅ Implementado — pero sin tabla `Contacto` (el correo es el único registro), y sin endpoint `/api/contacto` genérico (es por-propiedad).**

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| Enviar mensaje al propietario | 🔴 CRÍTICO | ✅ Completo — `POST /api/propiedades/[id]/contactar`, Resend real al `emailCuenta` del propietario |
| Guardar contacto en BD (modelo `Contacto`) | 🔴 CRÍTICO | ❌ No existe — el correo enviado es el único registro, si Resend falla el mensaje se pierde de verdad (el endpoint lo reporta como error, no como éxito falso) |
| Rate limit | 🔴 CRÍTICO | ✅ Completo — 10 por IP / 10 min (`src/lib/rateLimit.ts`) |
| Notificación push/email al propietario | 🟡 ALTA | ✅ Completo (el correo ES la notificación) |
| Botón WhatsApp directo | ✅ COMPLETO | ✅ Sigue completo — revelado instantáneo con sesión iniciada, no expuesto en el HTML inicial |
| Historial de contactos en panel propietario | 🟡 ALTA | ❌ No existe — depende de la tabla `Contacto`, ver `docs/BACKEND.md`, V2.A |

---

## Módulo 7 — Logout + Auth Hardening

**Estado real 2026-08-06: la mayoría de este módulo ya está resuelto.**

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| `POST /api/auth/logout` — borrar cookie | 🔴 CRÍTICO | ✅ Completo |
| `GET /api/auth/me` — validar sesión actual | 🔴 CRÍTICO | ✅ Completo |
| Middleware de protección de rutas autenticadas | 🟡 ALTA | ✅ Completo — `src/proxy.ts` (convención de Next.js 16, reemplaza `middleware.ts`) |
| Refresh automático de JWT antes de expirar | 🟠 MEDIA | ❌ No existe — JWT stateless de 7 días, sin rotación |
| Invalidación de token en logout (blacklist/rotación) | 🟠 MEDIA | ⚠️ Parcial — `getSession()` sí verifica `User.bloqueado` en cada request (revocación real para cuentas bloqueadas por abuso), pero no hay revocación general de tokens robados/filtrados. Ver `docs/BACKEND.md`, "Revocación de sesiones" |

---

## Módulo 8 — Dashboard con Datos Reales

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| Stats del usuario (favoritos, alertas) | 🔴 CRÍTICO | ✅ Favoritos/alertas son reales (Prisma). Vistas/contactos (`GET /api/me/stats`) son un mock determinístico por `userId`, no cuentan eventos reales todavía |
| Propietario: mis propiedades, vistas, contactos | 🔴 CRÍTICO | ⚠️ "Mis propiedades" ya tiene UI completa (Módulo 2) sobre datos locales — vistas/contactos reales requieren Módulo 1 + tabla de eventos |
| Buscador: mis favoritos recientes, alertas activas | 🟡 ALTA | ✅ Completo |
| Notificaciones en UI (nueva coincidencia de alerta) | 🟠 MEDIA | ✅ Completo — `NotificationBell`, no estaba explícitamente planeado así pero cubre el caso |

---

## Módulo 9 — Migración de Datos: JSON → Base de Datos

**Objetivo:** La plataforma deja de depender de JSON estáticos. Las propiedades se gestionan en una base de datos real.

**Sigue siendo el bloqueante central — ver `docs/BACKEND.md` para la guía actualizada (reemplaza esta tabla).**

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| Migrar de SQLite a PostgreSQL | 🔴 CRÍTICO | ❌ Sigue en SQLite |
| Script de seed: importar properties.json a BD | 🔴 CRÍTICO | ❌ No existe |
| API pública: `GET /api/propiedades` con filtros | 🔴 CRÍTICO | ❌ No existe — ver `docs/BACKEND.md`, V1 Paso 3 |
| Rutas de propiedad dinámicas (ISR) en lugar de SSG puro | 🟡 ALTA | ❌ Sigue siendo SSG puro (`generateStaticParams`) |
| Búsqueda fulltext con PostgreSQL | 🟡 ALTA | ❌ Sigue siendo filtro en memoria sobre JSON |
| Cache de queries frecuentes | 🟠 MEDIA | ❌ No existe |

---

## Módulo 10 — Sitemap y SEO Técnico

**Estado real 2026-08-06: la mitad de este módulo ya está resuelto.**

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| `sitemap.xml` generado dinámicamente | 🔴 CRÍTICO | ✅ Completo — `src/app/sitemap.ts`, incluye propiedades + municipios + zonas |
| `robots.txt` configurado | 🔴 CRÍTICO | ✅ Completo — `src/app/robots.ts`, bloquea `/api/*` y `/publicar/gracias` |
| JSON-LD estructurado en detalle propiedad | 🟡 ALTA | ❌ No existe |
| Open Graph images dinámicas | 🟠 MEDIA | ❌ Imagen OG estática única, no por propiedad |
| Core Web Vitals: LCP, CLS, FID | 🟠 MEDIA | ⚠️ No medido/monitoreado formalmente |

---

## Módulo 11 — Panel Admin Básico

**Construido 2026-08-06 — ver `docs/BACKEND.md` §16 para el contrato completo.** Datos 100% reales (Prisma), no simulados. Único punto fuera de alcance a propósito: moderar/editar publicaciones de propiedad, porque `Property` no es una tabla real todavía.

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| `/admin` protegido por permiso de admin | 🟡 ALTA | ✅ Completo — `User.esAdmin`, gate server-side en `src/app/admin/layout.tsx`, nunca viaja en el JWT (se lee fresco de la base en cada request, igual que `bloqueado`) |
| Lista de propiedades pendientes de moderación | 🟡 ALTA | ❌ Sigue sin existir — bloqueado hasta que `Property` sea una tabla real |
| Lista de usuarios registrados | 🟠 MEDIA | ✅ Completo — `/admin/usuarios`, búsqueda + filtro + paginación |
| Stats globales | 🟠 MEDIA | ✅ Completo — `/admin/metricas` |
| Bloquear usuario / marcar propiedad como fraude | 🟠 MEDIA | ⚠️ Bloquear usuario ahora SÍ tiene panel manual (`/admin/usuarios`, además del automático de 3 strikes). Marcar propiedad como fraude sigue sin existir (mismo bloqueo que arriba, depende de `Property`) |
| Solicitud de revisión para cuentas bloqueadas por error | 🟡 ALTA | ✅ Completo — endpoint público `POST /api/cuenta/solicitar-revision` + cola en `/admin/solicitudes`, con correo real en ambos sentidos (aprobada/rechazada) |
| Reportes de publicaciones | 🟠 MEDIA | ✅ Completo — `POST /api/propiedades/reportar` dejó de ser un stub, cola en `/admin/reportes` |
| Auditoría de acciones de admin | 🟠 MEDIA | ✅ Completo — `AccionAdmin`, visor en `/admin/auditoria` |

---

## Módulo 12 — Performance y Analytics

**Sin cambios — nada de este módulo existe todavía.**

| Feature | Prioridad | Estado real 2026-08-06 |
|---|---|---|
| Tracking de vistas por propiedad | 🟡 ALTA | ❌ No existe (stats de dashboard son mock, ver Módulo 8) |
| Analytics básico: propiedades más vistas | 🟡 ALTA | ❌ No existe |
| Plausible Analytics o Umami | 🟠 MEDIA | ❌ No existe |
| Error tracking (Sentry) | 🟠 MEDIA | ❌ No existe |

---

## Modelo de Datos Completo Fase 2

**Obsoleto — reemplazado por el modelo `Property` sugerido al final de `prisma/schema.prisma` y documentado en `docs/BACKEND.md`.** Se deja aquí como referencia histórica del plan original; el modelo actualizado difiere en varios campos (`estado` como enum de texto en vez de boolean, sin `agenteId` separado, etc.) y ya incluye todo lo que el frontend construido en 2026-08-06 necesita.

```
User
  ├── Propiedad[] (propietario)
  ├── Favorito[]
  ├── Alerta[]
  └── Contacto[] (como buscador) — Contacto sigue sin existir, ver Módulo 6

Propiedad
  ├── User (propietario)
  ├── Contacto[]
  └── Vista[] — sigue sin existir, ver Módulo 12

Contacto
  ├── Propiedad
  └── User? (buscador, puede ser anónimo)

Vista
  └── Propiedad

Alerta
  └── User
```

---

## Roadmap de Entrega Fase 2

**Estado real 2026-08-06** — varios ítems de Sprint 3-5 ya están hechos, fuera del orden original (se implementaron cuando hicieron falta para otras funciones, no siguiendo este roadmap sprint por sprint):

### Sprint 1 — Infraestructura (Semana 1-2)
1. ❌ Migrar SQLite → PostgreSQL
2. ❌ Modelo `Property` en Prisma + seed desde JSON — ver `docs/BACKEND.md`
3. ❌ API `POST /api/propiedades` + `GET /api/propiedades`
4. ❌ Storage fotos (Cloudinary free tier)

### Sprint 2 — Publicación Real (Semana 3-4)
5. ❌ Conectar `PublishForm.onSubmit` → `POST /api/propiedades`
6. ❌ Upload fotos a Cloudinary desde formulario
7. ✅ Página `/dashboard/propiedades` — mis publicaciones (frontend completo, sobre `localStorage`)
8. ✅ Editar/pausar/eliminar propiedad (frontend completo, sobre `localStorage`)

### Sprint 3 — Auth + Contacto (Semana 5)
9. ✅ `POST /api/auth/logout` + `GET /api/auth/me`
10. ✅ OAuth Google/Facebook completos
11. ✅ Contacto con Resend (`POST /api/propiedades/[id]/contactar`, por-propiedad en vez de genérico)
12. ❌ Modelo `Contacto` en BD

### Sprint 4 — IA + Alertas (Semana 6)
13. ✅ IA para generar descripción — **OpenRouter, no Claude API**
14. ✅ Alertas + email con Resend — event-driven, no job/cron
15. ⚠️ Stats en Dashboard — mock determinístico, no reales

### Sprint 5 — SEO + Admin (Semana 7)
16. ✅ Sitemap dinámico + robots.txt
17. ❌ JSON-LD en detalle propiedad
18. ❌ Panel admin básico (moderación)
19. ❌ Rutas ISR para propiedades nuevas

---

## Stack Técnico Adicional en Fase 2

| Layer | Tecnología planeada | Estado real 2026-08-06 |
|---|---|---|
| BD producción | PostgreSQL (Supabase o Railway) | ❌ Sigue en SQLite |
| Storage fotos | Cloudinary | ❌ No conectado |
| Email | Resend | ✅ Conectado y en uso real |
| IA descripciones | ~~Claude API~~ | ✅ **OpenRouter** (`meta-llama/llama-3.3-70b-instruct`), no Claude — decisión tomada durante la integración por costo/disponibilidad |
| Analytics | Plausible o Umami | ❌ No conectado |
| Error tracking | Sentry | ❌ No conectado |
| Deploy | Vercel | ❌ No desplegado todavía |
| Cache | Vercel KV o Upstash Redis | ❌ No conectado |

---

## Métricas de Éxito Fase 2

Sin cambios — son objetivos de negocio a futuro, no estado de implementación:

| Métrica | Objetivo |
|---|---|
| Propietarios registrados | 100 en primer mes |
| Publicaciones reales (no mock) | 50 propiedades activas |
| Tasa de contacto por propiedad | > 5% vistas → contacto |
| Uso de IA para descripción | > 60% de publicaciones |
| Tasa de apertura emails de alerta | > 35% |
| Tiempo para publicar una propiedad | < 5 minutos |
