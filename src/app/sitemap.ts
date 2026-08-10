import type { MetadataRoute } from 'next';
import { getAllProperties, getAllMunicipalities, getAllZones } from '@/lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://vivevillahermosa.mx';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const properties = await getAllProperties();
  const municipalities = getAllMunicipalities();
  const zones = getAllZones();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/propiedades`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/mapa`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/zonas`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/publicar`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/nosotros`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
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

  return [...staticRoutes, ...propertyRoutes, ...zoneRoutes, ...municipalityRoutes];
}
