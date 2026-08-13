import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mapBackendProperty, type BackendPublicProperty } from '@/lib/api';
import { backendFetchServer } from '@/lib/backendApiServer';
import { BackendApiError } from '@/lib/backendApi';
import { buildPropertyMetadata } from '@/lib/seo';
import { getLandmark, distanciaKm, distanciaMinimaACategoria, CATEGORIAS_GENERICAS } from '@/lib/landmarks';
import { getColoniaByKey, obtenerColoniaDescubiertaBackend } from '@/lib/colonias';
import { PropertyDetailView } from '@/components/property/PropertyDetailView';

/**
 * Reenvía la cookie de sesión (backendFetchServer) — a diferencia de
 * getPropertyById de api.ts (siempre anónimo, usable desde cualquier
 * contexto), esta página necesita que el backend sepa si quien pide la
 * propiedad es su propio dueño, para poder mostrarla aunque esté pausada
 * (ver criterio de aceptación #3, BACKEND.md §3) y con lat/lng y contacto
 * reales en vez del punto público.
 */
async function fetchProperty(id: string) {
  try {
    const bp = await backendFetchServer<BackendPublicProperty>(
      `/propiedades/${encodeURIComponent(id)}`,
    );
    return mapBackendProperty(bp);
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) return undefined;
    throw err;
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
  const property = await fetchProperty(id);
  if (property) return buildPropertyMetadata(property);
  return { title: 'Propiedad | Vive Villahermosa' };
}

export default async function PropertyDetailPage({ params, searchParams }: Props) {
  const { id } = await params;

  const property = await fetchProperty(id);

  if (!property) {
    notFound();
  }

  // Cuando se llega desde una búsqueda "cerca de X" (el enlace de la
  // tarjeta en /propiedades propaga ?cerca=/?cercaTipo=, ver
  // PropertiesClient.tsx), se muestra la distancia real calculada — sin
  // esto, alguien que llega aquí no tenía ninguna forma de verificar por
  // qué esta propiedad apareció en esos resultados.
  const { cerca, cercaTipo, cercaColonia } = await searchParams;
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

  return (
    <PropertyDetailView
      property={property}
      extras={{ landmarkCercano, distanciaLandmark, categoriaCercana, coloniaCercana, distanciaColonia, enRevision }}
    />
  );
}
