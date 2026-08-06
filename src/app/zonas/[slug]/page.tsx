import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, MapPin, Zap, TrendingUp, Map as MapIcon, Building2, Construction } from 'lucide-react';
import { getAllZones, getAllMunicipalities, getAllProperties, getZonesWithLiveStats, getMunicipalitiesWithLiveStats } from '@/lib/api';
import { buildZoneMetadata } from '@/lib/seo';
import { PropertyCard } from '@/components/property/PropertyCard';
import { MapViewDynamic } from '@/components/map/MapViewDynamic';
import { formatPrice } from '@/lib/format';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const zones = getAllZones().map((z) => ({ slug: z.slug }));
  const municipalities = getAllMunicipalities().map((m) => ({ slug: m.slug }));
  return [...zones, ...municipalities];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const zone = getZonesWithLiveStats().find((z) => z.slug === slug);
  if (zone) return buildZoneMetadata(zone, 'zone');
  const municipality = getMunicipalitiesWithLiveStats().find((m) => m.slug === slug);
  if (municipality) return buildZoneMetadata(municipality, 'municipality');
  return { title: 'Zona no encontrada | Vive Villahermosa' };
}

export default async function ZonaDetailPage({ params }: Props) {
  const { slug } = await params;

  // Stats en vivo (conteo y precio promedio calculados desde el catálogo
  // real, no el valor editorial fijo de zones.json/municipalities.json —
  // mismo dato que ya muestra el listado en /zonas, ver src/lib/api.ts).
  const zone = getZonesWithLiveStats().find((z) => z.slug === slug);
  const municipality = !zone ? getMunicipalitiesWithLiveStats().find((m) => m.slug === slug) : undefined;

  if (!zone && !municipality) notFound();

  const allProperties = getAllProperties();

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
    lat: p.lat,
    lng: p.lng,
    titulo: p.titulo,
    precio: p.precio,
    operacion: p.operacion,
    tipo: p.tipo,
    colonia: p.colonia,
    foto: p.fotos[0] ?? null,
    riesgoInundacion: p.riesgoInundacion,
  }));

  const name = zone?.nombre ?? municipality!.nombre;
  const description = zone?.descripcion ?? municipality!.descripcion;
  const lat = zone?.lat ?? municipality!.lat;
  const lng = zone?.lng ?? municipality!.lng;
  const isMunicipality = !!municipality;
  const isCercaDosoBocas = municipality?.cercaDosoBocas ?? false;

  const centerMarker = zoneProperties.length === 0
    ? [{ id: 'center', slug: '', lat, lng, titulo: name, precio: 0, operacion: 'venta' as const, tipo: 'casa', colonia: name, foto: null, riesgoInundacion: 'bajo' as const }]
    : markers;

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
          {/* Hero card */}
          <div className="relative h-48 bg-gradient-to-br from-brand-dark to-brand rounded-3xl overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              {isMunicipality ? <MapIcon size={110} strokeWidth={1} /> : <Building2 size={110} strokeWidth={1} />}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  <MapPin size={10} />
                  {isMunicipality ? 'Municipio de Tabasco' : `Colonia · ${zone!.municipio}`}
                </span>
                {isCercaDosoBocas && (
                  <span className="bg-amber-500/90 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Zap size={10} /> Cerca Dos Bocas
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-heading font-bold text-white">{name}</h1>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-heading font-bold text-gray-800 mb-2">Sobre {isMunicipality ? 'el municipio' : 'la colonia'}</h2>
            <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-brand-pale rounded-2xl p-4 text-center">
              <p className="text-2xl font-display font-black text-brand">{zoneProperties.length}</p>
              <p className="text-xs text-gray-600 mt-1">Propiedades</p>
            </div>
            {zone && zone.precioPromedioRenta > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                <p className="text-lg font-heading font-bold text-gray-800">
                  {formatPrice(zone.precioPromedioRenta, 'renta')}
                </p>
                <p className="text-xs text-gray-500 mt-1">Renta promedio</p>
              </div>
            )}
            {zone && zone.precioPromedioVenta > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                <p className="text-lg font-heading font-bold text-gray-800">
                  {formatPrice(zone.precioPromedioVenta, 'venta')}
                </p>
                <p className="text-xs text-gray-500 mt-1">Venta promedio</p>
              </div>
            )}
          </div>

          {/* Map */}
          <div>
            <h2 className="font-heading font-bold text-gray-800 mb-3">Mapa de la zona</h2>
            <div className="h-64 rounded-2xl overflow-hidden border border-gray-200">
              <MapViewDynamic markers={centerMarker} center={[lat, lng]} zoom={isMunicipality ? 12 : 14} />
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

            <div className="bg-brand-pale rounded-2xl p-4">
              <p className="text-xs font-semibold text-brand-dark mb-2 flex items-center gap-1">
                <TrendingUp size={13} /> Tip de inversión
              </p>
              <p className="text-xs text-gray-600">
                {isCercaDosoBocas
                  ? 'Zona con alta demanda por la Refinería Dos Bocas. Excelente oportunidad de renta para trabajadores PEMEX y contratistas.'
                  : isMunicipality
                  ? `${name} ofrece precios más accesibles que Villahermosa con buena conectividad vial al centro del estado.`
                  : `${name} es una de las zonas más consolidadas de Villahermosa. Buena plusvalía y servicios completos.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Properties list */}
      {zoneProperties.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-heading font-bold text-gray-800 mb-5">
            Propiedades en {name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {zoneProperties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-10 bg-gray-50 rounded-2xl p-10 text-center">
          <Construction size={36} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
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
