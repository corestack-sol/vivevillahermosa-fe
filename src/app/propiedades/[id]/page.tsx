import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAllProperties, getPropertyById } from '@/lib/api';
import { buildPropertyMetadata } from '@/lib/seo';
import { getLandmark, distanciaKm, distanciaMinimaACategoria, CATEGORIAS_GENERICAS } from '@/lib/landmarks';
import { getColoniaByKey } from '@/lib/colonias';
import { obtenerColoniaDescubiertaPorKey } from '@/lib/coloniaDiscovery';
import { estaEnRevision } from '@/lib/moderacionBusqueda';
import { esPropiedadLocal } from '@/lib/idsLocales';
import { PropertyDetailView } from '@/components/property/PropertyDetailView';
import { LocalPropertyDetail } from '@/components/property/LocalPropertyDetail';

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

export async function generateStaticParams() {
  return getAllProperties().map((p) => ({ id: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Un id `local-...` nunca está en el catálogo estático server-side (vive
  // en localStorage de quien lo publicó) — no es que "no exista", solo no
  // se puede resolver aquí. Evita el título engañoso "no encontrada" mientras
  // el cliente todavía no cargó los datos reales.
  if (esPropiedadLocal(id)) return { title: 'Propiedad | Vive Villahermosa' };
  const property = getPropertyById(id);
  if (!property) return { title: 'Propiedad no encontrada | Vive Villahermosa' };
  return buildPropertyMetadata(property);
}

export default async function PropertyDetailPage({ params, searchParams }: Props) {
  const { id } = await params;

  // Propiedades publicadas desde el formulario (PublishForm.tsx) se guardan
  // en localStorage — src/lib/propiedadesLocales.ts — y nunca existen en el
  // catálogo estático que este Server Component puede leer. Antes de este
  // fix, entrar aquí con un id `local-...` daba 404 siempre, incluso para
  // quien la acababa de publicar: se delega a un componente cliente que
  // resuelve el mismo id desde localStorage.
  //
  // ⚠️ BACKEND: esta rama (y LocalPropertyDetail.tsx entero) existe
  // solo por la ausencia de Property real en la base de datos — ver el
  // modelo sugerido al final de prisma/schema.prisma. Con
  // `GET /api/propiedades/:id` real, `esPropiedadLocal`/ids con prefijo
  // `local-` dejan de tener sentido (todo id sería un id real de la base de
  // datos) y esta página vuelve a ser un solo camino: `getPropertyById(id)`
  // seguido de `notFound()` si no existe, sin el if de aquí abajo.
  if (esPropiedadLocal(id)) {
    const sp = await searchParams;
    return <LocalPropertyDetail id={id} cerca={sp.cerca} cercaTipo={sp.cercaTipo} cercaColonia={sp.cercaColonia} />;
  }

  const property = getPropertyById(id);
  if (!property) notFound();

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
  // (no corre en un navegador), así que si no la encuentra ahí, se
  // consulta la base de datos directo antes de rendirse.
  const coloniaCercana = !landmarkCercano && !categoriaCercana && cercaColonia
    ? getColoniaByKey(cercaColonia) ?? (await obtenerColoniaDescubiertaPorKey(cercaColonia)) ?? undefined
    : undefined;
  const distanciaColonia = coloniaCercana
    ? distanciaKm(property.lat, property.lng, coloniaCercana.lat, coloniaCercana.lng)
    : undefined;

  // Badge "En revisión" en AgentCard — se consulta por `emailCuenta` (no
  // `Property.userId`, que no existe todavía) por la misma razón que el
  // flujo de contacto: es la única forma de llegar a la cuenta real del
  // publicador sin esa relación pendiente. Sin emailCuenta (propiedades de
  // muestra), nunca se muestra el badge.
  const enRevision = property.emailCuenta ? await estaEnRevision(property.emailCuenta) : false;

  return (
    <PropertyDetailView
      property={property}
      extras={{ landmarkCercano, distanciaLandmark, categoriaCercana, coloniaCercana, distanciaColonia, enRevision }}
    />
  );
}
