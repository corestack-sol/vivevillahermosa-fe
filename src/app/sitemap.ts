import type { MetadataRoute } from 'next';
import { getAllProperties, getAllMunicipalities, getAllZones } from '@/lib/api';
import guiasData from '@/data/guias.json';

// Fallback corregido 2026-09-02 (dominio real, "vivevillahermosa.mx" no
// existe) — bug real: NEXT_PUBLIC_BASE_URL estaba mal seteado en
// .env.local (localhost) y el sitemap.xml de producción apuntaba a
// localhost en cada URL. Ver .env.local para la corrección real.
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://vivevillahermosa.corestacksolutions.com.mx';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const properties = await getAllProperties();
  const municipalities = getAllMunicipalities();
  const zones = await getAllZones();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/propiedades`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/mapa`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/zonas`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/publicar`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/nosotros`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    // De vuelta en el menú principal como "Guías" (2026-08-23) — antes
    // vivía en /blog, sin link en el nav (rumbo sin decidir) pero
    // indexable igual. Renombrado junto con la ruta y guias.json.
    { url: `${SITE_URL}/guias`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  const propertyRoutes: MetadataRoute.Sitemap = properties.map((p) => ({
    url: `${SITE_URL}/propiedades/${p.slug}`,
    lastModified: new Date(p.fechaPublicacion),
    changeFrequency: 'weekly',
    priority: p.featured ? 0.9 : 0.7,
  }));

  const zoneRoutes: MetadataRoute.Sitemap = zones.map((z) => ({
    url: `${SITE_URL}/zonas/${z.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: z.destacada ? 0.75 : 0.6,
  }));

  const municipalityRoutes: MetadataRoute.Sitemap = municipalities.map((m) => ({
    url: `${SITE_URL}/zonas/${m.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: m.propiedades > 0 ? 0.75 : 0.5,
  }));

  const guiaRoutes: MetadataRoute.Sitemap = guiasData.map((post) => ({
    url: `${SITE_URL}/guias/${post.slug}`,
    lastModified: new Date(post.fecha),
    changeFrequency: 'monthly',
    priority: 0.4,
  }));

  return [...staticRoutes, ...propertyRoutes, ...zoneRoutes, ...municipalityRoutes, ...guiaRoutes];
}
