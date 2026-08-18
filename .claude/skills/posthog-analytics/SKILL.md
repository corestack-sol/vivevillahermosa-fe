---
name: posthog-analytics
description: Documents how and why PostHog product analytics is wired into Vive Villahermosa (config, tracked events, privacy tradeoffs). Use when asked what PostHog is for, what benefits it gives, whether to add a new tracked event, or when auditing analytics/privacy/cookie-consent on this platform.
---

# PostHog en Vive Villahermosa

## Para qué sirve aquí

Sin esto, nadie sabe si la plataforma funciona en la práctica — solo hay
código que *debería* funcionar. PostHog contesta preguntas de producto
reales:

- ¿Cuánta gente entra a `/propiedades`, cuántos llegan a contactar a un
  dueño? (embudo real, no supuesto)
- ¿Cuántas publicaciones se completan de verdad, por tipo/operación/
  municipio? (`propiedad_publicada`, ver abajo)
- ¿Qué páginas/botones se usan y cuáles están muertos?
- Base para medir si una hipótesis de producto (Fase 2, `epic-hypothesis`)
  fue correcta — sin datos de uso, cualquier decisión de roadmap es a
  ciegas.

Beneficio concreto ganado esta sesión: antes de esto, "¿funciona el flujo
de publicar?" solo se podía responder probándolo a mano. Ahora hay un
conteo real por tipo/operación/municipio en el dashboard de PostHog.

## Dónde está configurado

- `src/instrumentation-client.ts` — init de PostHog + pageview manual
  (`onRouterTransitionStart`, porque el App Router navega sin recargar y
  el autocapture de carga inicial no ve esas navegaciones).
- `.env.local` — `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`.
  Sin `KEY`, la integración se salta en silencio (mismo patrón que
  `RESEND_API_KEY`/`GEMINI_API_KEY`) — la app funciona igual sin ella.
- Dashboard real: https://us.posthog.com (proyecto de esta plataforma).

## Por qué esta configuración específica (sin banner de cookies)

`docs/PLAN-AUDITORIA-FASE1-MVP.md` hallazgo #8/#11 — la analítica se
diseñó para NO necesitar banner de consentimiento de cookies:

- `persistence: 'localStorage'` — nunca pone cookie de terceros.
- `person_profiles: 'identified_only'` — no crea perfil de nadie
  anónimo, solo al iniciar sesión (identificación intencional).
- `autocapture: { dom_event_allowlist: ['click'] }` — NUNCA captura
  contenido de inputs/forms. Los formularios de esta plataforma
  (publicar, contacto) llevan nombre/teléfono/correo — PostHog no debe
  verlos, ni por accidente.

**Si se agrega un evento nuevo, nunca meter PII en las propiedades**
(nombre, teléfono, correo, dirección exacta). `propiedad_publicada` es el
patrón a seguir: solo `tipo`/`operacion`/`municipio`, cero datos de
contacto.

## Eventos ya trackeados

| Evento | Dónde | Propiedades |
|---|---|---|
| `$pageview` | automático, toda navegación | `$current_url` |
| `propiedad_publicada` | `src/components/forms/PublishForm.tsx` | `tipo`, `operacion`, `municipio` |
| clicks (autocapture) | toda la plataforma | posición/elemento — sin contenido de inputs |

## Cómo agregar un evento nuevo

```ts
import posthog from 'posthog-js';
posthog.capture('nombre_evento', { propiedad: valor }); // sin PII
```

Antes de agregarlo: confirmar que responde una pregunta de producto real
(no trackear "porque sí" — cada evento nuevo es una fila más en el
dashboard que alguien tiene que interpretar).
