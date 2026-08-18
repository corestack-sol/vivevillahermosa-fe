import type { NextConfig } from "next";

// El backend real vive en otro origen (NEXT_PUBLIC_API_URL) desde el corte
// a backend independiente (docs/BACKEND.md) — sin agregarlo aquí, connect-src
// bloquea silenciosamente todo fetch del NAVEGADOR hacia el backend
// (auth/me, buscador con IA, listado de propiedades) aunque el build compile
// y las llamadas server-side (Server Components) sigan funcionando, porque
// esas no pasan por CSP. Detectado en QA manual con navegador real, 2026-08-12.
const backendOrigin = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
  : '';

// Mismo problema que backendOrigin arriba, detectado 2026-08-18: sin el
// host de PostHog en connect-src, posthog-js nunca podía mandar ni un
// evento en ningún ambiente — el build compilaba bien y no había ningún
// error visible salvo abriendo la consola del navegador. PostHog sirve su
// loader/config desde un subdominio "-assets" aparte del host de ingesta
// (ej. us-assets.i.posthog.com vs us.i.posthog.com) — hacen falta los dos.
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
  ? new URL(process.env.NEXT_PUBLIC_POSTHOG_HOST).origin
  : '';
const posthogAssetsHost = posthogHost.replace(
  /^https:\/\/([a-z]+)\.i\.posthog\.com$/,
  'https://$1-assets.i.posthog.com',
);

// Cabeceras de seguridad ausentes antes de esta auditoría (hallazgo H2):
// sin ellas, el login y el formulario de publicar podían embeberse en un
// iframe ajeno (clickjacking) y no había ninguna capa de contención ante
// un XSS futuro.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // posthog-js carga su script de Surveys dinámicamente
      // (us-assets.i.posthog.com/static/surveys.js) — sin este host en
      // script-src, ese <script> se bloquea (distinto al bloqueo de
      // connect-src de arriba, mismo origen del problema: falta el host
      // de PostHog en CSP). Detectado en el mismo QA manual, 2026-08-18.
      `script-src 'self' 'unsafe-inline' ${posthogAssetsHost}`.trim(),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // `data:` en connect-src — PublishForm.tsx (propiedades) y el
      // portafolio de servicios convierten su preview (data URI) a Blob
      // vía `fetch(dataUrl).then(r => r.blob())` antes de subirlo; Chromium
      // trata ese fetch como una conexión de red sujeta a connect-src igual
      // que cualquier otro origen, aunque el contenido nunca sale del
      // navegador. Sin esto, ninguna subida de foto llega a completarse
      // (bloqueada en silencio). Detectado en QA manual con navegador real,
      // 2026-08-12/13.
      `connect-src 'self' data: ${backendOrigin} ${posthogHost} ${posthogAssetsHost} https://accounts.google.com https://graph.facebook.com`.trim(),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers:
          process.env.NODE_ENV === 'production'
            ? [...securityHeaders, { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
            : securityHeaders,
      },
    ];
  },
};

export default nextConfig;
