# Auditoría Fase 1 MVP — Publicar propiedades

> **Alcance:** exclusivamente lo que la Fase 1 promete — que un usuario pueda publicar su propiedad (límite de cuentas gratuitas) y que esa propiedad sea real y usable dentro de la plataforma. No cubre Fase 2, ni módulos fuera de este flujo (servicios, CRM, citas, etc.).
>
> **Metodología:** lectura directa del código real (`PublishForm.tsx`, `propiedadesLocales.ts`, rutas de propiedad, `PropertyCard.tsx`, `ai.ts`/`filters.ts`), contrastado contra `git log`/`git show` para distinguir "así se diseñó" de "esto se rompió en un cambio reciente". Cero hallazgo se reporta sin haber visto el código que lo confirma. Aplicando skills instaladas hoy: `best-practices` (seguridad/validación), `accessibility` (foco de teclado), `database-schema-designer` (criterio de arquitectura), `frontend-design`/`ui-ux-pro-max` (criterio de UI).
>
> **Este documento es solo diagnóstico y propuesta — ningún archivo fue modificado.**

---

## 0. Antes que nada — un dato a confirmar contigo

El código hoy tiene el límite gratuito en **4** propiedades activas (`LIMITE_PROPIEDADES_GRATIS` en `src/lib/propiedadesLocales.ts:232`, subido de 3→4 el 2026-08-09 por pedido explícito tuyo, documentado en `docs/BACKEND.md` §3 punto 13). Tu mensaje pide auditar contra un límite de **3**.

No lo cambié — es una decisión de producto, no un bug, y no quiero asumir cuál de las dos es la vigente. Si de verdad quieres volver a 3, es un cambio de una línea (`propiedadesLocales.ts`) + actualizar la mención en `BACKEND.md` §3 y el texto de `PublishForm.tsx` (usa la constante, no un número fijo, así que no hay que tocar el texto). Lo incluyo como acción pendiente en la sección de soluciones, pero **no lo ejecuto hasta que confirmes**.

---

## 1. Hallazgo crítico — publicar una propiedad hoy la deja inalcanzable para cualquiera

### Actualización — 2026-08-10, confirmado por el usuario

Dos decisiones ya confirmadas, **pendientes de aplicar** (código sin tocar todavía, a propósito):

- **Límite de propiedades activas:** 4 → **3** (`LIMITE_PROPIEDADES_GRATIS`, `src/lib/propiedadesLocales.ts:232`). Revierte la subida a 4 del 2026-08-09.
- **Límite de fotos por propiedad:** 4 → **5** (`MAX_FOTOS`, `src/components/forms/PublishForm.tsx:86`). Todo el texto de la UI (contador, "máximo X imágenes", "límite alcanzado") ya usa esta constante — un solo cambio de número basta, sin tocar copy.
- También hay que actualizar `docs/BACKEND.md` §3 (punto 13 menciona el límite de 4 propiedades; el resumen de cambios de hoy menciona "bajó de 6 a 4" fotos) para que el contrato del backend quede consistente con estos dos nuevos valores.

### ⚠️ Actualización — 2026-08-17, RESUELTO antes de implementar (verificado con `git log`)

**Este hallazgo crítico ya no aplica.** Entre que se escribió este documento y hoy, el equipo migró la escritura de `Property` al backend real: commit `92658f1` ("feat: escritura de Propiedades contra el backend real (BACKEND.md §3)"), posterior a `e9b8062` (el commit que causó el bug original). Verificado directo en el código, no solo por el mensaje del commit:

- `PublishForm.tsx` ya hace `POST /propiedades` y `POST /propiedades/fotos` contra el backend real — ya no escribe en `localStorage`.
- `propiedades/[id]/page.tsx` trae un comentario explícito: *"Property ya es real en el backend (docs/BACKEND.md §3) — las propiedades se crean/pausan/eliminan en cualquier momento"*.
- `PropertyCard.tsx` y `dashboard/propiedades/page.tsx` ya no tienen ningún condicional `esLocal` — no hace falta, ya no hay dos mundos que reconciliar.
- `src/lib/propiedadesLocales.ts` (el archivo que originó el hallazgo) ya no existe.
- El Prisma local completo se borró (commit `030c137`) — todo el módulo de propiedades vive en el backend separado.

**No se implementa el plan A (fallback local) de este hallazgo — sería reintroducir código muerto sobre una arquitectura que ya avanzó.** La opción B (que era el objetivo real) ya está resuelta. Se deja el hallazgo original abajo sin borrar, como registro histórico de por qué se investigó, pero **no representa el estado actual del código**.

### Qué encontré

El corte de backend de hoy (commit `e9b8062`, "lectura pública de Propiedades contra el backend") migró `src/app/propiedades/[id]/page.tsx` para leer **exclusivamente** del backend nuevo (`backendFetchServer`). Antes de ese commit, la misma página tenía una rama explícita:

```
// esPropiedadLocal(id) -> render <LocalPropertyDetail id={id} .../>
```

que leía la propiedad desde `localStorage` cuando el id empezaba con `local-` (el prefijo que genera `generarIdLocal()` al publicar). Esa rama, y el componente completo `LocalPropertyDetail.tsx`, **se eliminaron** en el mismo commit — confirmado con `git log`/`git show` contra el commit anterior (`d930594`).

El problema: **la escritura de `Property` sigue sin migrar** (`docs/BACKEND.md`, §3, y el propio `docs/CLAUDE-BACKEND-SKILLS.md` que armamos hoy ya lo señala como primera tarea pendiente). `PublishForm.tsx` sigue llamando `crearPropiedad()` → guarda en `localStorage`, nunca en el backend real. Así que **toda propiedad publicada hoy tiene un id que el backend jamás va a reconocer**, y la página que antes sabía leer esos ids locales ya no existe.

Y no es solo el dueño quien se queda sin poder ver su propia publicación: revisé `PropertyCard.tsx` (la tarjeta que se usa en `/propiedades`, `/mapa`, Home, "similares", comparar) y **no tiene ningún condicional `esLocal`** — enlaza siempre a `/propiedades/[slug]` sin excepción. Como `aplicarOverridesPublicos()` sí mezcla las propiedades locales dentro del catálogo que ve cualquier visitante (confirmé que `/propiedades`, `/mapa`, favoritos y comparar la llaman), una propiedad recién publicada **sí aparece en resultados de búsqueda** (incluida la búsqueda por IA, que solo filtra sobre ese mismo catálogo ya mezclado) — pero cualquiera que le dé clic cae en un 404 real (`notFound()`).

El único lugar que sí lo sabe evitar es `dashboard/propiedades/page.tsx` — ahí ya hay un condicional `esLocal` que no convierte la miniatura/título en link cuando es local (con un tooltip "Publicada en esta vista previa — no tiene ficha pública todavía"). Ese tooltip es honesto sobre la limitación de fondo (no hay backend real todavía), pero **antes de hoy sí había una ficha pública real** (la que servía `LocalPropertyDetail.tsx`) — se perdió como efecto secundario no intencional de la migración, no por una decisión de producto.

### Impacto en Fase 1

Esto rompe la promesa central de la fase ("que los usuarios puedan publicar sus propiedades") en el punto más básico: publicar "funciona" (el formulario completa, redirige al dashboard, la propiedad aparece en "Mis propiedades" y en resultados de búsqueda), pero **la propiedad no tiene una página pública real que alguien interesado pueda abrir, compartir, o mandar por WhatsApp**. Es el equivalente a una vitrina vacía: se ve en la lista, pero al entrar no hay nada.

### Solución propuesta (no aplicada)

Dos caminos, de más rápido a más completo:

**A. Restaurar el fallback local (corto plazo, horas).** Reintroducir la lógica de `esPropiedadLocal(id)` en `propiedades/[id]/page.tsx`: si el id es local, renderizar un componente cliente que lea `localStorage` (recuperar `LocalPropertyDetail.tsx` del historial de git — `git show d930594:src/components/property/LocalPropertyDetail.tsx` — y adaptarlo a como quedó `PropertyDetailView.tsx` hoy, que sí cambió de forma en el mismo commit). Y agregar el mismo condicional `esLocal` que ya existe en el dashboard a `PropertyCard.tsx`, para que ningún visitante llegue a un link roto desde ningún punto de entrada.

**B. Cerrar el hueco de raíz (la solución real, ya documentada).** Implementar `POST /propiedades` en el backend nuevo — es exactamente el punto 1 de "Qué hacer con cada una" en `docs/CLAUDE-BACKEND-SKILLS.md`, y todo el contrato ya está detallado en `BACKEND.md` §3 (incluidas las 13 validaciones server-side que hoy solo existen en el navegador). Con esto, una propiedad publicada nace ya como un id real del backend, y la página de detalle (que ya funciona para propiedades reales) la sirve sin ningún caso especial.

**Recomendación:** A ahora mismo (es la diferencia entre "Fase 1 funciona" y "Fase 1 se ve rota"), B como el trabajo real de fondo que ya estaba planeado.

---

## 2. Funciones — flujo de publicación (`PublishForm.tsx`)

Aparte del hallazgo #1, el formulario en sí está sólido — ya pasó varias rondas de auditoría en sesiones anteriores (fraude, imagen, lenguaje sensible, límites geográficos de Tabasco, límite de cuenta, PII). No hay bugs funcionales nuevos que reportar en la lógica del formulario en sí.

**Hallazgo menor — página de agradecimiento huérfana.** `src/app/publicar/gracias/page.tsx` existe, está bien construida (celebración, "qué sigue", botones a gestionar/ver propiedades), y sigue protegida por `proxy.ts` — pero **nada la enlaza**. `onSubmit` en `PublishForm.tsx` hace `router.push('/dashboard/propiedades')` directo, nunca pasa por `/publicar/gracias`. La escritura a `sessionStorage.setItem('lastPublishedProperty', ...)` (línea 508) solo tiene sentido si algo la lee — hoy nada la consume en el flujo real.

*Solución propuesta:* decidir uno de los dos, no dejarlo a medias — (a) restaurar el redirect a `/publicar/gracias` tras publicar (mejor primera impresión, momento de celebración real antes de aterrizar en una lista de gestión), o (b) si la decisión de producto fue ir directo al dashboard a propósito, borrar `publicar/gracias/page.tsx` y la escritura a `sessionStorage` que ya no sirve. Mi recomendación: (a) — es una mejor experiencia de "algo importante acaba de pasar" que aterrizar directo en una tabla de gestión.

---

## 3. UI — diseño del flujo

Con la lente de `frontend-design`/`ui-ux-pro-max` sobre lo que ya existe:

- El wizard de 6 pasos, la barra de progreso en píldoras, y el panel lateral de riesgo de inundación (solo desktop) están bien resueltos — coherente con el resto del rediseño "Tabasco" de esta sesión.
- **Hallazgo de accesibilidad real:** los tres grupos de opciones tipo "chip" (Operación venta/renta, Riesgo de inundación bajo/medio/alto, Método de contacto) usan un `<input type="radio" class="sr-only">` con un `<div>` visual al lado que cambia de color según `watch(...)`. El input sí recibe foco de teclado (Tab funciona), pero **el `<div>` visual no tiene ningún estilo `:focus-visible`** — alguien navegando solo con teclado no tiene forma de ver cuál opción tiene el foco antes de seleccionarla con espacio/flechas. Esto es un incumplimiento directo de WCAG 2.4.7 (Focus Visible), y aplica a las tres instancias del mismo patrón (`toggleCls` en `PublishForm.tsx`).
- El badge "Principal" en la primera foto, el estado "pendiente" (spinner) y "no apta" (overlay rojo) sobre cada preview están bien resueltos visualmente — feedback claro sin necesitar texto largo.

*Solución propuesta:* agregar `peer` al input y `peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2` (o equivalente) a los tres `<div>` que usan `toggleCls` — cambio de Tailwind puro, sin tocar lógica, aplica a los tres patrones a la vez si se extrae a una clase compartida en vez de repetirla tres veces.

---

## 4. UX — el flujo completo, de principio a fin

Trazando el camino real de alguien publicando:

1. Llena 6 pasos → bien resuelto, con auto-detección de riesgo de inundación y auto-generación de descripción con IA como asistencia real, no decorativa.
2. Publica → **cae directo en gestión (dashboard), sin momento de "listo, ya está publicada"** (ver hallazgo #2).
3. Quiere compartir su propiedad (WhatsApp, redes) → **no puede, porque el link público 404 (ver hallazgo #1)**. Este es el punto donde la UX se rompe de verdad: todo el esfuerzo de llenar el formulario termina en un anuncio que el dueño no puede ni mostrarle a un conocido.
4. Vuelve a publicar una segunda propiedad → el gate de límite (4, o 3 si se confirma el cambio) es claro y honesto, con CTA de contacto para plan profesional en vez de fingir un flujo de pago que no existe. Bien resuelto.

El hallazgo #1 no es solo un bug técnico — es *el* problema de UX de esta fase: el objetivo declarado ("captar usuarios y que alimenten la plataforma") depende de que compartir un anuncio funcione, y hoy no funciona para nadie que publique.

---

## 5. Arquitectura

Ya extensamente documentada en `docs/BACKEND.md` (§3, §13) y en `docs/CLAUDE-BACKEND-SKILLS.md` de hoy — no la repito completa aquí, solo el ángulo específico de Fase 1:

**El corte de backend de hoy migró lectura sin coordinar con que escritura sigue local — eso es exactamente lo que produjo el hallazgo #1.** No es un problema de que falte trabajo (eso ya estaba bien mapeado); es que migrar solo una mitad de un par lectura/escritura sin un fallback dejó un hueco funcional real en producción de la app, no solo en la documentación. Vale la pena, para el resto de la migración, tratar cada par lectura/escritura como una unidad — no dar por completo un módulo hasta que ambos lados estén al mismo nivel, o dejar explícito el fallback mientras uno de los dos avanza antes que el otro (como sí se hizo bien, por ejemplo, con el patrón `esLocal` del dashboard).

---

## 6. Búsqueda por IA — en el contexto específico de Fase 1

La calidad de extracción de filtros de la IA ya se auditó a fondo esta misma sesión (dos bugs reales encontrados y corregidos: "500 metros" mal leído como precio, "2km" mal leído como precio). Para el alcance de Fase 1 específicamente, lo relevante es una pregunta distinta: **¿una propiedad recién publicada aparece en la búsqueda?**

Confirmé que sí — `aplicarOverridesPublicos()` mezcla las propiedades locales al catálogo que consume `PropertiesClient.tsx`, y `applyFilters` (que interpreta lo que la IA extrae) corre sobre ese catálogo ya mezclado. La búsqueda por IA **no tiene ningún bug propio aquí** — encuentra correctamente una propiedad recién publicada. El problema es exclusivamente el destino al que manda (hallazgo #1): la búsqueda hace bien su trabajo y entrega a la persona justo a la propiedad que buscaba, pero esa propiedad 404.

---

## 7. Auditoría contra `ceo-platform-standards` (skill nueva, 2026-08-16)

> **Metodología de esta sección:** lectura de código real (grep + lectura directa) contra los "hard gates" medibles de la skill `ceo-platform-standards` (`references/quality-gates.md`). **Sin tocar código, ningún archivo modificado.** Lo que necesita medición en runtime (LCP, CLS, scroll horizontal real en dispositivo) queda marcado explícitamente como no verificado en esta pasada — no se inventa un número que no se midió.

### Gates que SÍ pasan (confirmado por código, no solo por intención)

- **Empty states con CTA** — `/propiedades` (`PropertiesClient.tsx:620-633`) distingue "no pudimos interpretar tu búsqueda" de "sin resultados", ofrece el CTA "Quitar filtros", y hasta muestra resultados similares como fallback. Mejor que el mínimo que pide el gate.
- **Rate limiting** — `src/lib/rateLimit.ts` ya está aplicado en 16 rutas API, incluidas las sensibles (las 5 rutas de IA, contacto de propiedad/servicio, reportar anuncio, solicitar revisión, notificar alertas). Cubierto de forma amplia, no solo en un punto.
- **Adaptación de input por dispositivo** — `type="tel"`/`type="number"`/`inputMode` presentes en los 5 formularios donde aplica (`PublishForm`, `PublishServicioForm`, `ContactForm`, editar propiedad, alertas).
- **Profundidad de navegación ≤3 niveles** — mapeadas las 39 rutas de `src/app`; ninguna función crítica pasa de nivel 3 (`dashboard/propiedades/[id]/editar` y `dashboard/servicios/[id]/portafolio` son las más profundas, justo en el límite, no por encima).
- **Foco visible en inputs estándar** — `Input.tsx`/`Select.tsx` sí reemplazan el outline nativo con `focus:ring-2` al usar `outline-none` — no es un hueco general, ver el hallazgo específico abajo.

### Hallazgos nuevos

| # | Hallazgo | Severidad | Evidencia | Acción propuesta | Esfuerzo |
|---|---|---|---|---|---|
| 5 | El patrón chip-radio sin foco visible (hallazgo #3 original) **también existe en `dashboard/propiedades/[id]/editar/page.tsx`**, no solo en `PublishForm.tsx` — mismo bug, un archivo más de lo documentado | 🟡 Medio (accesibilidad) | `grep` del patrón `sr-only` + `type="radio"` — 2 archivos, no 1 | Mismo fix (`peer-focus-visible`), aplicar a ambos archivos | Trivial |
| 6 | Botones tamaño `sm`/`md` (el default de `<Button>`) no alcanzan el touch target mínimo de 44×44px | 🟡 Medio | `Button.tsx`: `md` = `py-2.5` (10px×2) + texto `text-sm` (~20px línea) ≈ 40px alto; `sm` = `py-1.5` (6px×2) ≈ 32px alto. Solo `lg`/`xl` (`py-3`/`py-3.5`) llegan a ~44-48px | Confirmar si aplica el estándar de 44px a esta plataforma (es guía de accesibilidad táctil, no ley) — si sí, subir el `py` de `md` o usarlo solo en desktop | Chico si se decide aplicar |
| 7 | Colores hardcodeados en `page.tsx` (Home) para los indicadores de riesgo de inundación, **a pesar de que el token idéntico ya existe** en `globals.css` | 🟢 Bajo (consistencia, no visual) | `globals.css:25-27` define `--color-success:#10B981`, `--color-warning:#F59E0B`, `--color-danger:#EF4444` — `page.tsx:303-305` repite los mismos 3 valores como hex literal en vez de `var(--color-success)` etc. | Reemplazar los 3 literales por los tokens ya existentes — cero cambio visual, solo consistencia | Trivial |
| 8 | Cero instrumentación de analítica de producto en toda la plataforma | 🟡 Medio | `grep` de `gtag\|posthog\|plausible\|mixpanel\|vercel/analytics` en todo `src` — 0 resultados | Decidir herramienta (Plausible/PostHog auto-hospedado encajan mejor con el resto de la plataforma que Google Analytics, dado el criterio ya aplicado aquí de minimizar dependencias de Google) y al menos instrumentar los eventos clave de Fase 1: publicar completado, contacto revelado, búsqueda ejecutada | Medio — depende de la herramienta elegida |
| 9 | Breadcrumbs solo en 3 de las rutas nivel 2-3 que existen (`PropertyDetailView`, `zonas/[slug]`, `blog/[slug]`) — faltan en las rutas nivel 3 de `/dashboard` y todas las de `/admin` | 🟢 Bajo | `grep` de `breadcrumb` — 3 archivos; las rutas nivel 3 identificadas en el hallazgo de profundidad (`dashboard/propiedades/[id]/editar`, `dashboard/servicios/[id]/portafolio`) no están entre ellas | Agregar breadcrumb a esas 2 rutas nivel 3 primero (son las que el gate exige), evaluar `/admin` después | Chico |

### No verificado en esta pasada (requiere runtime, no solo lectura de código)

- **LCP <2.5s, CLS <0.1** — necesitan Lighthouse/Chrome DevTools contra la app corriendo, no una auditoría de código estático. Pendiente.
- **Cero scroll horizontal 320px→3840px** — hay un commit reciente en este mismo repo ("Auditoría de responsividad: corregir navbar, tarjetas y overflow en tablet/móvil") que ya atacó este problema — no se re-verificó a fondo aquí si quedó 100% resuelto en todos los breakpoints del gate. Pendiente de confirmar con el navegador real, no solo confiar en que el commit lo cerró todo.
- **i18n** — la plataforma es español-únicamente por ser regional (Tabasco). No es un hallazgo, es una decisión de producto correcta para el alcance actual — se documenta para que quede explícito que se revisó, no que se pasó por alto.

## 8. Auditoría de los dominios restantes — Legal, Seguridad, Marketing/SEO, Operaciones, Data governance (2026-08-16)

> Completa la sección 7 — ahí solo se cubrió Diseño/UX/IA/Responsividad. Misma metodología: lectura de código real, sin tocar nada.

### Legal / Compliance

- **PASS — Aviso de privacidad real, no genérico.** `src/app/privacidad/page.tsx`: describe con precisión qué se recolecta (incluye la distinción correcta entre lo que vive en servidor vs. solo en `localStorage`), para qué se usa, con quién se comparte (proveedores de correo transaccional y OAuth, nombrados), derechos ARCO, y un formulario real de eliminación de cuenta en la misma página — no solo un correo de contacto. Fechado (30 jul 2026).
- **PASS — Términos y condiciones sustanciales, y sí están conectados.** `TermsModal.tsx` no es una página huérfana (a diferencia del hallazgo #2 de `/publicar/gracias`) — se usa de verdad en `PublishForm.tsx`, en el punto exacto donde más importa (antes de publicar contenido de un tercero). Cubre naturaleza del servicio, responsabilidad del usuario sobre el contenido, exclusión de responsabilidad en transacciones, el disclaimer específico de riesgo de inundación, usos prohibidos y moderación. El propio código ya se autoseñala: "Recomendación: someter a revisión de un abogado con cédula en México antes de lanzamiento a producción — este texto es una base robusta, no asesoría legal" — honestidad ya incorporada, no hace falta que yo la agregue.
- **Hallazgo 10 — Términos solo existen como modal, no hay página `/terminos` independiente.** No se puede enlazar desde el footer ni compartir un link directo a los términos completos; solo aparece en el flujo de publicar. Menor, pero real.
- **Hallazgo 11 — sin banner de consentimiento de cookies.** Hoy no es grave: no hay cookies de analítica/tracking que requieran consentimiento (ver hallazgo #8, cero instrumentación). Se vuelve obligatorio en el momento en que se implemente analítica — debe ir junto, no después.

### Seguridad

- **PASS, fuerte — cabeceras de seguridad ya resueltas en una auditoría previa.** `next.config.ts` ya trae CSP (con `connect-src` acotado exactamente a Google/Facebook, nada abierto), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, y HSTS solo en producción. El propio archivo documenta el hallazgo que lo motivó (clickjacking) — esto no es mío, ya estaba resuelto antes de esta pasada, lo confirmo como gate cumplido.
- **Nota, no hallazgo — hashing de contraseña no vive en este repo.** `grep` de `bcrypt`/`hash` en `src/lib/auth.ts` no encontró nada — esperado dado que el backend real (JWT propio, proyecto separado, ver `docs/BACKEND.md`) es quien posee el almacenamiento de credenciales, no este frontend. No es un hueco de este código.
- **No verificado en esta pasada** — auditoría de dependencias (`npm audit` / vulnerabilidades conocidas en `package.json`), no se corrió.

### Marketing / Growth / SEO

- **PASS — sitemap dinámico y completo.** `src/app/sitemap.ts` genera URLs reales de propiedades, zonas y municipios con prioridad diferenciada (destacadas más alto), no un sitemap estático de 5 líneas. `robots.ts` también existe.
- **PASS — metadata específica en las páginas de detalle** que más importan para SEO: propiedad, zona, servicio, blog (`generateMetadata` presente en los 4).
- **Hallazgo 12 — cero datos estructurados (JSON-LD).** `grep` de `application/ld+json` en todo `src` — 0 resultados. Sin marcado Schema.org (`RealEstateListing`/`Product`/`Offer`), Google no puede mostrar precio, tipo de propiedad o ubicación como rich snippet en resultados de búsqueda — se pierde visibilidad gratuita justo en el tipo de contenido (fichas de propiedad) donde más rinde.

### Operaciones

- **Hallazgo 13 — cero monitoreo de errores/observabilidad.** `grep` de `Sentry`/`LogRocket`/`Bugsnag` — 0 resultados en todo `src`. Hoy, si algo falla en producción, el único rastro es lo que el usuario reporte a mano — no hay forma de saberlo primero.
- **Hallazgo 14 — sin endpoint de health-check ni documentación de a quién le suena el teléfono si el sitio cae.** `docs/BACKEND.md` no menciona monitoreo, uptime ni proceso de incidentes. Coincide exactamente con el hueco que la fase "Operational readiness" de `ceo-platform-standards` pide cerrar antes de lanzar, no después.

### Data governance

- **❌ Corrección — el hallazgo original de esta subsección estaba mal (2026-08-17).** Decía que `prisma/schema.prisma` tenía `Property` comentado, confirmando el hallazgo #1. Error mío: no verifiqué que **el directorio `prisma/` completo ya no existe** (borrado en el commit `030c137`, posterior a mi lectura original) — cité un archivo que ya no está ahí. `Property` no está "pendiente de tabla": vive real en la base de datos del backend separado, confirmado igual que en la corrección del hallazgo #1 arriba. Se deja esta nota en vez de borrar el error, mismo criterio de honestidad que rige el resto del documento — es más útil mostrar que se corrigió que fingir que no pasó.
- **Segunda corrección, misma verificación (2026-08-17):** tampoco hay `User` local ya. `src/lib/auth.ts` confirma que `getSession()` "ya no verifica un JWT localmente — la sesión vive del lado del backend separado", y solo reenvía la cookie a `GET /auth/me`. Este repo de Next.js hoy no tiene base de datos propia en absoluto (`prisma/` existe como carpeta pero sin `schema.prisma` adentro, solo archivos `.db` sueltos y huérfanos — candidatos a borrar, ver hallazgo nuevo abajo). Los campos que antes describía el modelo `User` (email, password nullable, nombre, rol, googleId/facebookId, avatar) siguen siendo la superficie real de datos — solo que ahora viven exclusivamente en el backend separado, no aquí. No cambia la conclusión (la lista de campos sigue viéndose justificada, sin captura "por si acaso"), pero la afirmación de *dónde* vive tiene que ser correcta.
- **Hallazgo 15 — dos archivos `.db` huérfanos en `prisma/`** (`habita.db`, `vivevillahermosa.db`). Sin `schema.prisma`, nada los usa ni los puede usar — mismo patrón que el commit `030c137` ya limpió para código, aquí quedó pendiente para los archivos de datos. Verificar que no tengan nada que alguien necesite rescatar y borrarlos.

## Resumen de acciones propuestas (ninguna aplicada todavía)

| # | Hallazgo | Severidad | Acción propuesta | Esfuerzo |
|---|---|---|---|---|
| 0 | Límite dice 3 en tu mensaje, 4 en el código | — | **Ya confirmado 2026-08-10 (ver arriba): 3 propiedades / 5 fotos.** Implementado en esta pasada | Trivial — hecho |
| 1 | ~~Propiedad publicada 404 en su propia ficha pública~~ | ✅ Resuelto | **Ya resuelto, commit `92658f1`, verificado 2026-08-17 — ver actualización en la sección 1.** No se implementa el fallback local (sería regresivo) | — |
| 2 | `/publicar/gracias` huérfana, sin uso | 🟡 Medio | Restaurar el redirect tras publicar, o borrar la página | Trivial — implementado |
| 3 | Sin foco visible de teclado en chips de radio (Operación/Riesgo/Contacto) — también en `dashboard/propiedades/[id]/editar` (ver #5) | 🟡 Medio (accesibilidad) | Agregar `peer-focus-visible` a los 3 patrones `toggleCls`, en ambos archivos | Trivial — implementado |
| 4 | ~~Migrar lectura sin escritura dejó un hueco funcional~~ | ✅ Resuelto | Moot — ambos lados (lectura y escritura) ya están migrados. Ver #1 | — |
| 5 | Ver hallazgo #5 arriba — chip-radio sin foco también en editar propiedad | 🟡 Medio | Mismo fix que #3 | ✅ Implementado 2026-08-17 |
| 6 | Botones `sm`/`md` bajo el mínimo táctil de 44px | 🟡 Medio | `md` (default) subido a 44px exactos. `sm` se deja igual a propósito (UI densa, más archivos que revisar) | ✅ `md` implementado · `sm` pendiente |
| 7 | Colores de riesgo hardcodeados en Home pese a que el token ya existe | 🟢 Bajo | Reemplazados los 3 literales por `var(--color-success/-warning/-danger)` | ✅ Implementado 2026-08-17 |
| 8 | Cero analítica de producto en toda la plataforma | 🟡 Medio | PostHog Cloud (plan gratis) elegido y conectado — `src/instrumentation-client.ts`, evento `propiedad_publicada` instrumentado en `PublishForm.tsx` | ✅ Implementado 2026-08-17 |
| 9 | Breadcrumbs ausentes en las 2 rutas de nivel 3 reales | 🟢 Bajo | Agregado a `dashboard/propiedades/[id]/editar` y `dashboard/servicios/[id]/portafolio` | ✅ Implementado 2026-08-17 |
| 10 | Términos y condiciones solo existen como modal, sin página `/terminos` independiente | 🟢 Bajo | `src/app/terminos/page.tsx` nueva, contenido compartido vía `src/lib/termsSections.ts`, enlazada en el footer | ✅ Implementado 2026-08-17 |
| 11 | Sin banner de consentimiento de cookies | 🟢 Bajo (hoy) | Resuelto sin banner: PostHog configurado con `persistence: 'localStorage'` (nunca pone cookie), sin capturar contenido de formularios | ✅ Resuelto de raíz 2026-08-17 — no se necesitó banner |
| 12 | Cero datos estructurados (JSON-LD) en fichas de propiedad | 🟡 Medio (SEO) | `RealEstateListing`/`Offer` agregado en `propiedades/[id]/page.tsx` | ✅ Implementado 2026-08-17 — no verificado visualmente en vivo (backend de producción tenía 0 propiedades al momento de implementar) |
| 13 | Cero monitoreo de errores en producción (sin Sentry ni equivalente) | 🟡 Medio | Lado frontend: PostHog también captura errores del navegador con la misma integración. Lado backend: pendiente, `posthog-node` recomendado en `docs/BACKEND-17082026.md` | 🟡 Frontend cubierto de paso · backend pendiente |
| 14 | Sin health-check ni proceso de incidentes documentado | 🟡 Medio | `GET /api/health` nuevo (hace ping real al backend) | ✅ Parche mínimo implementado — proceso de incidentes (quién responde) sigue sin definir, es una decisión de personas, no de código |
| 15 | Dos archivos `.db` huérfanos en `prisma/` (`habita.db`, `vivevillahermosa.db`), sin `schema.prisma` que los use | 🟢 Bajo | Confirmado gitignorados, sin `schema.prisma` que los referencie | ✅ Borrados 2026-08-17 |

## Implementación — 2026-08-17

Se implementó lo aplicable del plan de arriba directo en este repo. Resumen de lo que cambió, verificado con `npx tsc --noEmit` (limpio) + `npx eslint` (0 errores) + servidor de desarrollo real levantado y cada ruta tocada probada con `curl` (incluyendo un bug real encontrado y corregido en el camino, ver abajo):

- **Punto 0 y hallazgo #1**: verificados contra el código actual antes de tocar nada — resultó que #1 (crítico) ya estaba resuelto por un commit posterior a este documento (`92658f1`), y el límite de 3 propiedades/5 fotos sí seguía pendiente de aplicar. Ver las correcciones ya insertadas arriba, en las secciones 1 y 8.
- **Backend conectado a producción**: `NEXT_PUBLIC_API_URL` en `.env.local` ahora apunta a `https://vivevillahermosa-be-production.up.railway.app/api/v1` (antes `localhost:3001`) — pedido aparte del usuario durante esta misma sesión de implementación. Verificado con vida (`GET /propiedades` real) antes y después de conectar. **Riesgo real sin resolver:** el `JWT_SECRET` local puede no coincidir con el de Railway — ver `docs/BACKEND-17082026.md` punto 1.
- **Bug nuevo encontrado y corregido durante la implementación:** la página `/terminos` nueva tiraba error 500 (`TERMS_SECTIONS.map is not a function`) — un Server Component no puede importar de forma confiable un export plano de un archivo `'use client'` (Next envuelve todos sus exports en una referencia de cliente). Se movió el contenido a `src/lib/termsSections.ts` (sin directiva de cliente/servidor), y tanto `TermsModal.tsx` como la página nueva importan de ahí. Verificado en vivo tras el fix: `200 OK`, contenido completo renderizado.
- **`docs/BACKEND.md` ya no existe en este repo** (se borró en `030c137`, antes de esta pasada) — los cambios que antes hubieran ido a su §3 se documentaron en el nuevo `docs/BACKEND-17082026.md` en su lugar.

### Actualización — mismo día, hallazgos #8/#11/#13: analítica implementada

Después de conversar sobre qué herramienta convenía para este caso (plataforma sin ingresos todavía, ya con criterio establecido de minimizar dependencias de Google, aviso de privacidad ya comprometido a "no vender datos a nadie"), se decidió y conectó **PostHog Cloud, plan gratis**:

- `posthog-js` instalado, inicializado en `src/instrumentation-client.ts` (convención nativa de Next 15.3+, corre antes de la hidratación).
- Configurado sin cookies (`persistence: 'localStorage'`), sin capturar contenido de formularios (`autocapture` limitado a clics), y sin crear perfil de nadie anónimo (`person_profiles: 'identified_only'`) — **resuelve el hallazgo #11 de raíz, no lo pospone**: no hace falta banner de consentimiento con esta configuración.
- Un evento real instrumentado: `propiedad_publicada` (tipo/operación/municipio/si tiene fotos — nunca datos de contacto), en el punto exacto donde se completa la publicación.
- `src/app/privacidad/page.tsx` actualizado (§2 y §4) para nombrar PostHog explícitamente — mismo criterio de transparencia que ya usa el resto del aviso.
- Hallazgo #13 (monitoreo de errores): PostHog también captura errores de navegador con la misma integración, así que el lado frontend quedó cubierto de paso. El lado del backend (NestJS) sigue pendiente — documentado en `docs/BACKEND-17082026.md` punto 6, con `posthog-node` como opción recomendada (mismo proyecto, sin dar de alta Sentry aparte).
- **Falta un paso manual que no puedo hacer yo:** crear la cuenta/proyecto real en posthog.com y pegar la `NEXT_PUBLIC_POSTHOG_KEY` en `.env.local` (y en las variables de entorno de donde se despliegue producción) — sin eso, el código ya está listo pero no envía nada todavía (se salta en silencio, mismo patrón que el resto de integraciones opcionales de este proyecto).

---

## 9. Auditoría con `ceo-platform-standards` — diseño, enfoque al usuario, proyección, escalabilidad, transparencia, seguridad (2026-08-17)

> Pedido explícito de usar las skills instaladas para auditar Fase 1 (publicar propiedades) en 6 dimensiones. Diseño/UX/IA/responsividad/legal/seguridad de headers/marketing-SEO/operaciones ya se cubrieron en las secciones 7-8 — aquí solo lo nuevo: proyección, escalabilidad, transparencia a fondo, y seguridad real (no solo headers).

### 🔴 Seguridad — vulnerabilidad real encontrada y corregida

`npm audit` (ya mencionado como "no verificado" en la sección de Seguridad de arriba) se investigó a fondo esta vez: **Next.js 16.2.9 tenía CVEs de severidad alta activos**, incluyendo *"Middleware / Proxy bypass in App Router applications"* y *"Server-Side Request Forgery in rewrites"* — directamente relevante porque `src/proxy.ts` es el mecanismo real que protege `/dashboard`, `/admin` y el flujo de publicar. Fix disponible sin bump mayor (16.2.9 → 16.3.1, no rompe compatibilidad).

**Aplicado y verificado:** `npm install next@16.3.1` → `next` desaparece de `npm audit` (7 vulnerabilidades → 4, las 4 restantes son herramientas de build — `postcss`/`brace-expansion`/`js-yaml`, no código que corre en producción). `npx tsc --noEmit` limpio, servidor real levantado, 8 rutas probadas (`/`, `/propiedades`, `/mapa`, `/zonas/villahermosa`, `/terminos`, `/publicar`, `/api/health`, `/sitemap.xml`) — todas responden igual que antes.

Efecto secundario benigno: Next 16.3 regenera un bloque autogestionado en `AGENTS.md` (`<!-- BEGIN:nextjs-agent-rules -->`) en cada `next dev` — no toca el resto del archivo, es intencional (el propio bloque lo dice), no hace falta revertirlo.

### 🟡 Escalabilidad — 2 hallazgos reales

**Hallazgo A — fotos se subían secuencialmente, ya corregido.** `PublishForm.tsx`: cada foto se subía una por una (`for...of` con `await` adentro) — con `MAX_FOTOS` subido hoy mismo de 4 a 5 (punto 0 de este documento), esto alarga la espera real de publicar en proporción directa al número de fotos. **Corregido:** `Promise.allSettled` sube las 5 en paralelo, preservando el orden real de selección (importa: la primera foto es la "Principal") y el criterio de "si una falla, se omite, no se pierde toda la publicación". Verificado con `tsc`/`eslint` limpios.

**Hallazgo B — `getAllProperties()` pide TODO el catálogo en una sola llamada (`GET /propiedades?all=true`), sin paginar.** Usado por el sitemap, `PropertiesClient.tsx` (búsqueda/filtros) y las páginas de zona. Confirmado con una prueba real: el backend en Railway, sin `all=true`, ya responde con paginación nativa (`{"propiedades":[],"total":0,"page":1,"perPage":20,"totalPages":0}`) — **la capacidad de paginar ya existe del lado del backend, el frontend simplemente no la usa.** Es una decisión de arquitectura consciente, no un descuido: el buscador de `/propiedades` filtra instantáneo del lado del cliente (sin ida y vuelta al servidor por cada cambio de filtro), y eso requiere tener el catálogo completo ya cargado. **No es un problema hoy** (pocas decenas de propiedades) **y sí lo será conforme la plataforma crezca** — exactamente el tipo de cosa que "proyección" (ver abajo) debería anticipar antes de que duela. No se cambia ahora: mover a búsqueda paginada/filtrada del lado del servidor es un rediseño real de la UX de búsqueda (de instantáneo a con espera de red), no una migración de una línea — se documenta para decidir cuándo, no se improvisa hoy.

### 🟢 Proyección — el hueco no es de código, es de definición

Con PostHog ya conectado (hallazgo #8), la plataforma por fin puede *medir* si Fase 1 funciona — pero no existe, en ningún documento, una definición escrita de **qué significa "funcionar"**. No hay un `docs/fase1-spec.md` ni equivalente con criterios de éxito (ej. "N propiedades publicadas en 30 días", "% de flujos de publicar que se completan", "% de propiedades publicadas que reciben al menos 1 contacto en 2 semanas"). Se investigó explícitamente — no existe tal documento en `docs/`. **No se inventan números aquí** (sería fabricar una meta sin que el usuario la haya decidido) — se documenta como hueco real: sin esto, tener el dato (PostHog) no sirve para decidir si Fase 1 se cerró bien o hay que seguir iterando. Recomendación: definir 2-3 números concretos antes de que haya suficiente volumen de datos para que la definición se sienta forzada a posteriori.

### 🟡 Transparencia — 1 patrón bueno confirmado, 1 hueco real

**Confirmado, ya bien resuelto:** `PublishForm.tsx` sí le avisa a quien publica que la descripción es generada por IA (*"La IA genera una descripción base que puedes editar"*, visible en el paso de descripción) — no se presenta como si la hubiera escrito la plataforma sin más.

**Hueco real — esa transparencia no llega a quien LEE el anuncio.** Una vez publicada, la descripción aparece en la ficha pública como texto normal, sin ninguna indicación de que pudo haber sido generada (y editada, o no) con IA. Quien busca propiedad no tiene forma de saber si esas palabras las escribió el dueño o un modelo. Matiz real que complica una solución simple: el dueño puede editar la descripción generada hasta que sea 100% suya — un badge fijo "Generado con IA" podría quedar mintiendo si alguien reescribió todo. No se implementa una solución a medias aquí (sería inventar un mecanismo de detección que no existe) — se documenta como decisión pendiente: opciones van desde no hacer nada (criterio válido si se considera que el contenido final es responsabilidad del publicador, ya cubierto en `TermsModal.tsx` §3) hasta guardar un flag `descripcionAsistidaPorIA` en el momento de generar y mostrarlo solo si nunca se editó después.

### Enfoque al usuario y diseño formal (Dieter Rams) — sin hallazgos nuevos, ya cubiertos

La sección 7 (WCAG, touch targets, IA de navegación, responsividad, empty states, foco visible) y la sección 3 original ya aplicaron el criterio de diseño con rigor real — pasarlas de nuevo por `design-is`/Rams no encontró nada que esas secciones no hayan cubierto ya. Sobre enfoque al usuario: el flujo de publicar (6 pasos, autodetección de riesgo, generación de descripción asistida, límite honesto con CTA de plan profesional en vez de fingir un pago que no existe) ya está diseñado alrededor del trabajo real que la persona viene a hacer, no alrededor de la conveniencia técnica de la plataforma — no se encontró fricción nueva que documentar.

### Resumen de esta sección

| # | Hallazgo | Severidad | Acción | Estado |
|---|---|---|---|---|
| 16 | Next.js 16.2.9 con CVEs activos de severidad alta (bypass de proxy/middleware, SSRF) | 🔴 Alto | Actualizar a 16.3.1 | ✅ Aplicado y verificado 2026-08-17 |
| 17 | Subida de fotos secuencial, más lenta con el límite nuevo de 5 | 🟡 Medio | Paralelizar con `Promise.allSettled` | ✅ Aplicado y verificado 2026-08-17 |
| 18 | Catálogo completo sin paginar (`?all=true`) — el backend ya soporta paginar y no se usa | 🟢 Informativo (crece con la plataforma) | Documentar para decidir cuándo migrar a búsqueda server-side | Documentado, no aplicado a propósito |
| 19 | Sin criterios de éxito escritos para Fase 1, pese a ya tener cómo medir (PostHog) | 🟢 Informativo | Definir 2-3 métricas de éxito concretas | Documentado, requiere decisión del usuario |
| 20 | Descripción con IA se avisa al publicador, no a quien lee el anuncio publicado | 🟡 Medio | Decidir entre no hacer nada (ya cubierto en ToS) o un flag que se apague al editar | Documentado, requiere decisión de producto |

---

## Anexo — UI de alto impacto, fuera del alcance de Fase 1 (para después)

> Esto **no** son hallazgos de la auditoría — son propuestas de crecimiento/diferenciación, pedidas aparte (2026-08-10), fuera del alcance declarado de este documento (que es solo "publicar propiedades"). Se documentan aquí para no perderlas, a implementar cuando Fase 1 esté cerrada. Ninguna aplicada.

1. **Fotos reales.** La palanca más grande, sola. Hoy las tarjetas muestran gradiente+ícono de tipo (`PropertyCard.tsx`, sin fotos reales todavía). Un marketplace de alto impacto (Zillow/Airbnb) es foto-driven ante todo — sin esto, la plataforma se lee como clasificado, no como marketplace premium. No depende de que el backend de fotos esté resuelto — ya funciona vía base64/`localStorage`, solo depende de que los usuarios suban.

2. **Señales de confianza visibles en la tarjeta misma**, no solo dentro de la ficha — verificado, tiempo de respuesta típico, "activo hoy". Hoy esa información, cuando existe, solo aparece al entrar al detalle.

3. **Mapa + lista como una sola experiencia fluida**, no dos vistas separadas. Hoy `/propiedades` y `/mapa` son pantallas distintas con un botón "Ver en mapa" — el patrón de alto impacto (Redfin/Zillow) resalta el pin correspondiente al pasar el mouse sobre una tarjeta, sin cambiar de pantalla.

4. **Momento de "está pasando algo"** — señal de actividad real en la ficha o tarjeta (ej. "N personas vieron esto esta semana"), **solo cuando el dato sea real** — no inventar un número, mismo criterio que ya se aplicó en otras partes de la plataforma esta sesión (nunca mostrarle a un usuario un dato fabricado). Depende de que exista una tabla de eventos real (ver `docs/BACKEND.md` §12, "Stats del dashboard" — hoy es un mock determinístico).

5. **Reordenar el Home hacia conversión de publicar, no solo exploración.** La sección "Publica en 5 minutos" ya existe pero compite visualmente con destacadas/mapa. Alto impacto = subir la prioridad visual del CTA de publicar, no solo la de buscar.

6. **Dos paletas de color distintas, no una (2026-08-10).** `.theme-tabasco` (`src/styles/globals.css`) redefine `--color-brand`/`--color-brand-dark` a verde musgo/terracota (muestreado de una foto real de patio) pero **solo envuelve el Home** (`src/app/page.tsx`) — el resto del sitio (búsqueda, dashboard, ficha de propiedad, `/mapa`) sigue con el teal esmeralda original (`#0D7065`). Riesgo real: se siente como dos productos distintos si no hay un hilo visual declarado entre ambos. Dos caminos, ninguno aplicado: (a) extender la paleta Tabasco a toda la plataforma, o (b) mantener la separación pero documentarla como decisión consciente ("Home = editorial/marca, resto = producto") en vez de dejarla como algo que ocurrió por dónde se envolvió la clase CSS.

7. **Bot de WhatsApp Business API — opción para inmobiliarias/agentes profesionales, NO para usuarios individuales (2026-08-10).** Evaluado también un bot de Telegram; se descarta porque el canal dominante real en este mercado es WhatsApp, no Telegram (la plataforma ya lo asume — `requiereMensajePrimero`, contacto directo por WhatsApp en `PublishForm.tsx`). WhatsApp Business API sí encaja con el canal correcto, pero trae requisitos y costo reales que no tiene sentido cargarle a un usuario individual publicando 1-3 propiedades gratis:
   - Verificación de Meta Business + plantillas pre-aprobadas para cualquier mensaje que la plataforma inicie primero (recordatorio de vencimiento, alerta coincidente) — no es self-serve instantáneo.
   - **Desde el 1 de octubre de 2026, Meta cobra por mensaje**, incluyendo respuestas dentro de la ventana de 24h (antes gratis) — ya no hay tier gratuito real.
   - Por eso no aplica a Fase 1 (usuario individual, límite de 3 propiedades) — el costo por mensaje no se justifica ahí. **Sí tendría sentido como diferenciador del plan profesional** (inmobiliarias/agentes con cartera real, ver `LIMITE_PROPIEDADES_GRATIS` y el "Contactar para un plan" que ya existe en `PublishForm.tsx` cuando se topa el límite) — mismo perfil de cuenta para el que ya está pensado `PlanesInmobiliaria` (hoy oculto, `docs/BACKEND.md` §15 V2). Casos de uso ahí: notificación instantánea de interesados, publicar/editar por chat, recordatorio de vencimiento, consulta de stats — todos con presupuesto real detrás porque es una cuenta que ya paga.
   - Depende, igual que el resto de este anexo, de que `Property` (escritura) sea real primero — no hay nada real sobre qué construir el bot todavía.

8. **El gradiente de color por tipo de propiedad en las cards (`PropertyCard.tsx`) va a competir con fotos reales.** Hoy resuelve bien la ausencia de foto — un gradiente distinto por tipo (casa/depto/terreno/local/oficina). Pero es la plataforma misma aportando el color; en cuanto existan fotos reales (item 1 de este anexo), foto + gradiente de fondo compiten por atención en vez de que la foto sea lo único que llame la vista. Cuando se resuelva el storage de fotos, replantear el chrome de la card hacia algo más neutro (blanco/gris, quizás un acento delgado del tipo en vez de un gradiente de fondo completo) para que la foto cargue el color, no el marco.

9. **Descubrimiento de landmarks no catalogados + sugerencia de landmark cercano (2026-08-12, diseño aprobado por el usuario, sin construir).** Cuando alguien busca un lugar que no está en `landmarks.ts` y tampoco lo resuelve `resolverLandmarkConIA()`/`resolverCategoriaConIA()` (`ai.ts`), hoy se descarta en silencio — cero registro, cero sugerencia. Mismo patrón ya probado que `ColoniaDescubierta` (tabla Prisma real, geocodifica contra Nominatim), adaptado a landmarks:

   **Pipeline propuesto** (la IA solo extrae, nunca juzga proximidad de memoria — mismo criterio anti-alucinación que ya rige el resto de la plataforma):
   1. `lugarMencionado` ya se extrae hoy (REGLA 3, `ai.ts`) cuando `landmark`/`categoriaLandmark` quedan vacíos.
   2. Si `resolverLandmarkConIA()` y `resolverCategoriaConIA()` fallan los dos (hoy el punto donde se descarta en silencio): geocodificar `lugarMencionado` contra **Nominatim** (mismo servicio, mismo rate-limit que ya respeta `descubrirColonia()`).
   3. Si Nominatim resuelve una coordenada real: calcular distancia real (`distanciaKm`, Haversine, ya existe en `colonias.ts`) contra los landmarks catalogados.
   4. Si el más cercano cae dentro de un radio configurable (propuesto 3km, pendiente de confirmar): esa es la sugerencia — **verificada por coordenadas reales, nunca por juicio del modelo**.
   5. Se registra el intento en la tabla nueva **sin importar si hubo sugerencia o no** — la frecuencia de búsquedas sin sugerencia también es información real para investigar después (mismo tipo de trabajo ya hecho a mano hoy en `docs/NUEVOS-LANDMARKS-TABASCO.md`).

   **Tabla nueva propuesta** (nombre sugerido `LandmarkBusquedaNoCatalogada`, mismo espíritu que `ColoniaDescubierta` pero contando frecuencia en vez de una fila por evento — evita crecimiento sin límite y la frecuencia ES la señal útil): texto buscado (normalizado), contador de veces buscado, coordenada geocodificada (nullable, si Nominatim la resolvió), landmark sugerido + distancia calculada (nullable), primera vista/última vista, y **estado de revisión** (`pendiente | aprobado | descartado`).

   **UX de búsqueda:** la sugerencia se muestra, nunca se aplica sola — "No encontramos ese lugar exacto, pero está cerca de [Landmark] — mostrando resultados de ahí", con opción de descartar. Nunca cambiar lo que alguien pidió sin decírselo explícitamente.

   **Cola de aprobación en `/admin` (refinamiento confirmado 2026-08-12):** mismo patrón ya construido para `SolicitudRevision`/`ReporteAnuncio` — una vista que lista lo `pendiente`, ordenado por frecuencia (lo más buscado primero). Cada fila lleva un botón **"Aprobar"**: al presionarlo, se crea de verdad la entrada nueva en el catálogo de landmarks (mismos campos que ya se usaron hoy en `NUEVOS-LANDMARKS-TABASCO.md` — `key`, `label`, `categoria`, `lat`/`lng`, `radioKm`, `aliases`) usando la coordenada ya geocodificada como punto de partida, y marca la fila como `aprobado`. Un botón "Descartar" la marca `descartado` sin crear nada — para búsquedas basura, mal escritas, o que no ameritan catalogarse. Igual que con colonias, la categoría (`salud|educacion|comercial|transporte|cultura|centro`) y el `radioKm` final siguen necesitando criterio humano al aprobar — no se auto-asignan solos, mismo motivo por el que hoy se descartó agregar bancos/gimnasios directo (no siempre encajan limpio en el enum fijo).

   **Dónde vive:** junto a `colonias/descubiertas`, en Next.js/Prisma — no en el backend nuevo, porque ese módulo (IA, §8 de `docs/BACKEND.md`) tampoco se migró todavía. Migrar de a poco un módulo sin coordinar lectura/escritura fue exactamente la causa del hallazgo crítico #1 de este mismo documento — no repetir el mismo error aquí.

   **Pendiente de confirmar antes de construir:** el radio de "cerca" (propuesto 3km), y si además de la cola de `/admin` hace falta algún filtro/orden adicional (ej. ocultar automáticamente las que ya llevan 0 sugerencias tras N búsquedas, para no llenar la cola de ruido sin señal real).

10. **Google Maps Grounding Lite (MCP oficial) — diferido hasta que la plataforma genere ingresos, NO implementar ahora (2026-08-12).** Fuente de datos de calles/colonias más precisa que Nominatim/OpenStreetMap (el método usado hoy todo el día — real, gratis, sin API key, pero con cobertura incompleta en Tabasco: 6 de 8 lugares de la segunda ronda de landmarks no salieron directo, hubo que cruzar con búsqueda web).

    - **Qué es:** endpoint MCP oficial de Google (`mapstools.googleapis.com`, lanzado finales de 2025) — datos reales de 300M+ lugares vía `search_places`, `compute_routes`, `lookup_weather`. No es scraping, es la API real de Google.
    - **Por qué no ahora:** requiere proyecto de Google Cloud + API key con facturación asociada — gratis solo mientras está en preview/pre-GA, después se cobra por uso bajo la cuenta de Maps Platform. No tiene sentido dar de alta facturación de Google para una plataforma que hoy no genera ingresos.
    - **Alternativa descartada por riesgo, no por falta de opciones:** existen skills de scraping de Google Maps (`gosom/google-maps-scraper`, otras) — **se investigaron y se descartaron a propósito**: scrapear Maps a escala viola los Términos de Servicio de Google, con riesgo real de bloqueo de IP/cuenta. No vale el ahorro de costo para una plataforma que apunta a ser líder estatal.
    - **Cuándo retomar:** cuando la precisión de calles/colonias empiece a limitar de verdad el crecimiento (más municipios, más colonias sin catalogar, el `radioKm`/coordenadas de Nominatim ya no alcanza) — en ese punto, dar de alta el proyecto de Google Cloud deja de ser un gasto prematuro y pasa a ser una mejora justificada por ingresos reales.
