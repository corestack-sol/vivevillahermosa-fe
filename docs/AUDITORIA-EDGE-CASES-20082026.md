# Auditoría intensiva de edge cases — 2026-08-20

Auditoría de toda la plataforma (frontend). **Ronda 1:** 4 pases en paralelo por área funcional (autenticación/RBAC, búsqueda IA/moderación, publicar/dashboard/favoritos/alertas, mapa/zonas/servicios/UI). **Ronda 2:** 4 pases más cubriendo lo que la ronda 1 no tocó (formularios de auth, páginas de admin restantes, servicios del lado profesional + comparar + buscar, home/legal/misc). Metodología: rigor de auditor senior (severidad, evidencia file:line, escenario de falla concreto, causa raíz, fix recomendado).

**Límite de alcance:** el backend real es un repo NestJS separado, no incluido aquí. Todo lo relacionado a matching de IA, el sistema de 3 avisos de moderación de búsqueda, rate limiting real y parseo de precios vive ahí.

**Estado: todo lo resoluble desde este repo está corregido, en ambas rondas.** Lo que falta requiere cambios en el backend — spec redactada en `docs/BACKEND-AUDITORIA-EDGE-CASES-20082026.md` (8 puntos). Este documento se cierra cuando esa spec se implemente allá; hasta entonces queda como registro de qué se auditó y qué sigue pendiente del otro lado. Un punto adicional (recuperación de contraseña) se identificó como una función nueva, no un bug — ver el final de este documento.

## Corregido — frontend (commits `77fa69c`, `2776a38`, `9de747b`, `75f4602`, `1515a2f`, `a90689c`)

| Severidad | Hallazgo | Fix |
|---|---|---|
| 🔴 Crítico | `wa.me` nunca recibía el código de país (52) — **todo botón de WhatsApp del sitio generaba un link inválido.** | `src/lib/phone.ts` (`whatsappUrl()`), usado en `AgentCard.tsx` y `ServiceContactCard.tsx`. |
| 🟠 Alto | `dashboard/leads` mostraba datos fabricados a cualquier cuenta sin gate de rol. | Guardia `esProfesional`/`buscador` + skeleton, mismo patrón que `citas/page.tsx`. |
| 🟠 Alto | `/mapa` filtraba con coordenadas reales pero dibujaba con las públicas — conteo y pines podían no coincidir. | `isInBounds` ahora usa `latPublico`/`lngPublico`. |
| 🟡 Medio | Mismo hueco de gate en `dashboard/analitica` y `dashboard/equipo`. | Mismo guardia aplicado. |
| 🟡 Medio | `FavoriteButton` sin `disabled` durante la petición — doble clic disparaba toggles superpuestos. | `disabled={pending}`. |
| 🟡 Medio | `/mapa` sin estado vacío cuando los filtros dan 0 resultados. | Overlay con CTA para limpiar filtros. |
| 🟡 Medio | Botones flotantes del mapa a 40×40px, bajo el mínimo táctil. | 44×44px + `aria-label` en los 4 botones. |
| 🟡 Medio | Botones de cerrar solo-ícono sin `aria-label`. | Agregado en `SelectedPropertyCard` y el drawer móvil. |
| 🟡 Medio | Drawer de filtros móvil sin `Escape`, sin devolver el foco. | `Escape` cierra, foco entra al abrir y vuelve al botón que lo abrió. |
| 🟡 Medio | `logout()` sin manejo de error — UI seguía mostrando sesión activa si el servidor fallaba. | `setUser(null)` en `finally`; `Navbar` avisa por toast si el servidor falló. |
| 🟡 Medio | Sin sync de sesión entre pestañas. | `AuthContext` revalida en `visibilitychange`. |
| 🟡 Medio | Admin podía bloquearse/revocarse a sí mismo sin advertencia. | Banner + checkbox de confirmación explícita cuando el objetivo es la propia cuenta. |
| 🟡 Medio | Reintento ciego de búsqueda IA ante cualquier falla no-429. | Solo reintenta cuando `status` es `undefined` (red/timeout real). |
| 🟡 Medio | Sin límite de longitud en el input de búsqueda IA. | `MAX_QUERY_LENGTH` (200) en ambos inputs + recorte defensivo. |
| 🟡 Medio | Favoritos huérfanos se descartaban en silencio. | Aviso "N favoritos ya no disponibles" cuando aplica. |
| 🟡 Medio | Doble clic en eliminar alerta → toast de error engañoso. | Guardia contra doble-delete mientras la petición está en curso. |
| 🟡 Medio | Alerta vacía (sin filtros) se creaba sin confirmación. | Confirmación explícita antes de crear una alerta que coincide con todo. |
| 🟡 Medio | Fechas sin `timeZone` explícito — posible día de diferencia. | `timeZone: 'America/Mexico_City'` en alertas, blog y portafolio de servicios. |
| 🟡 Medio | Archivo no-imagen renombrado pasaba el chequeo de MIME type. | `addFiles` valida con `createImageBitmap()` real antes de aceptar. |
| 🟡 Medio | Fotos que fallan al subir se descartaban en silencio. | Toast avisando cuántas fotos no se pudieron subir. |
| 🟢 Bajo-Medio | Búsqueda de proximidad por colonia sin tolerancia a typos. | Fallback por distancia de edición, solo si hay un único candidato. |
| 🟢 Bajo | Filtrado por límites del mapa sin debounce. | 150ms de debounce en cambios de bounds. |
| 🟢 Bajo | Promover/revocar admin no exigía motivo. | Ahora lo exige, igual que bloquear. |
| 🟢 Bajo | `precio` sin techo en el esquema de publicar. | Máximo $500M MXN. |
| 🟢 Bajo | "Deshacer" en alertas con `catch` genérico. | Muestra el mensaje real del servidor (`BackendApiError`). |

**Revisado, sin cambio necesario:** umbral de "oración larga" y su persistencia en `localStorage` — comportamiento esperado, no distinguible de una búsqueda corta normal sin arriesgar romper casos legítimos.

**Documentado, sin refactor (riesgo/beneficio no lo justifica):** ausencia de un punto central de protección de rutas (cada `layout.tsx` valida sesión por separado desde que `proxy.ts` se retiró por incompatibilidad de runtime con Cloudflare — cambio de arquitectura ya documentado en `dashboard/layout.tsx`, no un bug). El hueco real es de granularidad de rol (una página profesional nueva podría olvidar el redirect de `buscador`), no de sesión — un refactor de los 6 layouts actuales para forzarlo no se justifica solo por esto; queda como checklist a seguir al agregar una ruta nueva, no como refactor forzado ahora.

**Verificado correcto, sin hallazgo:** `safeRedirectPath` sin open-redirect; edición de propiedad sin IDOR de frontend; límite de propiedades (3) y fotos (5) consistentes; municipios/colonias sin propiedades no fabrican marcador `$0`; `PropertyCard` maneja bien foto/precio faltante y títulos largos.

## Corregido — frontend, ronda 2 (commits `559ce50`, `63667f8`, `f5947f3`, `b884d93`)

| Severidad | Hallazgo | Fix |
|---|---|---|
| 🟠 Alto | Ningún `error.tsx` en todo el sitio — un backend caído tumbaba el Home a la página de error genérica de Next.js. | `src/app/error.tsx` nuevo, mismo estilo visual que `not-found.tsx`, botón "Intentar de nuevo". |
| 🟠 Alto | Login traga en silencio cualquier error que no sea del backend (red/timeout) — el botón dejaba de girar sin mensaje. | Mensaje de fallback agregado, mismo patrón que `registro`. |
| 🟡 Medio | `/api/health` devolvía la URL real del backend a cualquiera sin autenticación. | Ya no se incluye `url` en la respuesta. |
| 🟡 Medio | `/api/health` sin rate limit — un loop externo amplificaba tráfico real contra el backend. | Cache en memoria de 8s por isolate. |
| 🟡 Medio | `safeRedirectPath` no bloqueaba backslashes (`/\evil.com`, normalizable a `//evil.com` por el navegador). | Rechaza cualquier `\` en el path. |
| 🟡 Medio | Registro sin campo de confirmar contraseña — un typo en un campo enmascarado era irrecuperable. | Campo agregado + validación de coincidencia. |
| 🟡 Medio | Usuario ya logueado veía el formulario de login/registro otra vez. | Redirect automático a `next` si ya hay sesión. |
| 🟡 Medio | `admin/servicios`: toggle activo/pausado fallaba en silencio (modal se cerraba como si hubiera funcionado). | Estado de error visible en el modal. |
| 🟡 Medio | `admin/zonas`: lat/lng sin validar — `"abc"` pasaba, `Number("abc")` es `NaN`, se guardaba como `null`. | Validación con `estaEnTabasco()` (rechaza no-numérico y fuera del estado). |
| 🟡 Medio | `admin/solicitudes`: resolvía una apelación sin revalidar contra el servidor — riesgo de dos admins actuando sobre la misma solicitud. | Refetch + chequeo de vigencia justo antes de mutar. |
| 🟡 Medio | `CompareContext`: un id cuya propiedad ya no resuelve quedaba ocupando un slot para siempre. | `prune()` limpia ids muertos del localStorage al cargar `/comparar`. |
| 🟡 Medio | Portafolio de servicios: `MAX_TRABAJOS_POR_SERVICIO` (24) definido pero nunca aplicado ni mostrado. | Botón de subir se deshabilita al llegar al tope, con aviso. |
| 🟡 Medio | `dashboard/perfil` sin aviso de cambios sin guardar. | `beforeunload` + indicador visual cuando hay cambios pendientes. |
| 🟢 Bajo | `admin/zonas`: sin guardia contra ficha duplicada (mismo nombre+municipio); copy de eliminar prometía "inmediato" cuando la página pública cachea hasta 60s. | Guardia agregada; copy corregido. |
| 🟢 Bajo | `admin/intentos-sospechosos`: solo un tooltip nativo para leer un payload largo. | Clic en la fila abre el texto completo en un modal. |
| 🟢 Bajo | `servicios/[id]`: sin defensa si el backend algún día manda `activo: false` en el detalle de un solo recurso. | `ServicioPublico.activo?` opcional respetado, `notFound()` si aplica. |
| 🟢 Bajo | Portafolio de servicios sin toast de éxito al eliminar. | Agregado. |
| 🟢 Bajo | `gracias/page.tsx` confiaba en la forma de `sessionStorage` sin type-guard. | `typeof parsed?.id === 'string'` antes de usarlo. |
| 🟢 Bajo | Comentario en `imageResize.ts` apuntaba a una ruta de este repo que ya no existe. | Corregido — backend es proyecto separado. |

**Revisado, sin cambio necesario:** formato PNG del logo de perfil se queda igual a propósito (necesita transparencia; cambiar a JPEG lo hubiera roto) — la sugerencia original de la auditoría de cambiar a JPEG era incorrecta para este caso específico.

**Verificado correcto, sin hallazgo (ronda 2):** Home/Nosotros sin estadísticas fabricadas (`getStats()` real); privacidad/términos sin lorem ni links rotos; `/buscar` reenvía todos los query params a `/propiedades` sin divergencia; `servicios/planes` estático y consistente; `PublishServicioForm` bloquea doble-submit; `dashboard/servicios` gate de permiso correcto vía patrón `undefined`/`null`.

**Identificado como función nueva, no un bug — no se construyó en esta auditoría:** no existe ningún flujo de recuperación de contraseña (`/auth/login`, `/auth/registro` sin link "olvidé mi contraseña", sin ruta de reset en todo el árbol). Combinado con el nuevo campo de confirmar-contraseña, el riesgo de un typo irrecuperable baja, pero la ausencia total de recuperación sigue siendo un hueco real de producto — requiere una función nueva (página + emails + tokens de reset, posiblemente backend), no un fix de una línea. Recomendado como ítem de roadmap aparte.

## Pendiente — requiere backend (ver `docs/BACKEND-AUDITORIA-EDGE-CASES-20082026.md`, 8 puntos)

| # | Punto |
|---|---|
| 1 | Fail-open de moderación de fotos por IA — marcar para revisión manual en vez de aprobar sin señal cuando la IA falla |
| 2 | Confirmar validación de contenido real de archivo (magic bytes) en `POST /propiedades/fotos` |
| 3 | Techo de precio también server-side en `POST /propiedades` |
| 4 | Auto-revocación del último admin — rechazar en servidor, no solo advertir en UI |
| 5 | Auditoría directa en el repo NestJS: parseo de precios de la IA, timing del 3er aviso de moderación, bypass anónimo del sistema de avisos, spoofing de `X-Forwarded-For` en rutas no cubiertas |
| 6 | Admin no puede ver una propiedad reportada si el dueño la pausó (404 blind resolve) |
| 7 | Dueño puede deshacer una pausa de moderación de servicios reactivando desde su propio panel |
| 8 | Log de auditoría sin paginación — techo fijo de 200, sin forma de ver acciones más viejas |
