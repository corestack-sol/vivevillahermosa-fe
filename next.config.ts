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
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${backendOrigin} https://accounts.google.com https://graph.facebook.com`.trim(),
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
