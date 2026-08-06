import type { Metadata } from 'next';
import type { Property } from '@/types/property';
import type { Municipality, Zone } from '@/types/zone';
import { formatPrice } from './format';

const SITE_NAME = 'Vive Villahermosa';
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://vivevillahermosa.mx';
const DEFAULT_OG = `${SITE_URL}/images/og-default.jpg`;

export function buildPropertyMetadata(property: Property): Metadata {
  const title = `${property.titulo} — ${formatPrice(property.precio, property.operacion)} | ${SITE_NAME}`;
  const description = `${property.descripcion.substring(0, 155)}...`;
  const url = `${SITE_URL}/propiedades/${property.slug}`;
  const image = property.fotos[0] ? `${SITE_URL}${property.fotos[0]}` : DEFAULT_OG;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: image, width: 1200, height: 630, alt: property.titulo }],
      type: 'website',
      locale: 'es_MX',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    alternates: { canonical: url },
  };
}

export function buildZoneMetadata(zone: Zone | Municipality, type: 'zone' | 'municipality'): Metadata {
  const title = `Propiedades en ${zone.nombre} Tabasco — Venta y Renta | ${SITE_NAME}`;
  const count = 'propiedades' in zone ? zone.propiedades : 0;
  const description = `${count} propiedades disponibles en ${zone.nombre}, Tabasco. ${zone.descripcion}`;
  const slug = type === 'zone' ? (zone as Zone).slug : (zone as Municipality).slug;
  const url = `${SITE_URL}/zonas/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: zone.nombre }],
      type: 'website',
      locale: 'es_MX',
    },
    alternates: { canonical: url },
  };
}

export const defaultMetadata: Metadata = {
  title: {
    default: `${SITE_NAME} | Inmuebles en Tabasco`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Encuentra casas, departamentos, terrenos y locales en Villahermosa, Paraíso, Comalcalco y todo Tabasco. La plataforma inmobiliaria local líder del estado.',
  keywords: [
    'casas en renta villahermosa',
    'casas en venta villahermosa',
    'renta departamento tabasco',
    'terrenos en venta tabasco',
    'inmuebles villahermosa tabasco',
    'propiedades tabasco',
    'vive villahermosa',
    'renta paraiso tabasco dos bocas',
  ],
  openGraph: {
    siteName: SITE_NAME,
    locale: 'es_MX',
    type: 'website',
    images: [{ url: DEFAULT_OG, width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(SITE_URL),
};
