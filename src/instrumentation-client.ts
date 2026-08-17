import posthog from 'posthog-js';

// Analítica de producto — docs/PLAN-AUDITORIA-FASE1-MVP.md hallazgo #8.
// Sin NEXT_PUBLIC_POSTHOG_KEY, se salta en silencio (mismo patrón que
// RESEND_API_KEY/GEMINI_API_KEY en .env.local: la app funciona igual sin
// la integración opcional, solo sin ese dato).
//
// Configuración pensada para no necesitar banner de consentimiento de
// cookies (hallazgo #11, que decía "va junto con la analítica, no
// después"):
// - persistence: 'localStorage' — nunca pone una cookie de terceros.
// - person_profiles: 'identified_only' — no crea perfil de nadie anónimo,
//   solo cuando alguien inicia sesión y se le identifica a propósito.
// - capture_pageview: false aquí — se captura a mano en
//   onRouterTransitionStart de abajo, porque el App Router navega sin
//   recargar la página y el autocapture de carga inicial de PostHog no ve
//   esas navegaciones.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

if (KEY) {
  posthog.init(KEY, {
    api_host: HOST,
    ui_host: 'https://us.posthog.com',
    persistence: 'localStorage',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: {
      // No capturar contenido de inputs/forms — los formularios de esta
      // plataforma (publicar, contacto) llevan nombre/teléfono/correo, y
      // PostHog no debe ver eso, ni por accidente. Solo clics/navegación.
      dom_event_allowlist: ['click'],
    },
  });
}

export function onRouterTransitionStart(url: string) {
  if (KEY) posthog.capture('$pageview', { $current_url: url });
}
