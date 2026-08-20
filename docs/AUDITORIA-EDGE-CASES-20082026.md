# Auditoría intensiva de edge cases — 2026-08-20

Auditoría de toda la plataforma (frontend), 4 pases en paralelo por área funcional: autenticación/RBAC, búsqueda IA/moderación, publicar/dashboard/favoritos/alertas, mapa/zonas/servicios/UI. Metodología: rigor de auditor senior (severidad, evidencia file:line, escenario de falla concreto, causa raíz, fix recomendado).

**Límite de alcance:** el backend real es un repo NestJS separado, no incluido aquí. Todo lo relacionado a matching de IA, el sistema de 3 avisos de moderación de búsqueda, rate limiting real y parseo de precios vive ahí — no se pudo auditar con evidencia file:line desde este repo. Se anota explícitamente dónde aplica.

## Ya corregido en esta sesión (commit `77fa69c`)

| Severidad | Hallazgo | Fix |
|---|---|---|
| 🔴 Crítico | `wa.me` nunca recibía el código de país (52) — el formulario pide el teléfono a 10 dígitos "sin +52" y ese valor se mandaba crudo a WhatsApp. **Todo botón de WhatsApp del sitio (propiedades y servicios) generaba un link inválido.** | `src/lib/phone.ts` (nuevo helper `whatsappUrl()`), usado en `AgentCard.tsx` y `ServiceContactCard.tsx`. |
| 🟠 Alto | `dashboard/leads` mostraba datos de muestra fabricados a **cualquier cuenta**, sin importar el rol — sin el mismo guardia de `esProfesional`/`buscador` que ya tienen `dashboard/citas` y `dashboard/propiedades`. | Guardia de rol + skeleton de carga agregado, igual patrón que `citas/page.tsx`. |
| 🟡 Medio | Mismo hueco en `dashboard/analitica` y `dashboard/equipo` (este último 100% datos falsos en localStorage, ni siquiera llama al backend). | Mismo guardia aplicado a ambas páginas. |
| 🟡 Medio | `FavoriteButton` sin `disabled` durante la petición — doble clic rápido podía disparar dos toggles superpuestos con respuestas fuera de orden. | `disabled={pending}` agregado al botón. |

## Pendiente — requiere decisión de producto o backend

### Mapa / Zonas / Servicios / UI

| Severidad | Hallazgo | Evidencia |
|---|---|---|
| 🟠 Alto | `/mapa` filtra propiedades contra coordenadas **reales** (`p.lat`/`p.lng`) pero dibuja los pines con coordenadas **enmascaradas** (`p.latPublico`/`p.lngPublico`, hasta ~1.3km de diferencia). El contador de "N propiedades en esta zona" y los pines visibles pueden no coincidir tras un pan/zoom. | `MapaClient.tsx:59-61` (filtro) vs. `:187-193` (render) |
| 🟡 Medio | `/mapa` sin mensaje de estado vacío cuando los filtros dan 0 resultados — mapa en blanco sin guía para limpiar filtros. | `MapaClient.tsx` |
| 🟡 Medio | Botones flotantes del mapa (fullscreen, favoritos, satélite, geolocalizar) a 40×40px, bajo el mínimo táctil de 44×44px. | `MapaClient.tsx:509,526,546,562` |
| 🟡 Medio | Botones de cerrar solo-ícono sin `aria-label` — lector de pantalla anuncia "botón" sin contexto. | `SelectedPropertyCard.tsx:53-59`, `MapaClient.tsx:635-637` |
| 🟡 Medio | Drawer de filtros móvil sin trampa de foco, sin `Escape`, sin devolver el foco al botón que lo abrió. | `MapaClient.tsx:629-649` |
| 🟢 Bajo-Medio | Búsqueda de proximidad por colonia sin tolerancia a errores de tipeo — un nombre mal escrito devuelve "sin resultados" en silencio, sin sugerencia. | `colonias.ts:414-420` (`matchColonia`) |
| 🟢 Bajo | Filtrado por límites del mapa sin debounce — cada paso de pan/zoom reconstruye el array de marcadores completo. Sin costo de red hoy, pero visible con más inventario. | `MapaClient.tsx:160-174` |

**Verificado correcto, sin hallazgo:** municipios/colonias sin propiedades no fabrican un marcador `$0` (fix previo se mantiene); coordenadas inválidas se descartan por marcador sin tumbar el mapa completo; `PropertyCard` maneja bien foto faltante, precio 0/null, títulos largos.

### Autenticación / Sesión / Admin

| Severidad | Hallazgo | Evidencia |
|---|---|---|
| 🟡 Medio | No existe un punto central de protección de rutas — cada árbol (`admin`, `dashboard`, `alertas`, `favoritos`, `publicar`) valida sesión en su propio `layout.tsx`. Las 6 rutas actuales están bien cubiertas, pero una ruta nueva sin su propio guardia queda desprotegida por omisión (antes había un `PROTECTED_PATHS` centralizado en `proxy.ts`, retirado porque Next.js 16 fuerza runtime Node en el proxy y `@opennextjs/cloudflare` todavía no lo soporta — cambio de arquitectura documentado, no un bug redescubierto). | `src/app/{admin,dashboard,alertas,favoritos,publicar}/layout.tsx` |
| 🟡 Medio | `logout()` sin manejo de errores — si `/auth/logout` falla, `setUser(null)` nunca corre y la UI sigue mostrando la sesión como activa. Relevante en equipo/computadora compartida. | `AuthContext.tsx:55-58`, `Navbar.tsx:112-116` |
| 🟡 Medio | Sin sincronización de sesión entre pestañas — cerrar sesión (o ser bloqueado/degradado por un admin) en una pestaña no actualiza otra pestaña abierta hasta que navegue y fuerce un re-render server-side. | `AuthContext.tsx` (sin listener `storage`/`visibilitychange`) |
| 🟡 Medio | Un admin puede bloquearse o quitarse su propio rol de admin sin ninguna advertencia especial — mismo modal genérico que para cualquier otra cuenta. Riesgo real de auto-bloqueo si es el único admin. | `admin/usuarios/page.tsx:40-51,140-155,210-217` |
| 🟢 Bajo | Promover/revocar admin no exige motivo, a diferencia de bloquear (que sí exige ≥5 caracteres) — inconsistente dado que otorgar admin es de mayor impacto. | `admin/usuarios/page.tsx:61-64` |

**Verificado correcto:** `safeRedirectPath` bloquea correctamente payloads `//` y `://` — sin open-redirect; edición de propiedad depende del backend para 403/404 por dueño, no de un chequeo de id en el cliente — sin IDOR de frontend.

### Búsqueda IA / Moderación

| Severidad | Hallazgo | Evidencia |
|---|---|---|
| 🟡 Medio | Reintento automático ciego ante **cualquier** falla que no sea 429 (error de red, 400, 500, timeout) — duplica el costo por request contra la API de OpenRouter y puede mantener una búsqueda abierta hasta ~24.4s. | `interpretarBusqueda.ts:83-91` |
| 🟡 Medio | Sin límite de longitud en el input de búsqueda IA — un string de varios KB/MB pegado se manda tal cual al backend, potencialmente dos veces (ver hallazgo anterior). | `SearchBar.tsx:134-139`, `PropertiesClient.tsx:256-258` |
| 🟡 Medio | Moderación de fotos por IA "fail-open" determinista: cualquier error en la llamada a Gemini (imagen corrupta, formato rechazado) devuelve automáticamente `apta: true` — una foto que rompe el análisis pasa la revisión con cero señales, en vez de quedar marcada para revisión manual. | `PublishForm.tsx:43-58` |
| 🟢 Bajo | Umbral de "oración larga" (5 palabras) comparte lógica entre búsqueda de texto y extracción IA; una consulta corta tipo jailbreak que la IA no logra interpretar cae a filtro de texto literal y se persiste en `localStorage` como sugerencia futura. | `interpretarBusqueda.ts:106-108` |
| ℹ️ Informativo | Pendiente de auditoría directa en el repo backend: parseo de precios (rangos, decimales, "1.5m"), timing exacto del 3er aviso de moderación, si cuentas anónimas pueden abusar sin acumular avisos, y si la vulnerabilidad de spoofing de `X-Forwarded-For` (ya corregida en las rutas de búsqueda) se repite en alguna ruta no cubierta. | — |

### Publicar / Favoritos / Alertas (restante)

| Severidad | Hallazgo | Evidencia |
|---|---|---|
| 🟡 Medio | Favoritos huérfanos (propiedad borrada/archivada por su dueño) se descartan en silencio — el contador de favoritos simplemente encoge sin explicación. | `favoritos/page.tsx:38` |
| 🟡 Medio | Doble clic rápido en "eliminar" alerta puede disparar un segundo `DELETE` sobre un id ya borrado, que falla en servidor y muestra un toast de error engañoso aunque el borrado original sí funcionó. | `alertas/page.tsx:95-106` |
| 🟡 Medio | Una alerta completamente vacía (sin ningún filtro) es válida y coincide con **toda** publicación futura — sin confirmación ni detección de duplicados casi idénticos. | `alertas/page.tsx:16-23,71-93,139` |
| 🟡 Medio | Fechas (`expiraEn`, `createdAt`) formateadas con `toLocaleDateString` sin `timeZone` explícito — un valor UTC medianoche puede mostrarse un día antes en horario de Tabasco (UTC-6). Mismo patrón en blog y portafolio de servicios. | `alertas/page.tsx:248-249`, `blog/page.tsx:62`, `blog/[slug]/page.tsx:59`, `dashboard/servicios/[id]/portafolio/page.tsx:203` |
| 🟡 Medio | Archivos no-imagen que pasan el chequeo de tipo MIME del navegador (basado en extensión, no contenido) fallan al decodificar y caen en el mismo `catch` "fail-open" que los errores de red — un archivo corrupto/falso nunca se marca como sospechoso. | `PublishForm.tsx:43-58` (`addFiles` línea 169) |
| 🟡 Medio | Si el redimensionado/subida de una foto falla al publicar, se descarta en silencio (`Promise.allSettled` + filtro) — la propiedad se publica con menos fotos de las seleccionadas, sin aviso. | `PublishForm.tsx:424-439` |
| 🟢 Bajo | `precio` en el esquema de publicar tiene piso pero no techo — un valor absurdamente alto pasa validación de cliente y llega sin tope a formateo/layout. | `publishSchema.ts:28` |
| 🟢 Bajo | "Deshacer" en alertas usa un `catch` genérico que no inspecta el cuerpo del error (a diferencia de `PublishForm`) — si el backend rechaza la recreación (límite, TTL), el usuario solo ve "No se pudo restaurar" sin razón. | `alertas/page.tsx:111-129` |

**Verificado correcto:** límite de propiedades activas (3) y de fotos (5) coinciden entre comentario y código — sin discrepancia.

## Resumen — qué priorizar después

1. **Coordenadas mapa (real vs. pública)** — es el único hallazgo pendiente de severidad Alta; afecta confianza en el conteo/pines del mapa.
2. **Fail-open de moderación de fotos y archivos no-imagen** — dos hallazgos relacionados en `PublishForm.tsx`, mismo mecanismo (`catch` → aprobado por defecto); vale la pena resolverlos juntos.
3. **Timezone en fechas** — afecta varias páginas con el mismo patrón, fix es mecánico (agregar `timeZone: 'America/Mexico_City'`) y de bajo riesgo.
4. El resto son mejoras de accesibilidad/UX del mapa (foco, aria-label, touch targets) y hallazgos backend-owned que requieren pasar este documento al repo de NestJS.
