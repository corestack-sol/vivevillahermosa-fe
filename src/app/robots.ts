import type { MetadataRoute } from 'next';

// Fallback corregido 2026-09-02 — ver sitemap.ts, mismo bug real.
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://vivevillahermosa.corestacksolutions.com.mx';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/publicar/gracias', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
