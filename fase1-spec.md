# Fase 1 — MVP de Lanzamiento
## Vive Villahermosa — Plataforma Inmobiliaria de Tabasco

> **Auditado y reescrito 2026-09-03 contra el código real + verificación en vivo contra producción** (cuenta de prueba desechable, creada y borrada en la misma auditoría — ver skill `verificacion-backend-en-vivo`). La versión anterior (2026-08-06) describía una arquitectura ya obsoleta: en ese momento el catálogo era `properties.json` estático y "publicar" simulaba persistencia en `localStorage` de un solo navegador. Esa arquitectura ya no existe — el pivote a un backend real y separado (NestJS/Prisma, JWT propio, fuera de las API routes de Next.js) se completó y **hoy solo queda una ruta local en `src/app/api/` (`/api/health`)**; todo lo demás (auth, propiedades, favoritos, alertas, mensajería, notificaciones push, admin) vive en el backend real. `docs/BACKEND.md` (la guía de contrato que citaba la versión anterior de este documento) ya no existe en el repo — fue parte de una limpieza de docs; este documento ya no depende de él.

**Objetivo:** Plataforma pública funcional que permita a usuarios descubrir propiedades en Tabasco, guardar favoritos, crear alertas y a propietarios publicar su primera propiedad. Sin fricción, sin comisiones, sin registro obligatorio para explorar.

**Estado global Fase 1: sin bloqueantes reales.** Los dos bloqueantes que la versión anterior marcaba como pendientes (persistencia de propiedades, storage de fotos) **ya están resueltos y verificados** — publicar pega directo al backend real (`POST /propiedades/fotos` sube a Cloudinary, `Property.fotos` guarda URLs reales, nunca base64). Lo que queda pendiente es una lista corta y específica (ver "Pendientes reales" al final), no un bloqueante de lanzamiento.

---

## Módulo 1 — Catálogo Público

**Objetivo negocio:** Primero capturar inventario de propiedades; luego atraer buscadores. Sin catálogo no hay plataforma.

| Feature | Estado | Notas |
|---|---|---|
| Homepage con hero y búsqueda | ✅ COMPLETO | Gradient brand, SearchBar con placeholder rotativo (ejemplos reales del catálogo, verificado 2026-09-03), propiedades destacadas |
| Listado `/propiedades` con grid | ✅ COMPLETO | Vista grid + vista mapa, paginado desde el backend |
| Filtros: tipo, operación, municipio, precio, recámaras | ✅ COMPLETO | FilterPanel dark theme, URL sync |
| Ordenamiento: relevancia, precio, reciente | ✅ COMPLETO | SortSelect |
| Búsqueda por texto + IA en lenguaje natural | ✅ COMPLETO | `POST /ia/busqueda-inteligente` (OpenRouter) — auditado en vivo 2026-09-03: 34/35 correcto a la primera, 9/9 intentos de jailbreak/inyección resistidos, ver `docs/BACKEND-AUDITORIA-IA-BUSQUEDA-03092026.md` |
| Chips de filtro activos removibles | ✅ COMPLETO | ActiveFilters |
| Filtro especial: Cerca de Dos Bocas / PEMEX | ✅ COMPLETO | Feature exclusiva Tabasco, confirmada con datos reales en `docs/investigacion-mercado-tabasco.md` |
| Indicador riesgo inundación en cada propiedad | ✅ COMPLETO | bajo / medio / alto (CONAGUA / Atlas de Riesgos Municipal) |
| Paginación lazy (cargar más) | ✅ COMPLETO | 12 por página, contra backend real |
| Skeleton loading states | ✅ COMPLETO | Skeleton component |
| Estado vacío (sin resultados) | ✅ COMPLETO | Con CTA limpiar filtros |
| **Cobertura:** 17 municipios reales, catálogo real (no mock) | ✅ COMPLETO | `getAllProperties()` pega a `GET /propiedades?all=true` del backend real — `properties.json` ya no alimenta el catálogo público (puede quedar código muerto, no se auditó su uso residual) |
| Fuera de cobertura (ciudades de otro estado) | ✅ COMPLETO | `fueraDeCobertura: true` del backend — confirmado LIVE en producción 2026-09-03 (Ciudad del Carmen, Campeche, Coatzacoalcos), frontend avisa en vez de buscar |

---

## Módulo 2 — Detalle de Propiedad

**Objetivo negocio:** Convertir interés en contacto. Cada visita a una página de propiedad es una oportunidad de conversión.

| Feature | Estado | Notas |
|---|---|---|
| Página dinámica `/propiedades/[slug]` | ✅ COMPLETO | Datos reales del backend, ya no hay resolución especial para "propiedades locales" (esa capa de simulación ya no existe) |
| Galería de fotos con lightbox | ✅ COMPLETO | PropertyGallery, navegación con flechas |
| Specs completas (m², recámaras, baños, garaje, antigüedad) | ✅ COMPLETO | PropertySpecs |
| Servicios para renta (18 iconos: WiFi, AC, amueblado, etc.) | ✅ COMPLETO | SERVICIOS_RENTA |
| FloodRiskBadge informativo | ✅ COMPLETO | Con descripción textual |
| Mapa de ubicación embebido | ✅ COMPLETO | Leaflet, solo la propiedad, coordenada aproximada por privacidad |
| Tarjeta de agente/propietario con WhatsApp | ✅ COMPLETO | AgentCard, revelado instantáneo solo con sesión iniciada |
| Formulario de contacto | ✅ COMPLETO | `POST /propiedades/:id/contactar`, confirmado en vivo 2026-09-03 (endpoint real, valida DTO) |
| Mensajería bidireccional propietario ↔ interesado | ✅ COMPLETO | Chat in-app vía SSE (`Conversacion`/`Mensaje`), construido 2026-09-02 — no estaba en el spec original |
| Botón favorito | ✅ COMPLETO | Requiere auth, confirmado en vivo 2026-09-03 |
| Botón compartir | ✅ COMPLETO | Deep link de WhatsApp con texto prellenado; enlace apunta al dominio real de producción (bug de `localhost` en el link corregido 2026-09-02) |
| Propiedades similares (tipo + operación) | ✅ COMPLETO | getSimilarProperties |
| Precio por m² + comparativa de zona | ✅ COMPLETO | getPriceContext |
| SEO: metadata dinámica, OpenGraph, JSON-LD | ✅ COMPLETO | `buildPropertyMetadata` — imagen OG es la foto real de la propiedad (no una imagen genérica estática), JSON-LD implementado (`src/lib/seo.ts`) |
| Breadcrumbs | ✅ COMPLETO | |
| Banner de gestión (pausar/editar/eliminar) para el dueño | ✅ COMPLETO | `OwnerActionsBar` contra backend real (`/propiedades/mias`), ya no es simulación — botón "Copiar ubicación" rediseñado en fila propia 2026-09-03 por ser el más usado |
| Etiqueta Renta/Venta antes del precio (barra fija móvil) | ✅ COMPLETO | Solo visible cuando la propiedad es del usuario en sesión — 2026-09-03 |

---

## Módulo 3 — Mapa Interactivo

**Objetivo negocio:** Diferenciador clave. El usuario ve precio, tipo y riesgo directamente sobre el mapa, sin salir.

| Feature | Estado | Notas |
|---|---|---|
| Mapa `/mapa` con todos los markers | ✅ COMPLETO | Leaflet + react-leaflet, propiedades reales del backend |
| Tile de calles (Esri World Street Map + filtro CSS) | ✅ COMPLETO | Cambiado desde Carto Voyager — Carto exigía key y mostraba marca de agua, ver `docs/vive_villahermosa_map_tiles` (memoria) |
| Vista satélite (Esri) | ✅ COMPLETO | Toggle Mapa/Satélite |
| Clustering de markers | ✅ COMPLETO | leaflet.markercluster |
| Markers coloreados por riesgo inundación | ✅ COMPLETO | rojo/amarillo/verde |
| Precio en marker (shortPrice) | ✅ COMPLETO | $1.2M / $8k/mo |
| Sidebar dark con filtros | ✅ COMPLETO | FilterPanel bg-brand-dark |
| Panel derecho: Mapa/Satélite, Inundación, Ir a zona | ✅ COMPLETO | 7 zonas Villahermosa |
| Circle al seleccionar zona | ✅ COMPLETO | showZoneCircle / clearZoneCircle |
| "Buscar en esta zona" con bounds | ✅ COMPLETO | `getPropertiesInBounds` — el backend sí filtra de verdad por el área (verificado en vivo 2026-08-26) |
| Card de propiedad seleccionada | ✅ COMPLETO | SelectedCard |
| Drawer móvil con filtros | ✅ COMPLETO | |
| Geolocalización (ir a mi ubicación) | ✅ COMPLETO | navigator.geolocation |
| Legend móvil de riesgo inundación | ✅ COMPLETO | |
| Footer oculto en /mapa | ✅ COMPLETO | |

---

## Módulo 4 — Zonas y Municipios

**Objetivo negocio:** SEO local. Cada zona = una página indexable que atrae búsquedas tipo "casas en renta Tabasco 2000".

| Feature | Estado | Notas |
|---|---|---|
| Página `/zonas` — colonias destacadas + 17 municipios | ✅ COMPLETO | Cards de municipio rediseñadas 2026-09-03 (ícono flotando sobre el borde, referencia uiverse.io) |
| Detalle `/zonas/[slug]` con mapa + propiedades | ✅ COMPLETO | generateStaticParams |
| Descripción editorial por zona | ✅ COMPLETO | zones.json |
| Stats por municipio (propiedades, precio promedio) | ✅ COMPLETO | `getMunicipalitiesWithLiveStats` — calculado sobre el catálogo real del backend, ya no sobre datos estáticos |
| Ranking por demanda real (búsquedas + vistas + contactos) | ✅ COMPLETO | `getColoniasOrdenadasPorDemanda`, con fallback honesto a orden por oferta si aún no hay eventos registrados — no estaba en el spec original |
| Links a `/propiedades?municipio=...` | ✅ COMPLETO | |
| SEO por zona | ✅ COMPLETO | buildZoneMetadata |

---

## Módulo 5 — Autenticación

**Objetivo negocio:** Identificar usuarios para personalización, favoritos, alertas y publicaciones.

| Feature | Estado | Notas |
|---|---|---|
| Registro con email/password | ✅ COMPLETO | Confirmado en vivo 2026-09-03 — nota: el enum de `rol` cambió a `particular`/`agente` (ya no `buscador`), este documento estaba desactualizado en ese detalle |
| Login con email/password | ✅ COMPLETO | JWT en cookie HttpOnly, confirmado en vivo |
| Roles: particular / agente (modo Inmobiliaria) | ✅ COMPLETO | |
| Sesión persistente, revocación en tiempo real | ✅ COMPLETO | `getSession()` relee `bloqueado`/`esAdmin` fresco de la base en cada request — no depende solo del JWT |
| AuthContext global (useAuth hook) | ✅ COMPLETO | |
| UI login/registro (card dark gradient) | ✅ COMPLETO | |
| Logout | ✅ COMPLETO | Confirmado en vivo 2026-09-03 |
| OAuth Google | ✅ COMPLETO | Callback real, con mitigación de account pre-hijacking |
| OAuth Facebook | ✅ COMPLETO | Mismo patrón que Google |
| Bloqueo de cuentas por abuso (búsqueda con IA) | ✅ COMPLETO | 3 strikes, revocación en tiempo real |
| **Recuperación de contraseña** | ✅ COMPLETO | **Corrección de esta auditoría — la versión anterior decía "❌ PENDIENTE" y estaba mal.** Flujo real de 2 pasos con código por correo: `POST /auth/recuperar-password` (solicitar código) → `POST /auth/recuperar-password/confirmar` (código + nueva password), frontend completo en `/auth/recuperar-password`, confirmado en vivo 2026-09-03 |
| Solicitud de revisión para cuentas bloqueadas por error | ✅ COMPLETO | `POST /api/cuenta/solicitar-revision`, público, sin sesión — no estaba en el spec original |
| Panel de administración real | ✅ COMPLETO | `/admin/**`, `User.esAdmin`, gate server-side — no estaba en el spec original de Fase 1, construido 2026-08-06 |
| Verificación de correo electrónico | ✅ COMPLETO | **Segunda corrección de esta auditoría** — la primera pasada (misma fecha) adivinó mal el nombre del endpoint y concluyó que no existía. El backend sí lo tenía: `POST /auth/verificar-email` (token ≥64 chars) + `POST /auth/reenviar-verificacion` (autenticado), confirmados en vivo. El frontend no exponía nada de esto — se construyó 2026-09-03: `AuthUser.emailVerificado`, banner en `/dashboard` con reenvío, página `/auth/verificar-correo` que consume el link del correo. Pendiente de confirmar con backend a qué URL apunta el link real del correo, ver `docs/BACKEND-VERIFICACION-CORREO-03092026.md` |

---

## Módulo 6 — Favoritos

**Objetivo negocio:** Retención. Los favoritos crean hábito de regresar a la plataforma.

| Feature | Estado | Notas |
|---|---|---|
| Botón favorito en cards y detalle | ✅ COMPLETO | Requiere auth, redirige si no hay sesión |
| API POST/DELETE `/favoritos` | ✅ COMPLETO | Confirmado en vivo 2026-09-03 contra backend real |
| Página `/favoritos` con lista | ✅ COMPLETO | |
| Estado vacío con CTA | ✅ COMPLETO | |

---

## Módulo 7 — Alertas de Propiedades

**Objetivo negocio:** Retención pasiva. El usuario no tiene que regresar — le avisamos cuando hay algo nuevo.

| Feature | Estado | Notas |
|---|---|---|
| Formulario crear alerta (municipio, tipo, precio, riesgo) | ✅ COMPLETO | react-hook-form + zod, 17 municipios |
| API CRUD `/alertas` | ✅ COMPLETO | Confirmado en vivo 2026-09-03 |
| Lista de alertas activas del usuario | ✅ COMPLETO | |
| Eliminar alerta | ✅ COMPLETO | |
| Envío de email cuando hay coincidencia | ✅ COMPLETO | Real vía Resend + notificación in-app real |
| Notificaciones push (Web Push) | ✅ COMPLETO | VAPID real, `PushManager`, opt-in desde `/alertas` — no estaba en el spec original, construido 2026-09-02. iOS solo funciona con la app instalada (limitación de la plataforma, no un bug) |
| Notificaciones in-app con paginación real | ✅ COMPLETO | "Cargar más", marca de no leídas, ruteo centralizado (`notificacionHref`) — no estaba en el spec original |

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
| Sugerencias de descripción (lugares cercanos, amenidades) | ✅ COMPLETO | Corregido 2026-09-03 — antes repetía "Cerca de" por cada lugar seleccionado, ahora se juntan en una sola oración |
| Detección de fraude e IA al publicar | ✅ COMPLETO | `analizarFraude`/`analizarImagenPropiedad` (OpenRouter/Gemini) — el backend también rechaza casos extremos de forma independiente (confirmado en vivo) |
| **Persistencia en base de datos** | ✅ COMPLETO | **Corrección de esta auditoría — era el único bloqueante que la versión anterior marcaba, y ya está resuelto.** `POST /propiedades` real contra el backend, confirmado en vivo repetidas veces esta sesión (crear/editar/pausar/archivar/eliminar) |
| **Storage de fotos** | ✅ COMPLETO | **Corrección de esta auditoría.** `POST /propiedades/fotos` (multipart) sube a Cloudinary real — el servidor re-analiza cada foto con Gemini antes de aceptarla. `Property.fotos` guarda URLs reales, nunca base64 |
| Límite de propiedades activas/pausadas (plan gratuito) | ✅ COMPLETO | 3 propiedades, deduplicado y con test unitario (`useLimitePropiedades.test.ts`) — no estaba en el spec original |
| Página de gestión de mis publicaciones | ✅ COMPLETO | `/dashboard/propiedades` — editar/pausar/reactivar/archivar/destacar/eliminar, contra backend real |

---

## Módulo 9 — Guías / Blog Editorial

**Objetivo negocio:** SEO y autoridad. Contenido útil posiciona la marca y atrae tráfico orgánico.

| Feature | Estado | Notas |
|---|---|---|
| Listado `/guias` por categoría | ✅ COMPLETO | Ruta renombrada de `/blog` a `/guias` (2026-08-23) |
| Detalle `/guias/[slug]` | ✅ COMPLETO | |
| Artículos relacionados | ✅ COMPLETO | |
| Contenido estático en JSON | ✅ COMPLETO | `guias.json` — sin cambios de arquitectura |
| **CMS o edición sin deploy** | ❌ PENDIENTE | Sigue requiriendo editar JSON directo, sin re-verificar a fondo en esta auditoría — no hay evidencia de que haya cambiado |

---

## Módulo 10 — Dashboard de Usuario

**Objetivo negocio:** Retención. El panel resume el valor que el usuario tiene en la plataforma.

| Feature | Estado | Notas |
|---|---|---|
| Página `/dashboard` con bienvenida | ✅ COMPLETO | |
| Contactos recibidos (dueños/profesionales) | ✅ COMPLETO | Real, confirmado en vivo 2026-09-02 — reemplaza el viejo `GET /api/me/stats` (ese endpoint ya no existe, confirmado 404 en esta auditoría; los números reales ahora vienen de `/propiedades/mias`) |
| Vistas totales (dueños/profesionales) | ❌ PENDIENTE | Sigue sin conteo real agregado — el propio dashboard lo declara explícitamente en su UI ("las vistas totales todavía no, llegan cuando el backend implemente ese conteo") |
| Propiedades vistas recientemente (cualquier cuenta) | ✅ COMPLETO | `/dashboard/recientes`, basado en `localStorage` del propio navegador — corregido 2026-09-03 (antes mandaba al catálogo completo, no a lo realmente visto) |
| Quick actions | ✅ COMPLETO | Links a favoritos, alertas, publicar |
| Mis publicaciones | ✅ COMPLETO | `/dashboard/propiedades`, ver Módulo 8 |
| Bandeja de mensajes (conversaciones) | ✅ COMPLETO | `/dashboard/mensajes`, chat SSE — no estaba en el spec original |
| Instalación como app (PWA) | ✅ COMPLETO | Ícono + modal de confirmación, solo con sesión iniciada, desaparece al instalar — no estaba en el spec original, construido 2026-09-02 |
| Botón "atrás" cuando corre instalada | ✅ COMPLETO | Sin chrome de navegador en standalone (iOS/Android/escritorio) no hay botón atrás nativo — construido 2026-09-03 |

---

## Módulo 11 — SEO y Rendimiento

| Feature | Estado | Notas |
|---|---|---|
| Metadata dinámica (propiedades, zonas) | ✅ COMPLETO | |
| Metadata estática (homepage, guías) | ✅ COMPLETO | |
| generateStaticParams (SSG) | ✅ COMPLETO | propiedades, zonas, guías |
| OpenGraph images | ✅ COMPLETO | **Corrección de esta auditoría** — la versión anterior decía "imagen estática genérica"; hoy `buildPropertyMetadata` usa la foto real de la propiedad como imagen OG, con fallback genérico solo si no hay foto |
| Canonical URLs | ✅ COMPLETO | |
| Sitemap.xml | ✅ COMPLETO | Dinámico, incluye propiedades/municipios/zonas — bug de `localhost` en producción corregido 2026-09-02 |
| Robots.txt | ✅ COMPLETO | Bloquea rutas privadas |
| Structured data (JSON-LD) | ✅ COMPLETO | **Corrección de esta auditoría** — implementado en `src/lib/seo.ts`, la versión anterior decía "❌ PENDIENTE" |
| Instalabilidad PWA (manifest, service worker, iconos) | ✅ COMPLETO | Sin caché offline a propósito (documentado en `public/sw.js`) — no estaba en el spec original |

---

## Pendientes reales (ya no "bloqueantes de lanzamiento")

Todo lo que la versión anterior marcaba como bloqueante ya se resolvió, incluida la verificación de correo (construida 2026-09-03). Lo que queda es una lista corta y no urgente:

1. **Vistas totales agregadas en el dashboard** — contactos ya son reales, vistas no.
2. **CMS de guías** — sigue siendo edición manual de JSON.
3. **Auditoría de seguridad general** — ver `docs/PLAN-AUDITORIA-FASE1-MVP.md` para hallazgos previos no verificados en esta pasada.
4. **Confirmar con backend la URL del link de verificación de correo** — ver `docs/BACKEND-VERIFICACION-CORREO-03092026.md`.

Nada de esto bloquea considerar Fase 1 funcionalmente completa.

---

## Stack Técnico Fase 1 (actualizado 2026-09-03)

| Layer | Tecnología |
|---|---|
| Frontend | Next.js 16 App Router + TypeScript |
| Estilos | Tailwind CSS v4 |
| Mapas | Leaflet + leaflet.markercluster, tiles Esri (calles y satélite) |
| Auth | JWT propio del backend (cookie HttpOnly), no vive en `src/app/api/` |
| Backend | **Proyecto separado** (NestJS/Prisma), CORS restringido al origen de producción — `https://api.vivevillahermosa.corestacksolutions.com.mx/api/v1` |
| Forms | react-hook-form + zod v4 |
| IA texto | OpenRouter (búsqueda inteligente, fraude, descripciones) — auditado en vivo 2026-09-03 |
| IA visión | Gemini (análisis de fotos) |
| Storage fotos | ✅ Cloudinary, real |
| Email | ✅ Resend (alertas, recuperación de contraseña, contacto de propiedad) |
| Push | ✅ Web Push con VAPID real |
| Mensajería | SSE (Server-Sent Events) por conversación abierta, no WebSocket permanente — decisión de costo/escala |
| Deploy | ✅ Cloudflare Workers (`opennextjs-cloudflare`), dominio propio |
