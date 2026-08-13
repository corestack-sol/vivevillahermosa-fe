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

## 📋 Registro de cambios de hoy (2026-08-13, continuación) — §9.3 construido: colonias con ficha, curadas desde /admin

**Se resuelve la decisión de producto que §9.3 dejaba abierta (ver la entrada de más abajo, "Único pendiente genuino... sigue esperando la decisión de producto") — ya no queda ningún pendiente genuino del contrato documentado.** La pregunta era: cuando una colonia *descubierta* (§9, sin página propia) se gana un lugar en el ranking de demanda real (§9.1), ¿el sistema le crea una ficha (`/zonas/[slug]`) sola, o la curación sigue siendo humana? **Decisión confirmada con el usuario: Opción B — la curación sigue siendo humana** (foto real, texto de §9.2 revisado — evita publicar páginas a medias con contenido genérico, mismo criterio que ya aplicó esta plataforma para no fabricar el badge de "tendencia" antes de tener datos reales), pero el mecanismo deja de ser "editar `zones.json` a mano + deploy" y pasa a un CRUD real en `/admin/zonas`.

**Backend** (`ColoniaFicha`, nuevo módulo `ZonasModule` + `AdminColoniasService`): `GET /zonas/colonias`/`:slug` (públicos, mismo cache que `/colonias/descubiertas`), y bajo `admin/zonas/colonias` el CRUD completo + `POST .../fotos` (Cloudinary, sin moderación IA — admin de confianza, mismo criterio que `/servicios/fotos`) + `GET .../pendientes` — cruza el ranking de `ColoniasTendenciaService` (§9.1) contra las fichas existentes y expone las colonias con demanda real que todavía no tienen ficha, sin crear nada sola: es la señal para que un admin decida con datos. Auditoría en `AccionAdmin` en cada escritura. Verificado en vivo con `curl`: crear/editar/borrar con foto real, 401/403 sin sesión/sin `esAdmin`, 409 en slug duplicado, y `pendientes` reflejando correctamente una colonia con `SolicitudColonia` real que aún no tiene ficha.

**Frontend:** `getAllZones()`/`getZoneBySlug()` (`src/lib/api.ts`) dejaron de leer `src/data/zones.json` (borrado) y ahora llaman al backend real — mismas firmas de función, así que `zonas/page.tsx`, `sitemap.ts` y `ColoniaCard` no necesitaron cambios más allá de `await`. `zonas/[slug]/page.tsx` sigue con `generateStaticParams` + `revalidate = 60`, pero ahora contra datos reales: verificado en vivo que una colonia creada después del build se renderiza on-demand en su primera visita (`dynamicParams` en su default) sin necesitar rebuild. Página nueva `/admin/zonas` (tabla, formulario con subida de foto en dos pasos igual que el portafolio de servicios, sección de "pendientes" con atajo para precargar el formulario) — mismo patrón que el resto de `/admin`.

**Fuera de alcance a propósito:** los 17 municipios (`municipalities.json`) siguen como catálogo estático — es una lista fija que no crece, sin la presión de mantenimiento que sí tenían las colonias. Ver §9.3 actualizada más abajo para el contrato completo.

---

## 📋 Registro de cambios de hoy (2026-08-13) — `src/app/api/` queda vacío: las 2 últimas rutas huérfanas se cortan al backend

Auditoría de estado real del backend (código, no solo este documento) encontró que, de los puntos que el propio doc marcaba como pendientes, prácticamente todo ya estaba construido — incluidos varios ítems de §14 (verificación de email, revocación de sesiones, PostgreSQL, CORS) que ninguna entrada de este changelog había registrado explícitamente. El único hallazgo real de "backend existe, frontend no cortó" fueron 2 rutas: `GET /colonias/descubiertas` y `POST /cuenta/solicitar-revision`, ambas ya completas del lado de `ColoniasController`/`CuentaController` desde hace varias fases. Se migraron a `backendFetch` — ver detalle en §13, punto 1. Con esto, `src/app/api/**` (el punto 1 de §13) queda en cero: no hay ninguna ruta de Next.js real restante.

**Único pendiente genuino de todo el contrato documentado, no tocado hoy:** §9.3 (catálogo de municipios/colonias con ficha en BD) — sigue esperando la decisión de producto que ya estaba abierta.

---

## 📋 Registro de cambios de hoy (2026-08-12/13) — §11 construido: directorio de servicios ya no está en pausa

**Se retoma §11 (en pausa desde el 2026-08-06) — el bloqueador original ("compite por tiempo con cerrar Property") ya no aplica, Property lleva semanas 100% migrado.** Corte completo: backend nuevo (`ServiciosModule`, `AdminServiciosService`) + frontend (las 6 páginas que ya existían en Next.js — lista, ficha, publicar, "Mis servicios", portafolio, admin) apuntando al backend nuevo. `src/app/api/servicios/**` y `src/app/api/admin/servicios/**` se borraron por completo.

**Backend** — replica el contrato completo de §11 sobre el modelo ya documentado (`ServicioProveedor`/`TrabajoServicio`, antes solo en el prototipo Next.js):
- Los 11 endpoints de la tabla de §11, incluido el tope atómico de 24 fotos por portafolio (`$transaction` con conteo+creación en el mismo paso — mismo patrón ya probado en `admin-usuarios.service.ts` para "último admin").
- `GET /servicios/:id/contacto` usa el mismo rate limit doble (IP **y** userId, 30/10min) que ya exige §10 para propiedades — el prototipo en Next.js solo tenía el de IP; se corrige aquí porque §11 dice explícitamente "mismo patrón que propiedades".
- **Desviación deliberada del prototipo, documentada:** `foto`/`imagen` ahora son URLs reales de Cloudinary (`POST /servicios/fotos`, mismo `StorageService` que ya usa Property) en vez de `fotoDataUrl`/`imagenDataUrl` (base64 inline en la fila) — evita meter un segundo patrón de blob-en-BD nuevo cuando Property ya resolvió esto. `foto` del proveedor nunca tuvo UI para llenarse en el prototipo (campo muerto, siempre `null`) — se mantiene el campo pero no se agregó UI nueva para no expandir el alcance de una migración.
- **Bug real encontrado y corregido, no heredado del prototipo:** `CreateServicioDto.email` con `@IsOptional() @IsEmail()` rechazaba `''` (string vacío) con 400 — `@IsOptional()` de class-validator solo perdona `undefined`/`null`, no `''`, y el formulario manda `''` para un campo opcional vacío. El prototipo en Next.js no tenía este bug (`zod`, `.optional().or(z.literal(''))`). Corregido con un `@Transform` que convierte `''` a `undefined` antes de validar — mismo criterio aplicado a `foto`.
- `/admin/servicios` (`GET` listar con dueño, `PATCH :id` toggle activo con auditoría) — el panel admin de servicios ya existía en Next.js (`/api/admin/servicios`, 2026-08-07) pero nunca se había migrado; no existía nada de esto en el backend nuevo hasta hoy.
- Verificado en vivo con `curl`: CRUD completo, permisos de dueño (403 con otra cuenta), validaciones (400 por categoría/teléfono/municipio inválidos), visibilidad de portafolio pausado (dueño sí, público no), cascada al eliminar, y el panel admin (401 sin sesión, 403 sin `esAdmin`, auditoría registrada en `AccionAdmin`).

**Frontend:** las 6 páginas/componentes que ya consumían `/api/servicios/**` (`servicios/page.tsx`, `servicios/[id]/page.tsx`, `PublishServicioForm.tsx`, `dashboard/servicios/page.tsx`, `dashboard/servicios/[id]/portafolio/page.tsx`, `ServiceContactCard.tsx`) y `admin/servicios/page.tsx` pasan a `backendFetch`/`getAllServicios`/`getServicioById` (`src/lib/api.ts`). El upload de fotos del portafolio se migró al mismo patrón de dos pasos que `PublishForm.tsx` (propiedades): `POST /servicios/fotos` (multipart) primero, luego la URL resultante al crear el trabajo — ya no manda `imagenDataUrl` en el body.

**Dos bugs reales de CSP encontrados en el QA con navegador (no se habrían visto con `curl` ni Server Components):**
1. `connect-src` no incluía `data:` — `PublishForm.tsx` (propiedades) y el portafolio de servicios convierten su preview a `Blob` vía `fetch(dataUrl).then(r => r.blob())` antes de subirlo; Chromium trata ese `fetch()` sobre una `data:` URI como una conexión de red sujeta a `connect-src`, aunque el contenido nunca sale del navegador. Sin esto, **ninguna subida de foto en toda la plataforma llegaba a completarse** (bloqueada en silencio) — bug preexistente que afectaba a Property también, no solo a este cambio. Corregido en `next.config.ts` (mismo archivo del fix de `connect-src`/backend del 2026-08-12 anterior).
2. Verificado que la subida de fotos SÍ llega correctamente al backend tras el fix anterior — falla después con `Invalid api_key dev` porque este entorno de desarrollo local no tiene credenciales reales de Cloudinary (`CLOUDINARY_API_KEY=dev`, placeholder). Confirmado que **no es un bug**: `/propiedades/fotos` falla exactamente igual en este mismo entorno. Queda pendiente de verificar con credenciales reales (staging/producción), no bloquea este cambio.

**Con esto, `servicios/**` deja la lista de "todo lo que sigue 100% dentro de Next.js" (§13 punto 1) — de todo el documento, solo quedan pendientes/en pausa: §9.3 (catálogo de colonias en BD, decisión de producto abierta) y las "Decisiones abiertas" de infraestructura (storage de fotos ya resuelto vía Cloudinary; dominio/cookie y migración de BD siguen sin decisión, no bloquean desarrollo).**

---

## 📋 Registro de cambios de hoy (2026-08-12, QA con navegador real) — bug real de CSP encontrado y corregido

**El pase manual con navegador que quedó pendiente el 2026-08-11 ("no probado con un navegador real") se hizo hoy — y encontró un bug real que ningún test anterior podía haber detectado.**

`next.config.ts` trae una `Content-Security-Policy` (`connect-src 'self' https://accounts.google.com https://graph.facebook.com`) agregada en la auditoría de seguridad del 2026-08-06/07, **antes** de que existiera el backend nuevo — nunca se actualizó cuando empezó el corte. Resultado: **todo fetch hecho desde el navegador** (no desde un Server Component) hacia `NEXT_PUBLIC_API_URL` quedaba bloqueado en silencio por el propio navegador — `AuthContext` (`/auth/me`), el buscador con IA (`/ia/busqueda-inteligente`, `SearchBar.tsx`), y el listado de propiedades del lado del cliente (`PropertiesClient.tsx`, `?all=true`). Verificado en vivo: antes del fix, escribir una búsqueda y presionar Enter no aplicaba ningún filtro (el fetch nunca salía); después del fix, la misma búsqueda navega correctamente con los filtros reales interpretados por la IA (`/propiedades?tipo=casa&operacion=renta&amenidad=alberca&zona=tabasco-2000`, etc.).

**Por qué nadie lo había visto antes:** cada verificación previa de este corte (§2 auth, §3 propiedades, §8 IA, §9.1 colonias) se hizo con `curl` contra el backend directo, o leyendo el resultado de Server Components (`backendFetchServer`) — ninguno de los dos pasa por el CSP del navegador, que solo se aplica a `fetch`/`XHR` disparado por JavaScript del lado del cliente. Es exactamente el tipo de gap que un pase con navegador real detecta y los demás métodos no.

**Fix:** `backendOrigin` (derivado de `NEXT_PUBLIC_API_URL` con `new URL(...).origin`) agregado a `connect-src` en `next.config.ts` — dinámico, no hardcodeado, así sigue funcionando cuando el backend tenga un dominio real de producción.

**Otros hallazgos del pase, no corregidos hoy (no bloquean, no son regresión de este corte):** un warning de hydration mismatch en el link "Iniciar sesión" de `Navbar.tsx` (el server renderiza el link sin `onClick`/`ref`, el cliente lo re-renderiza con esos handlers una vez `AuthContext` resuelve la sesión) — es el patrón típico de auth resuelto client-side, no algo nuevo de esta sesión; queda para revisar aparte si se decide.

---

## 📋 Registro de cambios de hoy (2026-08-12, continuación) — §9.1 construido: ranking de colonias por demanda real

Segunda pieza de Colonias descubiertas (§9). `/zonas` y el Home ya no ordenan sus tarjetas de "colonias" por OFERTA (cuántas propiedades tiene) sino por DEMANDA real — la llama y el orden de tarjetas reflejan búsquedas + vistas + contactos reales, no solo inventario.

**Decisiones de producto confirmadas con el usuario antes de construir esto:**
- Ventana de tiempo: **7 días corridos** (no 24h) — a esta escala de tráfico, una ventana de un día es demasiado ruidosa (una sola persona navegando varias páginas puede dominar el ranking de todo un día).
- §9.3 (catálogo con ficha en BD) queda explícitamente FUERA de este cambio — se mantiene la distinción actual entre colonias curadas (con ficha) y descubiertas (sin ficha), no se promueve ninguna automáticamente. Ver nota al final.

**Backend:**
- `SolicitudColonia` (modelo nuevo, `prisma/schema.prisma`) + enum `TipoSolicitudColonia` (`busqueda`/`vista_propiedad`/`contacto`) — un evento por cada vez que se resuelve una colonia real. Se instrumentaron los 3 puntos exactos que pedía §9.1:
  1. `IaController.busquedaInteligente` — después de `interpretar()`, si el resultado trae `colonia` (un solo punto, sin importar si vino de heurística/caché/IA real).
  2. `PropertiesService.findOne` (`GET /propiedades/:id`) — excluyendo al propio dueño viendo su anuncio.
  3. `PropertiesService.obtenerContacto` (`GET /propiedades/:id/contacto`) — misma exclusión de dueño; verificado en vivo que un intento sin sesión (401) no registra nada.
  - **Por qué se excluye al dueño:** un dueño revisando/refrescando su propio anuncio no es demanda real — dejarlo contar habría permitido inflar el ranking de la propia colonia a voluntad.
- `GET /colonias/tendencia` (nuevo, `ColoniasTendenciaService`) — ranking completo (no solo top 9, el frontend decide cuántas tarjetas mostrar) agrupado por `coloniaKey` normalizado (sin acentos/mayúsculas), con la etiqueta de display más reciente por grupo. `Cache-Control: max-age=120` (más corto que "descubiertas": este dato cambia seguido).
- **Bug real evitado en el camino:** los triggers de precio "hasta/desde/máximo/mínimo" de `busqueda-inteligente` NO interfieren aquí — el tracking lee `filtros.colonia` del resultado ya sanitizado, no reinterpreta el texto.

**Frontend (`src/lib/api.ts`):** `getColoniasOrdenadasPorDemanda()` — mismos datos de tarjeta que `getColoniasRankedByPropiedades` (oferta), reordenados por demanda cuando existe al menos un evento real; `sort` estable garantiza que sin datos de demanda el orden es EXACTAMENTE el de oferta, sin rama especial. Expone `porDemanda: boolean` para que `/zonas` y el Home nunca digan "más solicitadas" cuando en realidad están mostrando el respaldo por oferta (mismo criterio de honestidad de siempre) — el heading y el tooltip de la llama cambian de texto según ese flag. **Los dos requisitos exactos de §9.1 verificados en vivo:** la llama solo aparece en la colonia que empata en el TOP del ranking de demanda (nunca las 9 de la tarjeta — probado: exactamente 1 coincidencia), y tanto `/zonas` como el Home apuntan a la misma fuente (`getColoniasOrdenadasPorDemanda`), sin un segundo catálogo que sincronizar a mano.

**Nota sobre §9.3 (no construido hoy, a propósito):** con §9.1 ya real, sí sería técnicamente posible usar el ranking de demanda como disparador para que un admin promueva una colonia descubierta a ficha completa — pero eso es §9.3, que el usuario decidió dejar con la distinción actual (curadas vs. descubiertas) por dos bloqueadores reales: no hay foto real para una colonia descubierta (se crean solas vía geocodificación, nadie cura una imagen), y auto-generar fichas sin control de calidad arriesga páginas delgadas de bajo valor. Si se retoma, sería una fase aparte con su propio flujo de admin, no un efecto automático de este cambio.

---

## 📋 Registro de cambios de hoy (2026-08-12) — §9.2 construido: descripciones de zona generadas contra datos verificados

**Primera pieza de Colonias descubiertas (§9) que deja de ser "NUEVO, no existe hoy".** El texto de "Sobre la colonia/el municipio" en `/zonas/[slug]` (antes `zone.descripcion`/`municipality.descripcion`, estático en `zones.json`/`municipalities.json`) ahora se genera contra hechos verificados en cada carga, en vez de quedar escrito a mano y expuesto a desactualizarse o colar una afirmación sin respaldo (ver auditoría del 2026-08-06 referenciada en §9.2).

- **Backend** (`POST /ia/descripcion-zona`, nuevo): recibe **solo hechos ya verificados** — nunca busca ni infiere nada por su cuenta. `IaService.descripcionZona()` sigue el mismo patrón que `generarAnuncio` (plantilla determinística sin IA cuando no hay `OPENROUTER_API_KEY` o la llamada falla, nunca inventa un dato que no vino en el input). Prompt real con prohibición explícita de superlativos, afirmaciones de demanda/plusvalía, y comparaciones entre zonas — mismas reglas que ya exige §9.2. `riesgoInundacion` se redacta siempre como hecho histórico documentado ("con historial de inundaciones"), nunca como predicción — misma redacción que `FLOOD_LABEL` (`src/lib/floodColors.ts` del frontend).
- **Frontend** (`zonas/[slug]/page.tsx`): resuelve los hechos verificados del lado del servidor antes de llamar al backend —
  - `landmarksCercanos`: hasta 3 landmarks reales más cercanos al centro de la zona (`src/lib/landmarks.ts`, `distanciaKm`, radio de 3km — nunca inventados).
  - `totalPropiedades`/`precioPromedio*`: los mismos stats en vivo que ya calculaba `getZonesWithLiveStats`/`getMunicipalitiesWithLiveStats` (§3), no un dato nuevo.
  - `riesgoInundacion`: **hallazgo importante al construir esto** — la plataforma sí tiene un dataset real y citado del Atlas de Riesgos (`src/lib/zonas-inundacion.ts`, "Atlas de Riesgos del Municipio de Centro, 2023", ~130 colonias con patrón de nombre → nivel), ya usado hoy para prellenar el campo del formulario de publicar. Es una fuente REAL distinta de `Property.riesgoInundacion` (autorreportado por quien publica, nunca verificado contra el Atlas por el backend). Solo se manda cuando `detectarRiesgoInundacion()` devuelve confianza `'confirmada'` (coincidencia exacta) — nunca `'probable'`, para no presentarle a un visitante una inferencia como si fuera un hecho documentado.
  - Si la llamada al backend falla por cualquier razón, cae al texto estático editorial de `zones.json`/`municipalities.json` — mismo criterio de resiliencia que ya rige todo el módulo de IA.
- **`generateMetadata` (meta `<description>` para SEO) sigue leyendo el campo estático** a propósito, no el generado — evita duplicar la llamada al backend en cada carga solo para el `<head>`, y el texto estático ya es honesto desde la corrección del 2026-08-06.
- **Pendiente, no en el alcance de hoy:** §9.1 (ranking por demanda, requiere decidir antes la ventana de tiempo) y §9.3 (catálogo de municipios/colonias como tabla real en BD, hoy siguen siendo los JSON estáticos del frontend — este cambio no los reemplaza, solo genera el texto de descripción a partir de ellos).

---

## 📋 Registro de cambios de hoy (2026-08-11, continuación) — IA queda 100% migrada, busqueda-inteligente cerrada

**Cierra el punto que el registro de más abajo (2026-08-11, primera parte) dejaba abierto: de las 5 rutas de `/ia/*`, `busqueda-inteligente` era la única que seguía 100% en Next.js** porque le faltaban 6 campos (`recamarasMax`, `amenidad`, `cercaDosoBocas`, `riesgoInundacion`, `sort`, `limite`) tanto en la heurística de respaldo como en el prompt real de OpenRouter del backend nuevo. Ya no es así.

- **Backend** (`heuristica-busqueda.util.ts`, `busqueda-inteligente.service.ts`, `ia-results.interface.ts`): agregados los 6 campos, con las mismas reglas de desambiguación que ya usaba `src/lib/ai.ts` del frontend (recamarasMax es techo no mínimo, la heurística nunca infiere `riesgoInundacion` "alto"/"medio" solo "bajo" explícito, sort es orden no filtro, limite es tope explícito de resultados con cap de 50).
  - **Bug real encontrado y corregido:** los triggers de precio `"maximo"`/`"minimo"` (de un fix anterior a este mismo módulo) colisionaban con el nuevo trigger de `recamarasMax` — `"departamento de maximo 2 recamaras"` devolvía `precioMax:2` fantasma además de `recamarasMax:2`. El frontend nunca tuvo este bug porque su heurística no usa "máximo"/"mínimo" como trigger de precio. Corregido excluyendo explícitamente cuando el número detectado es seguido de "recamaras"/"banos".
- **Frontend:** `src/lib/interpretarBusqueda.ts` ahora llama a `backendFetch('/ia/busqueda-inteligente')` en vez de a la ruta local de Next.js. Borrados por completo: `src/app/api/ia/busqueda-inteligente/route.ts` (y con él, `src/app/api/ia/` queda vacío), `src/lib/ai.ts` (1538 líneas originales — sin más consumidores tras esto, confirmado por grep), `src/lib/busquedaCache.ts` y `src/lib/busquedaStats.ts`.
- **Regresión honesta, no un descuido — tarjeta "Buscador con IA" quitada de `/admin`:** ese panel leía `busquedaStats.ts` (contador en memoria del propio proceso de Next.js), alimentado únicamente por las llamadas que pasaban por la ruta local ahora borrada. Dejarla tal cual habría mostrado cifras congeladas para siempre como si fueran datos reales — el mismo criterio que ya aplica en toda la plataforma (nunca un dato fabricado/stale presentado como medido, ver "Admins activos" en el registro de 2026-08-07). Esa observabilidad (cache hits, llamadas reales a OpenRouter, horas pico) queda pendiente de reconstruirse del lado del backend nuevo — ya era una decisión confirmada con el usuario antes de la fase del panel de administración (ver comentario en `admin-metricas.service.ts`), no algo que este cambio decida de nuevo.
- **Con esto, todo lo que sigue 100% dentro de Next.js se reduce a: colonias descubiertas (§9.1/9.2/9.3, ranking por demanda/descripciones generadas/catálogo con ficha — ninguno construido todavía, con decisiones de producto abiertas) y servicios/** (§11, en pausa).** Todo lo demás — auth, propiedades (lectura+escritura), favoritos, alertas, citas, perfil de inmobiliaria, contacto/reportes, admin, y ahora las 5 rutas de IA completas — ya habla con el backend nuevo.
- **No probado con un navegador real** (sin acceso a uno en este entorno) — verificado con `tsc`/`eslint` limpios en ambos repos y ~20 variantes de consulta contra el backend en vivo (curl, camino heurístico sin `OPENROUTER_API_KEY`). Recomendable un pase manual en `/` y `/propiedades` (SearchBar.tsx, PropertiesClient.tsx) antes de dar esto por cerrado en producción.

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

## 📋 Registro de cambios de hoy (2026-08-11) — Propiedades ya migró completo (lectura + escritura + contacto/reportes)

**Cierra el punto que el registro del 2026-08-10 (justo abajo) dejaba abierto: "la lectura sí es real, la escritura no".** Ya no es así — §3 completo (crear/editar/pausar/archivar/destacar/eliminar) y §10 completo (contacto/contactar/reportar) hablan con el backend nuevo. Detalle:

- **Propiedades — escritura** (§3): `PublishForm.tsx` (incluye subida de fotos vía `POST /propiedades/fotos`, multipart), `OwnerActionsBar.tsx`, `dashboard/propiedades/**` (listar/pausar/reactivar/archivar/destacar/eliminar/editar/importar CSV), `usePropiedadEstado.ts`. Los 3 módulos de simulación en localStorage que quedaban (`propiedadesLocales.ts`, `estadoOverrides.ts`, `idsLocales.ts`) se borraron — cero importadores reales restantes.
  - Bug real encontrado y corregido en el backend durante estas pruebas: `GET /propiedades/mias` no filtraba por `activa`, así que una propiedad eliminada (`DELETE`, soft-delete) seguía apareciendo en el dashboard del propio dueño.
  - Vistas/contactos/favoritos siguen sin modelo real (§12, fuera de MVP) — se muestran honestos en 0 en vez de cifras de demo fabricadas contra propiedades reales.
- **Contacto y reportes** (§10): `AgentCard.tsx` (`GET /propiedades/:id/contacto`), `ContactForm.tsx` (`POST /propiedades/:id/contactar`), `ReportButton.tsx` (`POST /propiedades/reportar`, que ya persistía completo del lado del backend nuevo, incluida la regla de 3+ reportes → `requiereModeracion=true`). Las 3 rutas locales (`src/app/api/propiedades/**`) y dos helpers que quedaron sin uso (`getAgenteContacto()`, `sendContactoPropiedadEmail()`) se borraron.
  - **Gap nuevo que esto abre, documentado, no corregido:** `/admin/reportes` (§16) sigue leyendo Prisma local — un reporte sobre una propiedad real ahora se guarda solo en la base del backend nuevo, invisible para ese panel todavía. No es una regresión de este cambio: una propiedad real ya no existía en la base local de todos modos desde que `PublishForm.tsx` empezó a publicar contra el backend nuevo (registro de abajo).
- **Gap `esAdmin` (reportado el 2026-08-10, corregido hoy):** `PublicUser`/`toPublicUser()` del backend ahora incluye `esAdmin`, y `BackendUser`/`AuthContext.tsx` lo mapean — el link "Panel de administración" de `Navbar.tsx` ya aparece para una cuenta admin real. Verificado en vivo (registro → `esAdmin:false` → `admin:promote` → `esAdmin:true` en `/auth/me`). El candado real (`admin/layout.tsx`) no cambió — seguía funcionando incluso con el link oculto.
- **Auditado y descartado, no era necesario portar:** los 3 bugs de heurística de búsqueda IA corregidos el 2026-08-10 en `src/lib/ai.ts` (frontend, todavía la ruta activa de `/ia/busqueda-inteligente`) no tienen equivalente en `heuristica-busqueda.util.ts` del backend nuevo — ese archivo se reescribió con una arquitectura más conservadora (precio solo con palabra gatillo explícita tipo "hasta"/"desde", nunca escaneo de números sueltos; sin soporte de "k" como abreviación de mil; sin extracción de `m2Min`/`m2Max` en absoluto, ni siquiera en el prompt real de OpenRouter) — la superficie donde vivían esos 3 bugs no existe ahí.
- **Con esto, todo lo que sigue 100% dentro de Next.js** (línea 77, registro de abajo) se reduce a: `admin/**` completo, IA (`/ia/*`), colonias descubiertas, `alertas/notificar`, `me/stats`, y `servicios/**` (en pausa). Empieza ahora la migración del panel de administración — el backend ya tiene los 12 endpoints de `/admin/**` completos (§16), falta solo el lado del frontend.

---

## 📋 Registro de cambios de hoy (2026-08-10) — el corte de backend YA EMPEZÓ, es parcial

**El backend nuevo existe y ya está en producción para una parte real de la plataforma — esto deja de ser 100% "contrato a replicar" y pasa a ser, para los módulos de abajo, "lo que ya pasó, verificado leyendo el código fusionado".** §13 (más abajo) se reescribió con estado por punto (✅ hecho / ⚠️ parcial / ⏳ pendiente) en vez de una lista plana de tareas — no lo vuelvas a leer como un plan a futuro sin más.

**Módulos que YA hablan con el backend nuevo (`NEXT_PUBLIC_API_URL`, `src/lib/backendApi.ts`/`backendApiServer.ts`, cookie `vivevillahermosa_session` reenviada con `credentials: 'include'`):**
- Autenticación completa (§2) — login, registro, logout, `/auth/me`, OAuth. `AuthContext.tsx` ya no llama a ningún `/api/auth/*` de Next.js.
- Favoritos (§4), Alertas + Notificaciones (§5), Citas + Configuración de agenda (§6), Perfil de inmobiliaria (§7).
- **Propiedades — SOLO LECTURA** (§3): `GET /propiedades`, `GET /propiedades/:id` ya vienen del backend nuevo (`src/lib/api.ts`, `propiedades/[id]/page.tsx` con `backendFetchServer` + `revalidate = 60`, ya no `generateStaticParams`). **Crear/editar/pausar/eliminar una propiedad SIGUE siendo 100% local todavía** — `PublishForm.tsx` sigue llamando `crearPropiedad()` de `propiedadesLocales.ts` (localStorage), no hay ningún `POST/PATCH/DELETE /propiedades` real todavía. No asumas que "Propiedades" ya migró completo por leer que §3 dejó de decir "NUEVO, no existe hoy" — la lectura sí es real, la escritura no.
- Como consecuencia de lo anterior, `src/app/api/auth/**`, `src/app/api/favoritos`, `src/app/api/alertas` (la principal, no `alertas/notificar`), `src/app/api/notificaciones`, `src/app/api/citas/**`, `src/app/api/configuracion-agenda` y `src/app/api/perfil-inmobiliaria` **ya se borraron** de Next.js (§13 punto 1, ✅ para estos).

**Módulos que TODAVÍA viven 100% dentro de Next.js (`src/app/api/**` real, con Prisma/SQLite local — no son un stub, siguen siendo el backend real de estas rutas por ahora):** admin/** completo (§16), IA (§8, las 5 rutas de `/ia/*`), colonias descubiertas (§9), `cuenta/solicitar-revision` (§16), `propiedades/:id/contacto` + `/contactar` + `/reportar` (§10), servicios/** completo (§11), `alertas/notificar`, `me/stats` (§12). **Por eso `JWT_SECRET`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY` siguen siendo obligatorios en el `.env.local` de Next.js** — §13 punto 9 (más abajo) decía que estos se mudarían por completo; con la migración parcial, siguen haciendo falta aquí mientras estas rutas no se muden también.

**Decisión que ya se tomó (ya no está "abierta"), al menos para desarrollo local — ver "Decisiones abiertas" #1 al final:** cookie `HttpOnly` de mismo origen, reenviada con `credentials: 'include'` (cliente) o leída de `next/headers` y reenviada a mano en el header `Cookie` (Server Components, `backendFetchServer`). `src/proxy.ts` **no se rediseñó** — sigue verificando el JWT localmente con `jwtVerify`/`JWT_SECRET` compartido (la tercera opción que ya planteaba el punto 4 de §13, "si se elige secreto compartido, proxy.ts no cambia"). Falta confirmar si este mismo mecanismo sigue siendo válido una vez haya dominios reales de producción (la pregunta de fondo del punto 1 de "Decisiones abiertas" sigue sin resolver para ESE caso).

> ⚠️ **Gap real encontrado al revisar esto (2026-08-10), no corregido todavía — reportado, no arreglado en este documento:** `BackendUser` (`src/lib/backendApi.ts`) no incluye `esAdmin`, y `AuthContext.tsx` no lo mapea al armar `AuthUser` — significa que `user.esAdmin` del lado del cliente **siempre es `undefined`** ahora mismo, así que el link "Panel de administración" del menú de `Navbar.tsx` no se muestra ni para una cuenta admin real. **No es un problema del gate real** (`admin/layout.tsx` usa `getSession()` de `src/lib/auth.ts`, que sigue consultando Prisma local directo — ese sí ve `esAdmin` fresco y sigue bloqueando correctamente), solo del link de navegación que ayuda a llegar ahí. Falta agregar `esAdmin` a la respuesta de `GET /auth/me` del backend nuevo y a `BackendUser`/el mapeo de `AuthContext.tsx`.

---

## Índice

0. [Decisiones abiertas](#decisiones-abiertas--leer-primero) — léela antes que nada, aunque esté al final del documento.
1. [Modelo de datos completo](#1-modelo-de-datos-completo)
2. [Autenticación](#2-autenticación)
3. [Propiedades — lectura migrada, escritura pendiente](#3-propiedades--lectura-migrada-escritura-pendiente)
4. [Favoritos](#4-favoritos)
5. [Alertas y notificaciones](#5-alertas-y-notificaciones)
6. [Citas y configuración de agenda](#6-citas-y-configuración-de-agenda)
7. [Perfil de inmobiliaria](#7-perfil-de-inmobiliaria)
8. [IA (proxy a OpenRouter/Gemini)](#8-ia-proxy-a-openroutergemini)
9. [Colonias descubiertas](#9-colonias-descubiertas) · [9.1 Colonias más solicitadas — NUEVO](#91-colonias-más-solicitadas--nuevo-no-existe-hoy) · [9.2 Descripciones generadas con IA — NUEVO](#92-descripciones-de-zonacoloniamunicipio--nuevo-no-existe-hoy) · [9.3 Colonias con ficha — ✅ construido](#93-catálogo-de-municipioscolonias-con-ficha--construido-2026-08-13-solo-colonias)
10. [Contacto y reportes sobre una propiedad](#10-contacto-y-reportes-sobre-una-propiedad)
11. [Directorio de servicios](#11-directorio-de-servicios)
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

## 3. Propiedades — lectura migrada, escritura pendiente

> **Actualizado 2026-08-10 (ver registro de cambios de esa fecha, antes del Índice).** `GET /propiedades` y `GET /propiedades/:id` ya son reales contra el backend nuevo — dejaron de ser "no existe en ningún lado". **Todo lo demás de esta sección (`POST`/`PATCH`/`DELETE`, el endpoint de fotos, las validaciones obligatorias) sigue sin existir todavía** — `PublishForm.tsx` y `dashboard/propiedades/page.tsx` del frontend siguen simulando la escritura en `localStorage` (`src/lib/propiedadesLocales.ts`/`estadoOverrides.ts`, ver §13 punto 11). El resto de esta sección describe el contrato completo (lectura ya cubierta, escritura todavía por construir) — sigue siendo la referencia a implementar para lo que falta, no algo ya resuelto en su totalidad. Usa el modelo `Property` de §1.

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
13. **Límite de propiedades activas por cuenta (nuevo, 2026-08-09 — pedido explícito del usuario; subido de 3 a 4 el mismo día).** Máximo **4 propiedades con `estado='activa'` por `userId`** en el plan gratuito — rechazar con 400 (código sugerido `LIMITE_PROPIEDADES_ALCANZADO`) si un `POST /propiedades` o un `PATCH /propiedades/:id` que cambie `estado` a `'activa'` (reactivar desde pausada/vencida/vendida/rentada) haría que el conteo supere el límite. **A propósito es por ACTIVIDAD, no por `rol`:** `rol` (`'buscador'|'propietario'|'agente'`) es autodeclarado al registrarse y no distingue de forma confiable a un agente independiente de una inmobiliaria — un volumen alto de propiedades activas es la señal real de uso comercial, sin importar qué rol se eligió al registrarse. Un usuario normal (dueño publicando su propia casa) rara vez pasa de 1-2; quien maneja cartera real topa rápido.
    - **Mismo patrón a replicar con cuidado que Favoritos (§4) y Servicios (§11) — verificar el conteo y escribir el nuevo estado en una sola transacción atómica**, no en dos pasos separados (leer el conteo, decidir, escribir) — bajo dos requests casi simultáneos (dos pestañas, doble tap) eso permite pasarse del límite por una carrera, igual que ya se corrigió en esos dos módulos.
    - Ya implementado como verificación de **frontend** hoy (`contarPropiedadesActivas()`/`LIMITE_PROPIEDADES_GRATIS` en `src/lib/propiedadesLocales.ts`, aplicado en `PublishForm.tsx` y en los dos lugares que reactivan: `OwnerActionsBar.tsx` y `dashboard/propiedades/page.tsx`) — **evadible con devtools tal como el resto de esta lista**, cuenta sobre `localStorage` de un solo navegador porque `Property.userId` todavía no es real (mismo gap ya conocido, ver "Decisiones abiertas" al final del documento). El backend es quien debe hacerlo cumplir de verdad, contra el `userId` real de la sesión.
    - **No hay todavía ningún sistema de planes/pagos construido** — el componente `PlanesInmobiliaria` existe pero está oculto a propósito (§15, V2.A) porque anuncia funciones que no son reales todavía (destacados, verificación). Por ahora, al toparse con el límite, el frontend muestra un mensaje + un `mailto:` a soporte, no un flujo de compra — no fingir un "actualizar plan" que no procesa ningún pago. Cuando exista un sistema de planes real, este es el gate que debe apuntar ahí en vez de al mailto.
    - **Decisión abierta, no la asumas:** ¿el límite de 4 es el número final, o solo un punto de partida razonable sin datos de uso real? Coordinar con el equipo antes de subir/bajar el número una vez haya cuentas reales que lo prueben.

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

**2026-08-09 — la sección "Colonias con más propiedades" del Home (`src/app/page.tsx`) ya se migró a esta misma fuente.** Antes mostraba `getFeaturedZones()` — colonias marcadas `destacada:true` a mano en `zones.json`, con cero señal real detrás de esa selección (mismo problema, en el Home, que ya se había corregido en `/zonas`). Ahora usa `getColoniasRankedByPropiedades().slice(0, 4)`, la misma función/mismo criterio (por oferta) que `/zonas` — no hay dos catálogos que mantener sincronizados a mano. **Esto significa que el cambio de arriba (oferta → demanda) aplica a las dos pantallas a la vez, no solo a `/zonas`:** cuando `GET /colonias/tendencia` exista, tanto `zonas/page.tsx` como `page.tsx` (Home) deben apuntar ahí. El campo `destacada` de `zones.json` ya no decide qué se muestra como "colonia con más propiedades" en ninguna pantalla (se quitó `getFeaturedZones()`, sin llamadas, de `src/lib/api.ts`) — pero **sigue teniendo un uso real y legítimo**: `src/app/sitemap.ts` lo usa como señal de prioridad para buscadores (`priority: z.destacada ? 0.75 : 0.6`), que es un uso editorial válido (indicarle a Google qué páginas priorizar no es lo mismo que afirmarle a una persona real un ranking inventado). No quitar el campo del schema.

### 9.2 Descripciones de zona/colonia/municipio — NUEVO, no existe hoy

**Pedido explícito del usuario (2026-08-08):** las descripciones de texto libre de `src/data/zones.json`, `src/data/municipalities.json` y `src/lib/zonasDestacadas.ts` (el "Tip de inversión"/"Sobre la zona" en `/zonas/[slug]`, el resumen bajo cada colonia/municipio, y el texto que alimenta `ZONAS_DESTACADAS_TEXTO` en `ai.ts` para el buscador) deben pasar a **generarse con IA a partir de datos reales** una vez exista el backend — no seguir siendo texto estático escrito a mano.

**Por qué esto importa — auditoría del mismo día:** una revisión completa encontró que buena parte de este texto estático hacía afirmaciones de predicción/juicio que la plataforma no puede respaldar — "la colonia más exclusiva", "la dirección más prestigiosa", "plusvalía constante/creciente", "alta demanda", "mercado en desarrollo", "potencial turístico creciente", un "Tip de inversión" que literalmente repetía la misma frase ("una de las zonas más consolidadas... buena plusvalía") para *cualquier* colonia sin datos propios. Todo esto se corrigió a mano hoy mismo (texto puramente factual: ubicación real, landmarks catalogados, tipo de vivienda — nunca superlativos, rankings, ni comparaciones tipo "mejor que"), pero un texto estático escrito a mano se vuelve a desactualizar o a colar una afirmación así tarde o temprano. La forma correcta de que esto no se repita es que el texto se genere (o se valide) contra datos reales cada vez, no que alguien lo escriba una sola vez y quede fijo.

**Lo que el backend nuevo debe replicar cuando esto se construya:**
- Un endpoint (ej. `POST /ia/descripcion-zona` o generado en batch al crear/actualizar una colonia) que reciba los **datos verificados** de la zona — landmarks reales cercanos (`src/lib/landmarks.ts`), conteo real de propiedades activas por tipo/operación, precio promedio real (ya calculado en vivo por `getZonesWithLiveStats`/`getMunicipalitiesWithLiveStats`, ver §3), el nivel de riesgo de inundación real (Atlas de Riesgos, nunca inventado) — y genere una descripción en prosa **solo a partir de esos hechos**, nunca opinando sobre plusvalía, demanda, o cuál zona es "mejor" que otra.
- **Mismas reglas que ya rigen `src/lib/ai.ts` para el buscador** (REGLA 1: nunca adivinar/inventar un dato que no viene de una fuente verificada) aplican aquí con más razón todavía — esto es contenido publicado y visible para cualquier visitante, no una interpretación efímera de una búsqueda.
- **Prohibido explícitamente en el prompt, cuando se construya:** superlativos ("la más exclusiva/prestigiosa/segura"), afirmaciones de tendencia de precio ("plusvalía en aumento", "en auge", "mercado en desarrollo"), afirmaciones de demanda no medida ("alta demanda", "la más buscada" — ver el mismo hallazgo ya corregido en Home, `page.tsx`, que afirmaba "Las más buscadas" sin ningún rastreo real de búsquedas), y cualquier comparación directa entre dos zonas/colonias que declare una "mejor" que otra (mismo criterio, no es exclusivo de este módulo, ya aplicado hoy en otros dos lugares: se quitó el badge "Mejor" de la tabla de comparar propiedades en `/comparar`, y se quitó el "Veredicto" de un post del blog que elegía cuál colonia era mejor para cada quien).
- El campo `riesgoInundacion` y sus etiquetas (`src/lib/floodColors.ts`) ya se corrigieron hoy para describir el registro histórico documentado (Atlas de Riesgos) en vez de sonar a una predicción de la plataforma ("Riesgo alto de inundación" → "Históricamente inundable") — cualquier descripción generada debe seguir ese mismo criterio: hecho documentado, no pronóstico.
- Hasta que este endpoint exista, el texto estático corregido hoy es el comportamiento correcto a mantener — no revertir a las versiones con superlativos/predicciones si se edita `zones.json`/`municipalities.json`/`zonasDestacadas.ts` a mano mientras tanto.

### 9.3 Catálogo de municipios/colonias con ficha — ✅ construido (2026-08-13, solo colonias)

> Agregado como pendiente 2026-08-09, resuelto 2026-08-13. La decisión abierta del punto 3 (¿toda colonia con demanda alta debería tener ficha automática, o la curación sigue siendo humana?) se confirmó con el usuario: **Opción B, curación humana** — ver el registro de cambios de hoy más arriba para el razonamiento completo.

**Alcance confirmado: solo colonias.** Los 17 municipios (`municipalities.json`) siguen siendo el catálogo estático de siempre — es una lista fija que no crece (a diferencia de las colonias), sin la presión de mantenimiento que justificaba este cambio. `GET /zonas/municipios` (mencionado en la versión anterior de esta sección) no se construyó — no hace falta mientras el catálogo de municipios no cambie.

**Colonias — modelo `ColoniaFicha` (backend, `prisma/schema.prisma`):** `id, slug (único), nombre, municipio, lat, lng, foto?, destacada, createdAt, updatedAt`. Solo campos estructurales — `descripcion` (§9.2, IA) y `propiedades`/`precioPromedio*` (stats en vivo sobre `Property`) siguen calculándose aparte, igual que antes.

| Endpoint | Método | Auth | Notas |
|---|---|---|---|
| `/zonas/colonias` | GET | No | Lista completa (`?municipio=` opcional). `Cache-Control: public, max-age=300, stale-while-revalidate=3600`. |
| `/zonas/colonias/:slug` | GET | No | Una ficha, 404 si no existe. |
| `admin/zonas/colonias` | GET/POST | Admin | Listar (`take: 200`) / crear (slug autogenerado de `nombre` si no se manda, 409 si ya existe). |
| `admin/zonas/colonias/:id` | PATCH/DELETE | Admin | Editar cualquier campo / hard delete (contenido editorial, no `Property`). |
| `admin/zonas/colonias/fotos` | POST | Admin | Multipart → Cloudinary (`StorageService`, folder `zonas`), sin moderación IA — admin de confianza. |
| `admin/zonas/colonias/pendientes` | GET | Admin | Colonias con demanda real (§9.1, `ColoniasTendenciaService`) que todavía no tienen ficha — la señal para decidir con datos, nunca crea nada sola. |

**Frontend:** `getAllZones()`/`getZoneBySlug()` (`src/lib/api.ts`) dejaron de leer `zones.json` (borrado) y llaman al backend real — mismas firmas de función (ahora `async`), así que `zonas/page.tsx`/`sitemap.ts`/`ColoniaCard` no cambiaron más allá de `await`. El patrón `ColoniaCard.slug: string | null` (colonia sin ficha → enlaza a `/propiedades?q=` en vez de `/zonas/[slug]`) se mantiene igual — sigue siendo el mecanismo real para una colonia con demanda pero sin ficha curada todavía. Página nueva `/admin/zonas` (tabla, formulario con subida de foto en dos pasos, sección de "pendientes" con atajo para precargar el formulario a partir de una fila del ranking de demanda).

**Verificado en vivo:** crear/editar/borrar ficha con foto real desde `/admin/zonas`, `/zonas/[slug]` de una colonia creada después del build renderiza on-demand sin rebuild (`generateStaticParams` + `revalidate = 60`, `dynamicParams` en su default), y una colonia con `SolicitudColonia` real sin ficha aparece correctamente en la sección de pendientes.

---

## 10. Contacto y reportes sobre una propiedad

| Endpoint | Método | Auth | Body | Notas |
|---|---|---|---|---|
| `/propiedades/:id/contacto` | GET | Sí | — | `{ tel, email, whatsapp }` del agente — revelado instantáneo con sesión, cero acceso anónimo. Rate limit 30/10min **por IP Y por `userId` a la vez, los dos límites deben pasar** — confirmado con una prueba real que el límite solo por IP (`X-Forwarded-For`, falsificable por el cliente sin proxy de confianza en frente) no evitaba que una sola cuenta autenticada scrapeara el contacto de todas las propiedades sin fricción (60/60 solicitudes exitosas falsificando la IP en cada una). El límite por `userId` (sale de la sesión firmada, no falsificable desde el cliente) es el que de verdad detiene esto — no omitirlo pensando que el de IP ya alcanza. |
| `/propiedades/:id/contactar` | POST | No (público) | `{ nombre, telefono, email, mensaje }` | Manda un correo real al `emailCuenta`/`agenteEmail` del dueño con el mensaje. **No hay tabla `Contacto`** — el correo ES el único registro; si falla el envío, responde error real (502), no un éxito falso. Rate limit 10/10min por IP. |
| `/propiedades/reportar` | POST | Opcional | `{ propiedadId, motivo (info_falsa\|precio_sospechoso\|contenido_inapropiado\|posible_fraude\|otro), comentario? }` | **Ya persiste de verdad** en `ReporteAnuncio` (ver §16, panel admin en `/admin/reportes`) — dejó de ser un stub 2026-08-06. Pendiente para el backend nuevo: si una propiedad acumula 3+ reportes de "posible_fraude"/"info_falsa", marcarla `requiereModeracion=true` automáticamente (esto todavía no está implementado ni en Next.js). Rate limit 5/hora por IP (evita que alguien reporte en masa el anuncio de un competidor). |

---

## 11. Directorio de servicios

**✅ Construido y migrado al backend nuevo (2026-08-12/13)** — estuvo en pausa desde el 2026-08-06 ("compite por tiempo con cerrar `Property`"), retomado una vez Property quedó 100% migrado. Ver el registro de cambios de hoy, arriba, para el detalle completo (endpoints, desviaciones del prototipo, bugs encontrados).

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

Con el backend en un proyecto separado, esto deja de ser "frontend + backend en un repo" y pasa a ser dos servicios. **El corte empezó 2026-08-10 y es parcial** (ver el registro de cambios de esa fecha, arriba) — cada punto de abajo ya trae su estado real, verificado leyendo el código fusionado, no supuesto:

1. **✅ Completo (2026-08-13) — `src/app/api/**` queda completamente vacío.** Ya borrados: todo `auth/**`, `favoritos`, `alertas` (la principal), `notificaciones`, `citas/**`, `configuracion-agenda`, `perfil-inmobiliaria`, `servicios/**` + `admin/servicios/**`, y las 2 últimas rutas huérfanas que quedaban: `colonias/descubiertas` y `cuenta/solicitar-revision` — ambas ya existían completas del lado del backend nuevo (`ColoniasController`, `CuentaController`) desde hace varias fases, pero el frontend seguía llamando su propia ruta local con Prisma propio en vez de `backendFetch`. Verificado con navegador real que las dos responden 200 contra el backend, sin bloqueo de CSP.
   - **Nota (no resuelta hoy, hallazgo aparte):** `src/lib/coloniaDiscovery.ts` sigue leyendo la base de datos Prisma propia del frontend (`obtenerColoniaDescubiertaPorKey`, consumida por `propiedades/[id]/page.tsx`) — una tabla `ColoniaDescubierta` separada de la del backend nuevo. Como el descubrimiento de colonias (escritura) ya corre del lado del backend (`ColoniasService.geocodificarYRegistrar`, disparado desde `/ia/busqueda-inteligente`) desde que esa ruta migró, esta tabla local del frontend ya no recibe colonias nuevas — quedó congelada en el estado que tenía al momento de esa migración. No es una regresión de este cambio (ya estaba así), pero es candidato a revisar en una fase aparte: migrar `obtenerColoniaDescubiertaPorKey` a `backendFetch` también, y evaluar si el modelo `ColoniaDescubierta` del `prisma/schema.prisma` de este repo (frontend) sigue haciendo falta.
2. **✅ Hecho** — `NEXT_PUBLIC_API_URL` existe (`src/lib/backendApi.ts`, `.env.example`), la app no arranca sin ella (falla rápido a propósito, mismo criterio que `JWT_SECRET` en `auth.ts`).
3. **✅ Parcial** — los módulos ya migrados (punto 1) usan `backendFetch`/`backendFetchServer` apuntando a `${NEXT_PUBLIC_API_URL}/...`. Los que siguen en Next.js todavía usan `fetch('/api/...')` relativo — es lo correcto mientras esas rutas sigan siendo Next.js real, no queda ningún `fetch('/api/...')` huérfano apuntando a una ruta ya borrada (verificado, la app compila y corre).
4. **⏳ No se rediseñó — se tomó la tercera opción que este mismo punto ya planteaba.** `src/proxy.ts` sigue verificando el JWT localmente con `jwtVerify`/`JWT_SECRET` compartido, sin llamar al backend nuevo. Válido mientras el secreto siga siendo compartido (ver Decisiones Abiertas #1) — si esa decisión cambia para producción, este punto vuelve a estar abierto.
5. **✅ Hecho, con un gap encontrado.** `AuthContext.tsx` ya llama a `backendFetch('/auth/me')` en vez de `/api/auth/me`, misma forma de datos (`{ id, email, nombre, rol }`). **Gap real (ver registro 2026-08-10 arriba, no corregido en este documento):** `esAdmin` no viaja en `BackendUser`/`AuthUser`, así que el link de admin del menú no se muestra aunque la sesión sí sea de un admin real — el gate del panel (`admin/layout.tsx`) no depende de esto y sigue funcionando bien porque usa `getSession()` local, que sí ve `esAdmin` fresco de Prisma.
6. **⏳ No verificado desde este repo** — CORS es configuración del lado del backend nuevo (otro repositorio), no hay nada que inspeccionar aquí para confirmar si ya distingue server-to-server vs. client-side como pide este punto. Confirmar directamente con quien tenga el repo del backend.
7. **✅ Hecho para Propiedades, N/A para Zonas.** `propiedades/[id]/page.tsx` ya usa `export const revalidate = 60` y **ya no tiene `generateStaticParams`** — resuelto. `zonas/[slug]/page.tsx` sigue usando `generateStaticParams` + `revalidate = 60` a la vez, y **eso está bien así por ahora**: el catálogo de zonas todavía es el JSON estático de §9.3 (no migrado), no datos que cambien fuera de un deploy.
8. **⚠️ Parcial, no verificado caso por caso.** Los `backendFetch`/`backendFetchServer` nuevos no traen `cache`/`next.revalidate` explícito en todos los call-sites (se apoyan en el default de Next.js o en el `revalidate` de la página, según el caso) — falta una revisión dedicada call-site por call-site como pide este punto, no asumir que está resuelto solo porque la app funciona en desarrollo.
9. **❌ Todavía no — corregido en este documento, el punto original asumía migración completa.** Con la migración parcial (punto 1), `JWT_SECRET` (lo sigue usando `proxy.ts` y todas las rutas que quedan en Next.js), `OPENROUTER_API_KEY`/`GEMINI_API_KEY` (rutas `ia/**`), `RESEND_API_KEY` (`alertas/notificar`, correos de admin) **siguen siendo obligatorios** en el `.env.local` de Next.js. Solo se reduce del todo cuando TODOS los módulos que los usan también se muden.
10. **N/A por ahora, no es un error.** `src/app/robots.ts` sigue bloqueando `/api/*` sin cambios — correcto, porque `/api/*` todavía tiene rutas reales en Next.js (punto 1). Revisar este punto de nuevo cuando la migración esté completa.
11. **Todo lo que hoy simula backend guardando en `localStorage` del navegador se borra por completo** — no se migra, no se conserva como fallback, se reemplaza directo por llamadas reales. Cada archivo ya tiene su propio comentario `⚠️ BACKEND` explicándolo; esta es la lista completa en un solo lugar:
    - **⏳ Pendiente — sigue exactamente igual hoy.** `src/lib/propiedadesLocales.ts` — propiedades creadas/editadas/eliminadas/destacadas desde `/publicar` o `/dashboard/propiedades/importar`. `PublishForm.tsx` sigue llamando `crearPropiedad()` de este archivo — no hay todavía ningún `POST`/`PATCH`/`DELETE /propiedades` real que lo reemplace (§3, la lectura ya migró, la escritura no).
    - **⏳ Pendiente, mismo motivo que el punto anterior.** `src/lib/estadoOverrides.ts` — pausar/archivar/reactivar una propiedad. Se reemplaza por el campo `estado` real de `Property` (§3), vía `PATCH /propiedades/:id`, que todavía no existe.
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

1. **¿Cómo viaja el token entre los dos servicios?** — ✅ **Ya decidido para desarrollo/localhost (2026-08-10), verificado en código real: cookie HttpOnly de mismo origen.** `src/lib/backendApi.ts` (`backendFetch`, cliente) usa `credentials: 'include'`; `src/lib/backendApiServer.ts` (`backendFetchServer`, Server Components) lee la cookie de `next/headers` y la reenvía a mano en el header `Cookie`. `src/proxy.ts` sigue validando el JWT localmente con el secreto compartido (no llama al backend nuevo). **Sigue sin resolver, y esto sí importa antes de desplegar:** si el backend nuevo termina en un dominio sin relación con el de Next.js (no un subdominio del mismo dominio raíz), este mecanismo deja de funcionar tal cual y hay que revisar esta decisión con la información real de hosting/dominio — la explicación completa de por qué, y las dos alternativas, se conservan abajo para ese momento.

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
