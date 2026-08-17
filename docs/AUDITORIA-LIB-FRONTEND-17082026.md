# Auditoría de `src/lib` — código huérfano y lógica de backend en el frontend

> **Pedido:** por qué hay tantos archivos en `/lib`, si alguno es lógica que debería vivir en el backend, y limpiar lo que ya no se usa. Auditoría de los 37 archivos de `src/lib` (36 antes de esta pasada, ver más abajo) más `src/app/api`, con acciones aplicadas donde fue seguro y documentación donde requiere una decisión más grande.
>
> **Metodología:** conteo real de importadores por archivo (`grep` de cada `from '@/lib/X'` en todo `src`), lectura del propósito documentado de cada archivo con 0-2 importadores, verificación contra `git log` cuando el motivo de la orfandad no era obvio. Nada se borró sin confirmar cero referencias primero.

## 1. Archivos huérfanos — borrados (2026-08-17)

Cero importadores en todo el proyecto, confirmado con `grep` antes de tocar nada:

| Archivo | Por qué quedó huérfano |
|---|---|
| `src/lib/aiTimeout.ts` | Se documentaba a sí mismo como "compartido entre `geminiClient.ts`/`openRouterClient.ts`" — ninguno de los dos existe ya, se borraron cuando las funciones de IA se migraron al backend (commits de esta misma migración). |
| `src/lib/rateLimit.ts` | Se autodocumentaba explícitamente como *"mitigación PROVISIONAL del lado del frontend MIENTRAS NO EXISTA un backend real"*. Ese backend ya existe — el rate limiting real ahora vive ahí. Las 16 rutas que antes lo usaban (`/api/ia/*`, `/api/propiedades/*/contacto`, etc.) ya no existen en este repo (ver §2). |
| `src/lib/zonas-gis.ts` | Detección de riesgo de inundación por GIS, superseded por el enfoque de texto/heurística que sí sigue vivo en `zonas-inundacion.ts` (2 importadores reales, se queda). |

Verificado después de borrar: `npx tsc --noEmit` limpio, `npx eslint` limpio, servidor de desarrollo levantado, rutas clave (`/`, `/propiedades`, `/publicar`, `/dashboard/propiedades`) responden igual que antes.

## 2. `src/app/api` — casi todo ya se migró, y está bien así

Hoy **solo existe una ruta**: `/api/health` (agregada 2026-08-17, ver `docs/PLAN-AUDITORIA-FASE1-MVP.md` hallazgo #14). Todo lo demás (`/api/admin/*`, `/api/ia/*`, `/api/propiedades/*`, `/api/servicios/*`, `/api/colonias/*`, `/api/cuenta/*`, `/api/alertas/*`, `/api/me/*`) ya no existe — confirmado con `find src/app/api -name route.ts`.

**Esto no es un hallazgo, es la confirmación de que la migración a backend real ya está prácticamente completa a nivel de rutas.** Se verificó específicamente el caso que parecía más riesgoso — el panel `/admin/*` (páginas que siguen existiendo) — y ya llama a `backendFetch('/admin/...')` directo contra el backend real, no a una ruta local borrada. No quedó ninguna página huérfana apuntando a una API que ya no existe (`grep` de `fetch('/api/` en todo `src` — 0 resultados).

También confirmado: `prisma`/`@prisma/client` ya no están ni en `package.json` ni en ningún import — la limpieza del commit `030c137` fue completa, no quedó nada dangling.

## 3. Archivo renombrado — el nombre mentía sobre el contenido

**`src/lib/misPropiedadesDemo.ts` → `src/lib/misPropiedades.ts`** (7 importadores actualizados: `dashboard/analitica`, `dashboard/page.tsx`, `dashboard/propiedades/page.tsx`, `OwnerActionsBar.tsx`, `usePropiedadEstado.ts`, `aiClient.ts`, `reportePdf.ts`).

El archivo mapea datos **reales** de `GET /propiedades/mias` (backend real) — el "Demo" del nombre quedó de una época anterior y ya no describe el contenido. Solo 3 campos (`vistas`, `contactos`, `favoritos`) siguen hardcodeados en 0 porque no existe tabla de eventos real todavía — eso ya estaba correctamente documentado en el propio código (`BACKEND.md §12`), el problema era solo el nombre del archivo generando la confusión que motivó esta pregunta.

## 4. Simulaciones locales de features sin backend todavía — NO son código huérfano, son Fase 2 real

Estos archivos SÍ se usan (tienen importadores activos, UI real funcionando) pero simulan datos que un backend futuro debería proveer. Es la respuesta directa a "algunos faltan por implementar en el backend" — construir esos backends es un trabajo de feature nuevo, no una migración de algo que ya existe (a diferencia de landmarks/colonias/propiedades, que sí tenían un backend real esperando el corte). No se tocaron — borrarlos rompería UI que funciona hoy, aunque sea con datos de vista previa.

| Archivo | Qué simula | Persistencia | Ya documentado como pendiente |
|---|---|---|---|
| `equipoDemo.ts` | Gestión de equipo/agentes de una inmobiliaria | `localStorage` (`readJson`/`writeJson`) | Sí — `PlanesInmobiliaria`/equipo es Fase 2, `docs` previos ya lo marcan oculto |
| `leadsDemo.ts` | CRM de leads (nuevo → contactado → cerrado) | `localStorage` | Mismo caso — módulo de CRM nunca tuvo backend |
| `verificacionDemo.ts` | Verificación de documentos de agencia | `localStorage` | Sí, el propio archivo dice *"⚠️ Vista previa — no hay revisión real de documentos"* |
| `contentModeration.ts` | Detección heurística de lenguaje discriminatorio en anuncios | No aplica (solo advierte, no bloquea) | Sí, el propio archivo dice *"⚠️ BACKEND PENDIENTE (Fase 2)... trivialmente evitable"* |
| `analiticaDemo.ts` | Serie de vistas/contactos por propiedad (gráfica del dashboard) | Generada, no persistida (determinística por id) | Sí, *"⚠️ DATOS DE MUESTRA — no hay tabla de eventos real"* |

**Nota sobre `analiticaDemo.ts` específicamente — ahora sí hay un camino real, pero no es trivial.** Con PostHog ya conectado hoy (`docs/PLAN-AUDITORIA-FASE1-MVP.md` hallazgo #8), en principio se podría reemplazar esto con datos reales — pero requeriría (a) un evento `propiedad_vista` con el id de la propiedad, que no existe todavía, más historial acumulado real, y (b) integrar la API de consultas de PostHog (necesita una key privada, no se puede exponer directo al navegador — implicaría una ruta propia o que el backend la exponga). Es una feature nueva, no un cambio de una línea — se documenta aquí para que quede como decisión consciente de alcance, no se implementa sin que se confirme que vale la pena ahora.

## 5. El resto de `src/lib` — revisado, todo es frontend legítimo

Los ~28 archivos restantes se revisaron por propósito (no solo por conteo de importadores) y son responsabilidades de frontend reales, no lógica de backend fugada:

- **Wrappers delgados contra el backend real** (correcto que vivan aquí): `api.ts`, `backendApi.ts`, `backendApiServer.ts`, `auth.ts`, `colonias.ts`, `landmarks.ts`, `interpretarBusqueda.ts`, `aiClient.ts`.
- **Formularios/validación de UX** (espejo del lado del cliente de lo que el backend valida de verdad — mejora la experiencia, no reemplaza la validación server-side): `publishSchema.ts`, `publishServicioSchema.ts`.
- **Presentación pura**: `format.ts`, `seo.ts`, `floodColors.ts`, `propertyTypeConfig.ts`, `servicios.ts`.
- **Utilidades de navegador**: `localStore.ts`, `recentSearches.ts`, `recentlyViewed.ts`, `safeRedirect.ts`, `authRedirect.ts`, `imageResize.ts`.
- **Datos de referencia estática que no necesitan backend** (afectan solo UX de auto-relleno, el backend nunca necesita conocerlos — a diferencia de landmarks/colonias, que sí eran catálogos que el backend también necesitaba validar): `zonas-inundacion.ts` (Atlas de Riesgos oficial citado con fuente académica), `tabascoBoundary.ts`.
- **Generación de reportes/PDF**: `reportePdf.ts` — renderiza en el navegador, correcto que esté aquí.
- **Filtrado client-side sobre datos ya traídos del backend**: `filters.ts`, `zonasDestacadas.ts` — comparan campos de propiedades ya cargadas, no requieren otra llamada de red.

Ninguno de estos duplica una responsabilidad que el backend deba tener — ya se verificó (§2) que las que sí lo hacían (rate limiting, IA, propiedades, colonias, landmarks) se migraron o se borraron.

## Resumen de acciones

| Acción | Qué | Estado |
|---|---|---|
| Borrar | `aiTimeout.ts`, `rateLimit.ts`, `zonas-gis.ts` | ✅ Hecho, verificado con tsc/eslint/servidor real |
| Renombrar | `misPropiedadesDemo.ts` → `misPropiedades.ts` | ✅ Hecho, 7 importadores actualizados |
| Documentar (sin tocar código) | 5 simulaciones locales de features Fase 2 sin backend (`equipoDemo`, `leadsDemo`, `verificacionDemo`, `contentModeration`, `analiticaDemo`) | ✅ Esta sección — no se implementan solas, son features nuevas de backend, no migraciones |
| Confirmar limpio | `src/app/api` (solo `/api/health` real), Prisma completamente fuera | ✅ Verificado, sin acción necesaria |
