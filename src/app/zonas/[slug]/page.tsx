import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, MapPin, Zap, TrendingUp, Map as MapIcon, Building2 } from 'lucide-react';
import { getAllZones, getAllMunicipalities, getAllProperties, getZonesWithLiveStats, getMunicipalitiesWithLiveStats } from '@/lib/api';
import { buildZoneMetadata } from '@/lib/seo';
import { PropertyCard } from '@/components/property/PropertyCard';
import { ZoneMap } from '@/components/map/ZoneMap';
import { formatPrice } from '@/lib/format';
import { obtenerLandmarksBackend, distanciaKm } from '@/lib/landmarks';
import { detectarRiesgoInundacion } from '@/lib/zonas-inundacion';
import { backendFetchServer } from '@/lib/backendApiServer';
import { PROPERTY_GRID_CLASSES } from '@/lib/gridClasses';
import type { Zone, Municipality } from '@/types/zone';

// Fotos reales de Wikimedia Commons (2026-08-19, pedido explícito) para el
// hero de cada uno de los 17 municipios — antes era un degradado sólido sin
// foto ("Ya existe ese componente pero solo como una card verde"). CC-BY-SA
// exige crédito al autor; se muestra igual para las de dominio público, por
// cortesía. Fuente/licencia de cada una documentada en el historial de este
// cambio, no repetida aquí para no inflar el archivo.
const MUNICIPIO_FOTO_CREDITO: Record<string, string> = {
  centro: 'Alfonsobouchot', cardenas: 'Alfonsobouchot', comalcalco: 'Miguel Marín',
  paraiso: 'Alfonsobouchot', 'jalpa-de-mendez': 'Olavarria10', nacajuca: 'Cultura Yokotan',
  huimanguillo: 'Alfonsobouchot', centla: 'Alfonsobouchot', macuspana: 'Alfonsobouchot',
  cunduacan: 'Alfonsobouchot', tenosique: 'ProtoplasmaKid', 'emiliano-zapata': 'Kazekage AMT',
  balancán: 'Kazekage AMT', jonuta: 'Kazekage AMT', jalapa: 'Alfonsobouchot',
  tacotalpa: 'Alfonsobouchot', teapa: 'Haikabio',
};

// Radio generoso para "cerca de la zona" (el centro de una colonia/municipio
// está más lejos de un landmark que una propiedad puntual dentro de ella) —
// no confundir con `radioKm` de cada Landmark, que es para "cerca de la
// propiedad" (BACKEND.md §9.2 solo pide landmarks REALES cercanos, nunca
// inventados; este radio decide cuáles cuentan como "cercanos" a nivel zona).
const RADIO_LANDMARKS_ZONA_KM = 3;

/** Hasta 3 landmarks reales más cercanos al centro de la zona, ordenados por distancia — nunca inventados. */
async function landmarksCercaDeZona(lat: number, lng: number): Promise<string[]> {
  const landmarks = await obtenerLandmarksBackend();
  return landmarks
    .map((l) => ({ label: l.label, distancia: distanciaKm(lat, lng, l.lat, l.lng) }))
    .filter((l) => l.distancia <= RADIO_LANDMARKS_ZONA_KM)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 3)
    .map((l) => l.label);
}

/**
 * BACKEND.md §9.2 — para COLONIAS, genera la descripción contra datos
 * verificados (landmarks reales, stats en vivo, Atlas de Riesgos vía
 * `detectarRiesgoInundacion`); si la llamada falla, cae al texto estático
 * editorial (zones.json) en vez de dejar la sección vacía.
 *
 * Para MUNICIPIOS ya no se llama a la IA — pedido explícito 2026-08-19:
 * "no incluiste una descripción breve e interesante (cultura, industria,
 * zonas de interés), solo está la descripción genérica de siempre". La IA
 * generaba una plantilla genérica ("es un municipio ubicado en Tabasco...")
 * que le ganaba en prioridad al texto editorial investigado en Wikipedia
 * (municipalities.json, con hechos reales de historia/cultura/economía por
 * municipio) — ese texto SIEMPRE es mejor que la plantilla, así que ya no
 * hace falta ni la llamada.
 */
async function resolverDescripcion(zone: Zone | undefined, municipality: Municipality | undefined): Promise<string> {
  const estatica = (zone?.descripcion ?? municipality?.descripcion) ?? '';
  if (municipality) return estatica;
  try {
    const riesgo = zone
      ? detectarRiesgoInundacion(zone!.nombre, zone!.municipio)
      : null;
    const body = {
      nombre: zone!.nombre,
      tipo: 'colonia' as const,
      municipio: zone!.municipio,
      landmarksCercanos: await landmarksCercaDeZona(zone!.lat, zone!.lng),
      totalPropiedades: zone!.propiedades,
      precioPromedioVenta: zone!.precioPromedioVenta > 0 ? zone!.precioPromedioVenta : undefined,
      precioPromedioRenta: zone!.precioPromedioRenta > 0 ? zone!.precioPromedioRenta : undefined,
      riesgoInundacion: riesgo?.confianza === 'confirmada' ? riesgo.riesgo : undefined,
    };
    const { descripcion } = await backendFetchServer<{ descripcion: string }>('/ia/descripcion-zona', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return descripcion || estatica;
  } catch {
    return estatica;
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  // Municipios siguen siendo catálogo editorial estático (§9.3 no los tocó
  // esta pasada). Colonias con ficha ya son reales en el backend (§9.3,
  // /admin/zonas) — una colonia creada después del build no está en esta
  // lista, pero `dynamicParams` en su default (true) la renderiza on-demand
  // en su primera visita y queda cacheada por `revalidate` de abajo, sin
  // necesitar rebuild.
  const zones = (await getAllZones()).map((z) => ({ slug: z.slug }));
  const municipalities = getAllMunicipalities().map((m) => ({ slug: m.slug }));
  return [...zones, ...municipalities];
}

// Los conteos/precios en vivo de más abajo sí dependen de Property (real
// desde esta fase) — ISR para que no se queden congelados en el valor del
// build.
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const zone = (await getZonesWithLiveStats()).find((z) => z.slug === slug);
  if (zone) return buildZoneMetadata(zone, 'zone');
  const municipality = (await getMunicipalitiesWithLiveStats()).find((m) => m.slug === slug);
  if (municipality) return buildZoneMetadata(municipality, 'municipality');
  return { title: 'Zona no encontrada | Vive Villahermosa' };
}

export default async function ZonaDetailPage({ params }: Props) {
  const { slug } = await params;

  // Stats en vivo (conteo y precio promedio calculados desde el catálogo
  // real, no el valor editorial fijo de zones.json/municipalities.json —
  // mismo dato que ya muestra el listado en /zonas, ver src/lib/api.ts).
  const zone = (await getZonesWithLiveStats()).find((z) => z.slug === slug);
  const municipality = !zone ? (await getMunicipalitiesWithLiveStats()).find((m) => m.slug === slug) : undefined;

  if (!zone && !municipality) notFound();

  const allProperties = await getAllProperties();

  const zoneProperties = zone
    ? allProperties.filter((p) => p.colonia.toLowerCase() === zone.nombre.toLowerCase())
    : allProperties.filter((p) => {
        const munName = municipality!.nombre.replace(' (Villahermosa)', '');
        return p.municipio.toLowerCase() === munName.toLowerCase()
          || (slug === 'villahermosa' && p.municipio === 'Centro');
      });

  const markers = zoneProperties.map((p) => ({
    id: p.id,
    slug: p.slug,
    // latPublico/lngPublico (enmascaradas), no lat/lng reales — mismo
    // criterio de privacidad que /mapa (MapaClient.tsx), este mapa se
    // había quedado con las coordenadas exactas sin la máscara.
    lat: p.latPublico,
    lng: p.lngPublico,
    titulo: p.titulo,
    precio: p.precio,
    operacion: p.operacion,
    tipo: p.tipo,
    colonia: p.colonia,
    foto: p.fotos[0] ?? null,
    riesgoInundacion: p.riesgoInundacion,
  }));

  const name = zone?.nombre ?? municipality!.nombre;
  const description = await resolverDescripcion(zone, municipality);
  const lat = zone?.lat ?? municipality!.lat;
  const lng = zone?.lng ?? municipality!.lng;
  const isMunicipality = !!municipality;
  const isCercaDosoBocas = municipality?.cercaDosoBocas ?? false;


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-brand">Inicio</Link>
        <ChevronRight size={14} />
        <Link href="/zonas" className="hover:text-brand">Zonas</Link>
        <ChevronRight size={14} />
        <span className="text-gray-700 font-medium">{name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero card — foto real (Wikimedia Commons) para municipios,
              antes un degradado sólido sin imagen. Las colonias (`zone`)
              no tienen foto propia, se quedan con el degradado + ícono.
              h-64 sm:h-80 (antes h-48 fijo) — pedido explícito 2026-08-19
              ("mejora el diseño"): con foto real de calidad, 192px se
              sentía corto/recortado; más alto deja respirar la imagen sin
              perder el título encima. */}
          <div className="relative h-64 sm:h-80 bg-gradient-to-br from-brand-dark to-brand rounded-3xl overflow-hidden animate-fade-up">
            {isMunicipality && municipality?.foto ? (
              <Image
                src={municipality.foto}
                alt={name}
                fill
                priority
                sizes="(min-width: 1024px) 66vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                {isMunicipality ? <MapIcon size={110} strokeWidth={1} /> : <Building2 size={110} strokeWidth={1} />}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  <MapPin size={10} />
                  {isMunicipality ? 'Municipio de Tabasco' : `Colonia · ${zone!.municipio}`}
                </span>
                {isCercaDosoBocas && (
                  <span className="bg-amber-500/90 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Zap size={10} /> Cerca Dos Bocas
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white drop-shadow-sm">{name}</h1>
            </div>
            {isMunicipality && municipality?.foto && (
              <span className="absolute top-3 right-3 bg-black/25 backdrop-blur-sm text-white/80 text-[10px] px-2 py-1 rounded-full">
                Foto: {MUNICIPIO_FOTO_CREDITO[municipality.id] ?? 'Wikimedia Commons'} / Wikimedia Commons
              </span>
            )}
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-fade-up" style={{ animationDelay: '60ms' }}>
            <h2 className="font-heading font-bold text-gray-800 mb-2">Sobre {isMunicipality ? 'el municipio' : 'la colonia'}</h2>
            <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
          </div>

          {/* Stats — para municipios (sin precio promedio de zona) un solo
              stat real existe, así que se muestra como tira ancha en vez
              de una grilla de 3 columnas con 2 huecos vacíos al lado
              (pedido explícito 2026-08-19). Las colonias con precios sí
              llenan la grilla de verdad. */}
          {zone && (zone.precioPromedioRenta > 0 || zone.precioPromedioVenta > 0) ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-brand-pale rounded-2xl p-4 text-center">
                <p className="text-2xl font-display font-black text-brand">{zoneProperties.length}</p>
                <p className="text-xs text-gray-600 mt-1">Propiedades</p>
              </div>
              {zone.precioPromedioRenta > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                  <p className="text-lg font-heading font-bold text-gray-800">
                    {formatPrice(zone.precioPromedioRenta, 'renta')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Renta promedio</p>
                </div>
              )}
              {zone.precioPromedioVenta > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                  <p className="text-lg font-heading font-bold text-gray-800">
                    {formatPrice(zone.precioPromedioVenta, 'venta')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Venta promedio</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-brand-pale rounded-2xl p-4 flex items-center gap-4">
              <p className="text-2xl font-display font-black text-brand flex-shrink-0">{zoneProperties.length}</p>
              <p className="text-xs text-gray-600">
                propiedad{zoneProperties.length !== 1 ? 'es' : ''} publicada{zoneProperties.length !== 1 ? 's' : ''} en {name}
              </p>
            </div>
          )}

          {/* Map */}
          <div>
            <h2 className="font-heading font-bold text-gray-800 mb-3">Mapa de la zona</h2>
            <div className="h-64 rounded-2xl overflow-hidden border border-gray-200">
              {/* Sin pin "$0" inventado cuando no hay propiedades — pedido
                  explícito 2026-08-19: "no quiero que se vea nada... mas
                  que el solo mapa". `center`/`zoom` ya posicionan el mapa
                  sin necesitar un marcador falso. */}
              <ZoneMap markers={markers} center={[lat, lng]} zoom={isMunicipality ? 12 : 14} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-heading font-bold text-gray-800 mb-3">Buscar en {name}</h2>
              <Link
                href={`/propiedades?${isMunicipality ? `municipio=${encodeURIComponent(municipality!.nombre.replace(' (Villahermosa)', ''))}` : `q=${encodeURIComponent(zone!.nombre)}`}`}
                className="block w-full text-center bg-brand hover:bg-brand-dark text-white text-sm font-semibold py-3 rounded-xl transition-colors mb-2"
              >
                Ver todas en venta o renta
              </Link>
              <Link
                href={`/propiedades?${isMunicipality ? `municipio=${encodeURIComponent(municipality!.nombre.replace(' (Villahermosa)', ''))}&operacion=renta` : `q=${encodeURIComponent(zone!.nombre)}&operacion=renta`}`}
                className="block w-full text-center border-2 border-brand text-brand text-sm font-semibold py-2.5 rounded-xl hover:bg-brand-pale transition-colors"
              >
                Solo rentas
              </Link>
            </div>

            {/* Antes decía "Tip de inversión" con afirmaciones de demanda/
                plusvalía sin ningún dato real detrás — el caso genérico
                (ninguna colonia catalogada como Dos Bocas o municipio)
                literalmente repetía la misma frase ("una de las zonas más
                consolidadas... buena plusvalía") para cualquier colonia,
                lo cual es falso para casi todas por definición. Ahora solo
                hechos verificables: ubicación real, sin adjetivos de
                oportunidad/demanda/plusvalía.
                Para municipios ya no se muestra si no hay nada real que
                decir (pedido explícito 2026-08-19): la frase genérica
                "conectado por carretera al centro del estado" quedaba
                repetida (y para Centro mismo, sin sentido — ES el centro)
                junto a la descripción real de arriba. Se queda solo el
                caso con dato real (Dos Bocas) o el de colonia (municipio
                al que pertenece, útil y no repetido en otro lado). */}
            {(isCercaDosoBocas || !isMunicipality) && (
              <div className="bg-brand-pale rounded-2xl p-4">
                <p className="text-xs font-semibold text-brand-dark mb-2 flex items-center gap-1">
                  <TrendingUp size={13} /> Sobre la zona
                </p>
                <p className="text-xs text-gray-600">
                  {isCercaDosoBocas
                    ? 'Ubicada cerca de la Refinería Dos Bocas / Pemex.'
                    : `${name} es una colonia del municipio de ${zone!.municipio}.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Properties list */}
      {zoneProperties.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-heading font-bold text-gray-800 mb-5">
            Propiedades en {name}
          </h2>
          {/* Misma grilla auto-fill que /propiedades (PROPERTY_GRID_CLASSES,
              src/lib/gridClasses.ts) — antes era grid-cols-1 md:grid-cols-2
              fijo, así que con pocos resultados (ej. un municipio con solo
              3 propiedades) las tarjetas se veían más grandes que en
              cualquier otra página. Pedido explícito 2026-08-19: mismo
              tamaño haya o no haya más propiedades. */}
          <div className={PROPERTY_GRID_CLASSES}>
            {zoneProperties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-10 bg-gray-50 rounded-2xl p-10 text-center">
          {/* Mascota 404 propia en vez del ícono genérico de construcción —
              pedido explícito 2026-08-19, aplica a las 17 páginas de
              municipio (y a colonia, mismo bloque compartido). */}
          <Image
            src="/images/icons/404-mascota.webp"
            alt=""
            width={140}
            height={87}
            className="mx-auto mb-3"
          />
          <p className="font-semibold text-gray-700 mb-2">Próximamente en {name}</p>
          <p className="text-gray-500 text-sm mb-4">
            Aún no hay propiedades publicadas en esta zona. ¿Tienes una? Publícala gratis.
          </p>
          <Link
            href="/publicar"
            className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-brand-dark transition-colors"
          >
            Publicar propiedad <ChevronRight size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}
