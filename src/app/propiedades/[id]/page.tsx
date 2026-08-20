import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mapBackendProperty, type BackendPublicProperty } from '@/lib/api';
import { backendFetchServer } from '@/lib/backendApiServer';
import { BackendApiError } from '@/lib/backendApi';
import { getSession } from '@/lib/auth';
import { buildPropertyMetadata } from '@/lib/seo';
import { getLandmark, distanciaKm, distanciaMinimaACategoria, CATEGORIAS_GENERICAS, obtenerLandmarksBackend } from '@/lib/landmarks';
import { getColoniaByKey, obtenerColoniaDescubiertaBackend } from '@/lib/colonias';
import { PropertyDetailView } from '@/components/property/PropertyDetailView';

/**
 * Reenvía la cookie de sesión (backendFetchServer) — a diferencia de
 * getPropertyById de api.ts (siempre anónimo, usable desde cualquier
 * contexto), esta página necesita que el backend sepa si quien pide la
 * propiedad es su propio dueño, para poder mostrarla aunque esté pausada
 * (ver criterio de aceptación #3, BACKEND.md §3) y con lat/lng y contacto
 * reales en vez del punto público.
 *
 * BACKEND-AUDITORIA-EDGE-CASES-20082026.md #6: un admin que llega desde
 * /admin/reportes a una propiedad que el dueño pausó/desactivó (para evadir
 * la revisión) se topaba con un 404 igual que cualquier visitante — el
 * endpoint público la sigue ocultando a quien no es el dueño, sea admin o
 * no. Si el público 404 y la sesión es de un admin, GET
 * /admin/propiedades/:id (sin el filtro de visibilidad) es el fallback real.
 */
async function fetchProperty(id: string, esAdmin: boolean) {
  try {
    const bp = await backendFetchServer<BackendPublicProperty>(
      `/propiedades/${encodeURIComponent(id)}`,
    );
    return mapBackendProperty(bp);
  } catch (err) {
    if (!(err instanceof BackendApiError) || err.status !== 404) throw err;
    if (!esAdmin) return undefined;

    try {
      const bp = await backendFetchServer<BackendPublicProperty>(
        `/admin/propiedades/${encodeURIComponent(id)}`,
      );
      return mapBackendProperty(bp);
    } catch (adminErr) {
      if (adminErr instanceof BackendApiError) return undefined;
      throw adminErr;
    }
  }
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cerca?: string; cercaTipo?: string; cercaColonia?: string }>;
}

/**
 * Encuentra el landmark más cercano dentro de una categoría genérica
 * ("cerca de un hospital") y su distancia — a diferencia de un landmark
 * específico, aquí no hay un solo punto de referencia, así que se calcula
 * cuál de todos los catalogados en esa categoría es el más cercano a esta
 * propiedad en particular.
 */
function landmarkMasCercanoDeCategoria(lat: number, lng: number, categoria: string) {
  const puntos = CATEGORIAS_GENERICAS.find((c) => c.value === categoria);
  if (!puntos) return null;
  const distancia = distanciaMinimaACategoria(lat, lng, categoria);
  return distancia === null ? null : { label: puntos.label, distancia };
}

// Property ya es real en el backend (docs/BACKEND.md §3) — las propiedades
// se crean/pausan/eliminan en cualquier momento, así que ya no se pueden
// conocer todos los slugs válidos en build time. `dynamicParams: true`
// (default) deja que Next resuelva cada uno on-demand y lo cachee con ISR.
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  const property = await fetchProperty(id, session?.esAdmin ?? false);
  if (property) return buildPropertyMetadata(property);
  return { title: 'Propiedad | Vive Villahermosa' };
}

export default async function PropertyDetailPage({ params, searchParams }: Props) {
  const { id } = await params;

  const session = await getSession();
  const property = await fetchProperty(id, session?.esAdmin ?? false);

  if (!property) {
    notFound();
  }

  // Cuando se llega desde una búsqueda "cerca de X" (el enlace de la
  // tarjeta en /propiedades propaga ?cerca=/?cercaTipo=, ver
  // PropertiesClient.tsx), se muestra la distancia real calculada — sin
  // esto, alguien que llega aquí no tenía ninguna forma de verificar por
  // qué esta propiedad apareció en esos resultados.
  const { cerca, cercaTipo, cercaColonia } = await searchParams;
  // Un Server Component nunca precarga nada (no corre en un navegador) —
  // solo se pide el catálogo si de verdad hace falta (mismo criterio que
  // getColoniaByKey/obtenerColoniaDescubiertaBackend más abajo), para no
  // pagar un fetch extra en la mayoría de las visitas, que no traen
  // ?cerca=/?cercaTipo=.
  if (cerca || cercaTipo) await obtenerLandmarksBackend();
  const landmarkCercano = cerca ? getLandmark(cerca) : undefined;
  const distanciaLandmark = landmarkCercano
    ? distanciaKm(property.lat, property.lng, landmarkCercano.lat, landmarkCercano.lng)
    : undefined;
  const categoriaCercana = !landmarkCercano && cercaTipo
    ? (landmarkMasCercanoDeCategoria(property.lat, property.lng, cercaTipo) ?? undefined)
    : undefined;
  // getColoniaByKey solo conoce el catálogo estático + lo que un
  // navegador haya precargado — un Server Component nunca precarga nada
  // (no corre en un navegador), así que si no la encuentra ahí, se le
  // pregunta al backend directo antes de rendirse.
  const coloniaCercana = !landmarkCercano && !categoriaCercana && cercaColonia
    ? getColoniaByKey(cercaColonia) ?? (await obtenerColoniaDescubiertaBackend(cercaColonia)) ?? undefined
    : undefined;
  const distanciaColonia = coloniaCercana
    ? distanciaKm(property.lat, property.lng, coloniaCercana.lat, coloniaCercana.lng)
    : undefined;

  // Badge "En revisión" en AgentCard — viene directo del backend
  // (agente.enRevision, BACKEND.md §3), calculado sobre la relación real
  // Property.userId → User.bloqueado.
  const enRevision = property.agente.enRevision ?? false;

  // JSON-LD (Schema.org RealEstateListing) — sin esto, Google/buscadores de
  // IA no tienen forma estructurada de leer precio/tipo/ubicación de la
  // ficha, solo texto libre. Ver docs/PLAN-AUDITORIA-FASE1-MVP.md hallazgo
  // #12. Usa latPublico/lngPublico (nunca la coordenada exacta) — mismo
  // criterio de privacidad que ya rige el resto de esta página.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.titulo,
    description: property.descripcion,
    url: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://vivevillahermosa.mx'}/propiedades/${property.slug}`,
    image: property.fotos,
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.colonia,
      addressRegion: property.municipio,
      addressCountry: 'MX',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: property.latPublico,
      longitude: property.lngPublico,
    },
    floorSize: { '@type': 'QuantitativeValue', value: property.m2Construidos, unitCode: 'MTK' },
    numberOfRooms: property.recamaras,
    numberOfBathroomsTotal: property.banos,
    offers: {
      '@type': 'Offer',
      price: property.precio,
      priceCurrency: property.moneda,
      availability: 'https://schema.org/InStock',
      businessFunction: property.operacion === 'renta' ? 'https://schema.org/LeaseOut' : 'https://schema.org/Sell',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PropertyDetailView
        property={property}
        extras={{ landmarkCercano, distanciaLandmark, categoriaCercana, coloniaCercana, distanciaColonia, enRevision }}
      />
    </>
  );
}
