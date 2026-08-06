import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://vivevillahermosa.mx';

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
