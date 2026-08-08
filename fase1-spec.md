# Fase 1 — MVP de Lanzamiento
## Vive Villahermosa — Plataforma Inmobiliaria de Tabasco

> **Verificado y actualizado 2026-08-06 contra el código real** (antes tenía partes desactualizadas — sitemap/robots aparecían como pendientes cuando ya existían, logout/OAuth aparecían como parciales cuando ya están completos, etc.). Para la guía priorizada de qué falta implementar en el backend, usa **[`docs/BACKEND.md`](docs/BACKEND.md)** — este documento sigue siendo el inventario completo de producto (no solo backend).

**Objetivo:** Plataforma pública funcional que permita a usuarios descubrir propiedades en Tabasco, guardar favoritos, crear alertas y a propietarios publicar su primera propiedad. Sin fricción, sin comisiones, sin registro obligatorio para explorar.

**Estado global Fase 1:** el bloqueante real que queda es uno solo — persistencia de propiedades (Módulo 8, ver `docs/BACKEND.md`). Todo lo demás listado aquí como pendiente en la versión original de este documento ya se resolvió (logout, OAuth, sitemap/robots) o quedó reclasificado con precisión (alertas por email sí son reales; stats de dashboard son un mock creíble, no datos reales).

---

## Módulo 1 — Catálogo Público

**Objetivo negocio:** Primero capturar inventario de propiedades; luego atraer buscadores. Sin catálogo no hay plataforma.

| Feature | Estado | Notas |
|---|---|---|
| Homepage con hero y búsqueda | ✅ COMPLETO | Gradient brand, SearchBar, propiedades destacadas |
| Listado `/propiedades` con grid | ✅ COMPLETO | Vista grid + vista mapa |
| Filtros: tipo, operación, municipio, precio, recámaras | ✅ COMPLETO | FilterPanel dark theme, URL sync |
| Ordenamiento: relevancia, precio, reciente | ✅ COMPLETO | SortSelect |
| Búsqueda por texto (colonia, municipio, descripción) | ✅ COMPLETO | Debounce 120ms, más búsqueda con IA (OpenRouter) al presionar Enter |
| Chips de filtro activos removibles | ✅ COMPLETO | ActiveFilters |
| Filtro especial: Cerca de Dos Bocas / PEMEX | ✅ COMPLETO | Feature exclusiva Tabasco |
| Indicador riesgo inundación en cada propiedad | ✅ COMPLETO | bajo / medio / alto (CONAGUA / Atlas de Riesgos Municipal) |
| Paginación lazy (cargar más) | ✅ COMPLETO | 12 por página |
| Skeleton loading states | ✅ COMPLETO | Skeleton component |
| Estado vacío (sin resultados) | ✅ COMPLETO | Con CTA limpiar filtros |
| **Cobertura:** 24 propiedades de ejemplo, **17 municipios reales** | ⚠️ DATOS MOCK | El catálogo sigue siendo `properties.json` estático (pendiente conectar a BD real, ver `docs/BACKEND.md`) — pero los 17 municipios ya son correctos en publicar/buscar/alertas desde el 2026-08-06 (antes solo 6-10 eran seleccionables, 3 listas divergentes en el código) |

---

## Módulo 2 — Detalle de Propiedad

**Objetivo negocio:** Convertir interés en contacto. Cada visita a una página de propiedad es una oportunidad de conversión.

| Feature | Estado | Notas |
|---|---|---|
| Página dinámica `/propiedades/[slug]` | ✅ COMPLETO | `generateStaticParams` para el catálogo; propiedades publicadas localmente (`local-...`) se resuelven client-side, ver `docs/BACKEND.md` |
| Galería de fotos con lightbox | ✅ COMPLETO | PropertyGallery, navegación con flechas |
| Specs completas (m², recámaras, baños, garaje, antigüedad) | ✅ COMPLETO | PropertySpecs |
| Servicios para renta (18 iconos: WiFi, AC, amueblado, etc.) | ✅ COMPLETO | SERVICIOS_RENTA |
| FloodRiskBadge informativo | ✅ COMPLETO | Con descripción textual |
| Mapa de ubicación embebido | ✅ COMPLETO | Leaflet, solo la propiedad, coordenada aproximada por privacidad |
| Tarjeta de agente/propietario con WhatsApp | ✅ COMPLETO | AgentCard, revelado instantáneo solo con sesión iniciada |
| Formulario de contacto | ✅ COMPLETO | `POST /api/propiedades/[id]/contactar` envía un correo real (Resend) al dueño — no es mock. No persiste el mensaje en una tabla (el correo es el único registro), eso sí sigue pendiente |
| Botón favorito | ✅ COMPLETO | Requiere auth |
| Botón compartir | ✅ COMPLETO | Deep link de WhatsApp con texto prellenado |
| Propiedades similares (tipo + operación) | ✅ COMPLETO | getSimilarProperties |
| Precio por m² + comparativa de zona | ✅ COMPLETO | getPriceContext |
| SEO: metadata dinámica, OpenGraph | ✅ COMPLETO | buildPropertyMetadata |
| Breadcrumbs | ✅ COMPLETO | |
| Banner de gestión (pausar/editar/eliminar) para el dueño | ✅ COMPLETO | `OwnerActionsBar` — funciona para cualquier cuenta, no solo inmobiliarias (fix 2026-08-06), aunque sigue siendo simulación en `localStorage` hasta que exista `Property` real |

---

## Módulo 3 — Mapa Interactivo

**Objetivo negocio:** Diferenciador clave. El usuario ve precio, tipo y riesgo directamente sobre el mapa, sin salir.

| Feature | Estado | Notas |
|---|---|---|
| Mapa `/mapa` con todos los markers | ✅ COMPLETO | Leaflet + react-leaflet |
| Tile Carto Voyager (mejor tipografía) | ✅ COMPLETO | |
| Vista satélite (Esri) | ✅ COMPLETO | Toggle Mapa/Satélite |
| Clustering de markers | ✅ COMPLETO | leaflet.markercluster |
| Markers coloreados por riesgo inundación | ✅ COMPLETO | rojo/amarillo/verde |
| Precio en marker (shortPrice) | ✅ COMPLETO | $1.2M / $8k/mo |
| Sidebar dark con filtros | ✅ COMPLETO | FilterPanel bg-brand-dark |
| Panel derecho: Mapa/Satélite, Inundación, Ir a zona | ✅ COMPLETO | 7 zonas Villahermosa |
| Circle al seleccionar zona | ✅ COMPLETO | showZoneCircle / clearZoneCircle |
| "Buscar en esta zona" con bounds | ✅ COMPLETO | |
| Card de propiedad seleccionada | ✅ COMPLETO | SelectedCard |
| Drawer móvil con filtros | ✅ COMPLETO | |
| Geolocalización (ir a mi ubicación) | ✅ COMPLETO | navigator.geolocation |
| Legend móvil de riesgo inundación | ✅ COMPLETO | |
| Footer oculto en /mapa | ✅ COMPLETO | |
| Propiedades publicadas localmente también aparecen aquí | ✅ COMPLETO | Fix 2026-08-06 — antes solo se veían en el catálogo estático |

---

## Módulo 4 — Zonas y Municipios

**Objetivo negocio:** SEO local. Cada zona = una página indexable que atrae búsquedas tipo "casas en renta Tabasco 2000".

| Feature | Estado | Notas |
|---|---|---|
| Página `/zonas` — colonias destacadas + 17 municipios | ✅ COMPLETO | `municipalities.json` corregido 2026-08-06 (tenía una entrada falsa "Paraíso (Reforma)" y le faltaba Jalapa) |
| Detalle `/zonas/[slug]` con mapa + propiedades | ✅ COMPLETO | generateStaticParams |
| Descripción editorial por zona | ✅ COMPLETO | zones.json |
| Stats por municipio (propiedades, precio promedio) | ⚠️ PARCIAL | Se calculan en vivo sobre el catálogo estático — precisos hoy, pero no reflejan propiedades publicadas localmente (alcance deliberadamente fuera de esta ronda, ver `docs/BACKEND.md`) |
| Links a `/propiedades?municipio=...` | ✅ COMPLETO | |
| SEO por zona | ✅ COMPLETO | buildZoneMetadata |

---

## Módulo 5 — Autenticación

**Objetivo negocio:** Identificar usuarios para personalización, favoritos, alertas y publicaciones.

| Feature | Estado | Notas |
|---|---|---|
| Registro con email/password | ✅ COMPLETO | bcrypt (costo 12), Prisma, SQLite |
| Login con email/password | ✅ COMPLETO | JWT (jose) en cookie HttpOnly |
| Roles: buscador / agente (modo Inmobiliaria) | ✅ COMPLETO | Activación real vía `POST /api/auth/activar-inmobiliaria` (sin cobro real todavía, ver `docs/BACKEND.md` V2.B) |
| Sesión persistente 7 días | ✅ COMPLETO | JWT stateless — sin revocación general todavía (ver `docs/BACKEND.md`, "Revocación de sesiones") |
| AuthContext global (useAuth hook) | ✅ COMPLETO | |
| UI login/registro (card dark gradient) | ✅ COMPLETO | |
| Logout | ✅ COMPLETO | `POST /api/auth/logout` — borra la cookie de sesión |
| OAuth Google | ✅ COMPLETO | Callback real, con mitigación de account pre-hijacking (no fusiona automáticamente con una cuenta de contraseña existente) |
| OAuth Facebook | ✅ COMPLETO | Mismo patrón que Google |
| Bloqueo de cuentas por abuso (búsqueda con IA) | ✅ COMPLETO | 3 strikes, `User.bloqueado`, revocación en tiempo real en `getSession()` — no estaba en el spec original |
| Recuperación de contraseña | ❌ PENDIENTE | No implementado |
| Verificación de correo electrónico | ❌ PENDIENTE | Ver `docs/BACKEND.md`, sección Seguridad — cierra el hallazgo de seguridad más grave pendiente |

---

## Módulo 6 — Favoritos

**Objetivo negocio:** Retención. Los favoritos crean hábito de regresar a la plataforma.

| Feature | Estado | Notas |
|---|---|---|
| Botón favorito en cards y detalle | ✅ COMPLETO | Requiere auth, redirige si no hay sesión |
| API POST/DELETE `/api/favoritos` | ✅ COMPLETO | Prisma, índice único |
| Página `/favoritos` con lista | ✅ COMPLETO | Incluye propiedades publicadas localmente desde 2026-08-06 |
| Estado vacío con CTA | ✅ COMPLETO | |

---

## Módulo 7 — Alertas de Propiedades

**Objetivo negocio:** Retención pasiva. El usuario no tiene que regresar — le avisamos cuando hay algo nuevo.

| Feature | Estado | Notas |
|---|---|---|
| Formulario crear alerta (municipio, tipo, precio, riesgo) | ✅ COMPLETO | react-hook-form + zod, 17 municipios |
| API CRUD `/api/alertas` | ✅ COMPLETO | Prisma |
| Lista de alertas activas del usuario | ✅ COMPLETO | |
| Eliminar alerta | ✅ COMPLETO | |
| **Envío de email cuando hay coincidencia** | ✅ COMPLETO | Real vía Resend + notificación in-app (`Notificacion` en Prisma) — pero es event-driven en el momento de publicar, no un cron/job diario como planeaba el spec original. `Notificacion.propiedadId` queda `null` hasta que exista `Property` real (ver `docs/BACKEND.md`, Paso 6) |

---

## Módulo 8 — Publicar Propiedad (Formulario)

**Objetivo negocio:** Crecimiento de oferta. Sin publicaciones nuevas no hay plataforma.

| Feature | Estado | Notas |
|---|---|---|
| Multi-step form 6 pasos (Tipo, Detalles, Ubicación, Descripción, Fotos, Contacto) | ✅ COMPLETO | react-hook-form + zod v4 |
| Validación por paso con mensajes en español | ✅ COMPLETO | |
| Banner de error por paso | ✅ COMPLETO | stepError state |
| Picker de tipo de propiedad | ✅ COMPLETO | 7 tipos con iconos |
| Selector de operación (venta/renta) | ✅ COMPLETO | |
| Picker de servicios para renta (18 iconos) | ✅ COMPLETO | |
| Upload de hasta 4 fotos con preview | ✅ COMPLETO | FileReader, drag area |
| Detección de fraude e IA al publicar | ✅ COMPLETO | `analizarFraude`/`analizarImagenPropiedad` reales (OpenRouter/Gemini) — pero la decisión de bloquear la toma el navegador, no el servidor (ver `docs/BACKEND.md`, V1 Paso 2) |
| **Persistencia en base de datos** | ❌ PENDIENTE | Sigue siendo `localStorage` (simulación de un solo navegador) — **el bloqueante real de Fase 1**, ver `docs/BACKEND.md` |
| **Storage de fotos** | ❌ PENDIENTE | Sin Cloudinary/S3 — fotos son data URIs base64 |
| **Página de gestión de mis publicaciones** | ✅ COMPLETO (frontend) | `/dashboard/propiedades` — editar/pausar/reactivar/archivar/destacar/eliminar, funciona para cualquier cuenta desde 2026-08-06 — pero sigue siendo simulación en `localStorage`, no persiste entre navegadores |

---

## Módulo 9 — Blog Editorial

**Objetivo negocio:** SEO y autoridad. Contenido útil posiciona la marca y atrae tráfico orgánico.

| Feature | Estado | Notas |
|---|---|---|
| Listado `/blog` por categoría | ✅ COMPLETO | |
| Detalle `/blog/[slug]` | ✅ COMPLETO | |
| Artículos relacionados | ✅ COMPLETO | |
| Contenido estático en JSON | ✅ COMPLETO | blog.json |
| **CMS o edición sin deploy** | ❌ PENDIENTE | Actualmente requiere editar JSON — sin cambios desde la versión original de este spec |

---

## Módulo 10 — Dashboard de Usuario

**Objetivo negocio:** Retención. El panel resume el valor que el usuario tiene en la plataforma.

| Feature | Estado | Notas |
|---|---|---|
| Página `/dashboard` con bienvenida | ✅ COMPLETO | |
| Stats: vistas, contactos | ⚠️ MOCK CREÍBLE, NO DATOS REALES | `GET /api/me/stats` está autenticado y responde de verdad, pero los números son un hash determinístico del `userId` — no hay tabla de eventos (`Vista`/`Contacto`) detrás todavía |
| Quick actions | ✅ COMPLETO | Links a favoritos, alertas, publicar |
| **Mis publicaciones** | ✅ COMPLETO (frontend) | `/dashboard/propiedades`, ver Módulo 8 — no era cierto que faltara del todo, solo que no persiste en servidor |

---

## Módulo 11 — SEO y Rendimiento

| Feature | Estado | Notas |
|---|---|---|
| Metadata dinámica (propiedades, zonas) | ✅ COMPLETO | |
| Metadata estática (homepage, blog) | ✅ COMPLETO | |
| generateStaticParams (SSG) | ✅ COMPLETO | propiedades, zonas, blog |
| OpenGraph images | ⚠️ PARCIAL | Imagen OG estática (`og-default.jpg`), no generada dinámicamente por propiedad |
| Canonical URLs | ✅ COMPLETO | |
| Sitemap.xml | ✅ COMPLETO | `src/app/sitemap.ts`, dinámico — incluye propiedades, municipios y zonas |
| Robots.txt | ✅ COMPLETO | `src/app/robots.ts`, bloquea `/api/*` y `/publicar/gracias` |
| Structured data (JSON-LD) | ❌ PENDIENTE | Sin cambios desde la versión original |

---

## Pendientes Bloqueantes para Lanzar Fase 1

Lista actualizada — varios de los 7 puntos originales ya se resolvieron:

1. **Publicación con persistencia** — sigue siendo el único bloqueante real. Guía completa en `docs/BACKEND.md`.
2. **Storage de fotos** — Cloudinary o S3, parte del mismo trabajo de arriba.
3. ~~OAuth callbacks~~ — ✅ resuelto, Google y Facebook completos.
4. ~~Logout endpoint~~ — ✅ resuelto, `/api/auth/logout`.
5. ~~Sitemap + Robots~~ — ✅ resuelto, ambos dinámicos y reales.
6. ~~ContactForm real~~ — ✅ resuelto, envía correo real vía Resend.
7. **Stats reales en Dashboard** — sigue pendiente (mock determinístico, no tabla de eventos real) — depende de la tabla de eventos descrita en `docs/BACKEND.md`, V2.A.

---

## Stack Técnico Fase 1

| Layer | Tecnología |
|---|---|
| Frontend | Next.js 16.2.9 App Router + TypeScript |
| Estilos | Tailwind CSS v4 |
| Mapas | Leaflet + leaflet.markercluster |
| Auth | JWT (jose) + bcryptjs + Prisma |
| BD | SQLite (dev) → PostgreSQL (producción, sin migrar todavía) |
| ORM | Prisma 5.22 |
| Forms | react-hook-form + zod v4 |
| IA | OpenRouter (texto: búsqueda, fraude, descripciones) + Gemini (visión: fotos) — real, no mock |
| Storage fotos | ❌ Pendiente (Cloudinary recomendado) |
| Email | ✅ Resend conectado (alertas, recordatorios de citas, contacto de propiedad) |
| Deploy | ❌ Pendiente (Vercel recomendado) |
