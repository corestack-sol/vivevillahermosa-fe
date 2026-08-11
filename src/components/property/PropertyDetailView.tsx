import Link from 'next/link';
import { ChevronRight, MapPin, Calendar, CheckCircle, Share2, Building2, Droplets, Zap, Leaf, ShieldCheck, ShieldAlert, AlertTriangle, Navigation } from 'lucide-react';
import type { Property } from '@/types/property';
import { SERVICIOS_RENTA } from '@/lib/servicios';
import { getSimilarProperties, getPriceContext } from '@/lib/api';
import type { Landmark } from '@/lib/landmarks';
import type { ColoniaCoord } from '@/lib/colonias';
import { PropertyGallery } from '@/components/property/PropertyGallery';
import { PropertySpecs } from '@/components/property/PropertySpecs';
import { FloodRiskBadge } from '@/components/property/FloodRiskBadge';
import { FraudAlertBadge } from '@/components/property/FraudAlertBadge';
import { PriceTag } from '@/components/property/PriceTag';
import { AgentCard } from '@/components/property/AgentCard';
import { SimilarCarousel } from '@/components/property/SimilarCarousel';
import { ContactForm } from '@/components/forms/ContactForm';
import { MapViewDynamic } from '@/components/map/MapViewDynamic';
import { Badge } from '@/components/ui/Badge';
import { FavoriteButton } from '@/components/property/FavoriteButton';
import { ReportButton } from '@/components/property/ReportButton';
import { RecentlyViewedTracker } from '@/components/property/RecentlyViewedTracker';
import { OwnerActionsBar } from '@/components/property/OwnerActionsBar';
import { MobileContactCta } from '@/components/property/MobileContactCta';
import { formatRelativeDate } from '@/lib/format';

export interface PropertyDetailExtras {
  landmarkCercano?: Landmark;
  distanciaLandmark?: number;
  categoriaCercana?: { label: string; distancia: number };
  coloniaCercana?: ColoniaCoord;
  distanciaColonia?: number;
  /** Simplificado a `false` en la ruta de propiedades locales (ver LocalPropertyDetail.tsx) — no hay forma de consultar Prisma desde el cliente. */
  enRevision: boolean;
}

const TIPO_LABEL: Record<string, string> = {
  casa: 'Casa', departamento: 'Departamento', terreno: 'Terreno',
  local: 'Local', oficina: 'Oficina', bodega: 'Bodega', habitacion: 'Habitación',
};

/**
 * Toda la ficha de detalle de una propiedad — extraída de
 * src/app/propiedades/[id]/page.tsx para poder reusarla también desde
 * LocalPropertyDetail.tsx (propiedades publicadas en este navegador, que no
 * existen en el catálogo estático server-side). `similar`/`priceCtx` se
 * recalculan aquí a partir de `property` en vez de recibirse ya resueltos,
 * porque ambos caminos (servidor y cliente) pueden llamar a las mismas
 * funciones puras de src/lib/api.ts sin problema — solo leen JSON estático.
 */
export async function PropertyDetailView({ property, extras }: { property: Property; extras: PropertyDetailExtras }) {
  const { landmarkCercano, distanciaLandmark, categoriaCercana, coloniaCercana, distanciaColonia, enRevision } = extras;

  const similar = await getSimilarProperties(property, 3);
  const priceCtx = await getPriceContext(property);
  // Señal de alerta (no de bloqueo): un precio muy por debajo del promedio de
  // comparables en la misma zona es uno de los indicadores más comunes de
  // estafa de renta/venta en México — advertimos sin impedir el contacto.
  const precioSospechoso =
    priceCtx.promedioZona !== null &&
    priceCtx.precioPorM2 !== null &&
    priceCtx.totalComparables >= 2 &&
    priceCtx.precioPorM2 < priceCtx.promedioZona * 0.6;

  const singleMarker = [{
    id: property.id, slug: property.slug, lat: property.latPublico, lng: property.lngPublico,
    titulo: property.titulo, precio: property.precio, operacion: property.operacion,
    tipo: property.tipo, colonia: property.colonia, foto: property.fotos[0] ?? null,
    riesgoInundacion: property.riesgoInundacion,
  }];

  const whatsappUrl = (() => {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://vivevillahermosa.mx';
    const url  = `${base}/propiedades/${property.slug}`;
    const text = `🏠 *${property.titulo}*\n📍 ${property.colonia}, ${property.municipio}\n\n${url}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  })();

  return (
    <div className="min-h-screen bg-page">
      <RecentlyViewedTracker propertyId={property.id} />

      {/* Barra de acción fija en móvil/tablet — antes, para llegar al botón
          de contacto había que bajar por toda la descripción, amenidades,
          mapa y riesgo de inundación. La acción principal de esta página
          ahora está siempre al alcance de la mano, sin importar el scroll. */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center gap-3">
        <p className="flex-shrink-0 text-lg font-heading font-bold text-gray-900 leading-none">
          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(property.precio)}
          {property.operacion === 'renta' && <span className="text-xs font-normal text-gray-400">/mes</span>}
        </p>
        <FavoriteButton propiedadId={property.id} />
        <MobileContactCta propertyId={property.id} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:pb-0">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-1 text-xs text-gray-400 py-4 flex-wrap">
          <Link href="/" className="hover:text-brand transition-colors">Inicio</Link>
          <ChevronRight size={12} />
          <Link href="/propiedades" className="hover:text-brand transition-colors">Propiedades</Link>
          <ChevronRight size={12} />
          <Link href={`/propiedades?municipio=${encodeURIComponent(property.municipio)}`} className="hover:text-brand transition-colors">
            {property.municipio === 'Centro' ? 'Villahermosa' : property.municipio}
          </Link>
          <ChevronRight size={12} />
          <span className="text-gray-600 font-medium truncate max-w-[200px]">{property.titulo}</span>
        </nav>

        <OwnerActionsBar propertyId={property.id} />

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pb-14">

          {/* ━━━━━━━━━━━━━━ LEFT — Content card ━━━━━━━━━━━━━━ */}
          <div className="lg:col-span-2">

            {/* Gallery — rounded top, sin padding, parte de la card */}
            <div className="bg-white rounded-t-2xl overflow-hidden border border-b-0 border-gray-200 shadow-sm">
              <PropertyGallery fotos={property.fotos} titulo={property.titulo} tipo={property.tipo} />
            </div>

            {/* Content sections — misma card, divididas con separadores */}
            <div className="bg-white rounded-b-2xl border border-t-0 border-gray-200 shadow-sm divide-y divide-gray-100">

              {/* Mobile: título + precio */}
              <div className="lg:hidden px-5 py-5">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Badge variant={property.operacion} label={property.operacion === 'venta' ? 'Venta' : 'Renta'} />
                  <Badge variant="default" label={TIPO_LABEL[property.tipo]} />
                  {property.featured && <Badge variant="featured" label="Destacada" />}
                  {property.cercaDosoBocas && <Badge variant="dosabocas" label="Dos Bocas" icon={<Zap size={11} />} />}
                </div>
                <h1 className="text-xl font-heading font-bold text-gray-900 leading-snug">{property.titulo}</h1>
                <p className="flex items-center gap-1 text-gray-400 text-sm mt-1.5">
                  <MapPin size={13} /> {property.colonia}, {property.municipio}
                </p>
                <div className="mt-3">
                  <PriceTag precio={property.precio} operacion={property.operacion} size="lg" />
                </div>
              </div>

              {/* Specs */}
              <div className="px-5 py-5">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-4">Características</h2>
                <PropertySpecs property={property} />
              </div>

              {/* Description */}
              <div className="px-5 py-5">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-3">Descripción</h2>
                <p className="text-gray-600 text-base leading-relaxed whitespace-pre-line">{property.descripcion}</p>
              </div>

              {/* Amenidades */}
              {property.amenidades.length > 0 && (
                <div className="px-5 py-5">
                  <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-4">Amenidades</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {property.amenidades.map((a) => (
                      <div key={a} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2.5">
                        <CheckCircle size={14} className="text-brand flex-shrink-0" />
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mapa */}
              <div className="px-5 py-5">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-4">Ubicación</h2>
                <div className="h-64 rounded-xl overflow-hidden border border-gray-100">
                  <MapViewDynamic markers={singleMarker} center={[property.latPublico, property.lngPublico]} zoom={14} approximate approximateRadius={350} />
                </div>
                <p className="flex items-center gap-1 text-[11px] text-gray-400 mt-2">
                  <ShieldCheck size={11} className="flex-shrink-0" />
                  Por seguridad del propietario, el mapa muestra la zona aproximada — la dirección exacta se comparte al contactar.
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin size={12} className="flex-shrink-0" /> {property.colonia}, {property.municipio}
                  </p>
                </div>
                {/* Solo aparece si se llegó aquí desde una búsqueda "cerca de
                    X" — hace visible y verificable la distancia real que ya
                    se usó para filtrar, en vez de dejarla como un cálculo
                    invisible que el usuario no puede comprobar. */}
                {landmarkCercano && distanciaLandmark !== undefined && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-pale px-2.5 py-1.5 rounded-lg mt-2 w-fit">
                    <Navigation size={12} className="flex-shrink-0" />
                    A {distanciaLandmark.toFixed(1)} km de {landmarkCercano.label}
                  </p>
                )}
                {categoriaCercana && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-pale px-2.5 py-1.5 rounded-lg mt-2 w-fit">
                    <Navigation size={12} className="flex-shrink-0" />
                    A {categoriaCercana.distancia.toFixed(1)} km de {categoriaCercana.label} más cercano
                  </p>
                )}
                {coloniaCercana && distanciaColonia !== undefined && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-pale px-2.5 py-1.5 rounded-lg mt-2 w-fit">
                    <Navigation size={12} className="flex-shrink-0" />
                    A {distanciaColonia.toFixed(1)} km de {coloniaCercana.label}
                  </p>
                )}
              </div>

              {/* Flood risk */}
              <div className="px-5 pb-5">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-3">
                  <Droplets size={13} className="flex-shrink-0" /> Riesgo de inundación
                </h2>
                <FloodRiskBadge nivel={property.riesgoInundacion} />
              </div>

              {/* Alerta de fraude — solo aparece si el análisis automático al
                  publicar marcó riesgo "alto" (ver PublishForm.tsx). */}
              {property.alertaFraude && (
                <div className="px-5 pb-5">
                  <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-3">
                    <ShieldAlert size={13} className="flex-shrink-0" /> Aviso de revisión
                  </h2>
                  <FraudAlertBadge alerta={property.alertaFraude} />
                </div>
              )}

            </div>
          </div>

          {/* ━━━━━━━━━━━━━━ RIGHT — Sidebar ━━━━━━━━━━━━━━ */}
          <div className="lg:col-span-1">
            {/* sticky solo desde lg — en móvil este bloque va apilado debajo
                del contenido principal, sticky ahí no tenía ningún efecto
                real (no hay hermano más alto para "pasar por encima"),
                solo quedaba mal etiquetado. */}
            <div className="lg:sticky lg:top-24 space-y-4">

              {/* ① Card de zona — fondo verde */}
              <div className="bg-gradient-to-br from-brand-dark via-brand to-brand-light rounded-2xl overflow-hidden shadow-sm">
                {/* Encabezado: badges, título, ubicación, precio */}
                <div className="px-5 pt-5 pb-4 border-b border-white/10">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant={property.operacion} label={property.operacion === 'venta' ? 'Venta' : 'Renta'} className="!bg-white !text-brand-dark shadow-sm" />
                    <Badge variant="default" label={TIPO_LABEL[property.tipo]} className="!bg-white/20 !text-white border !border-white/30" />
                    {property.featured && <Badge variant="featured" label="Destacada" className="!bg-white/20 !text-white !border-white/30" />}
                    {property.cercaDosoBocas && <Badge variant="dosabocas" label="Dos Bocas" icon={<Zap size={11} />} className="!bg-white/20 !text-white !border-white/30" />}
                  </div>
                  <h2 className="text-base font-heading font-bold text-white leading-snug mb-0.5">{property.titulo}</h2>
                  <p className="flex items-center gap-1 text-white/60 text-xs mb-3">
                    <MapPin size={11} /> {property.colonia}, {property.municipio}
                  </p>
                  <p className="text-3xl font-heading font-bold text-white leading-none">
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(property.precio)}
                    {property.operacion === 'renta' && <span className="text-base font-normal text-white/60 ml-1">/mes</span>}
                  </p>
                  {precioSospechoso && (
                    <p className="flex items-start gap-1.5 text-[11px] text-amber-200 bg-amber-500/15 border border-amber-400/30 rounded-lg px-2.5 py-2 mt-2.5">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      Este precio está muy por debajo del promedio de la zona — verifica bien antes de dar cualquier anticipo.
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-white/50 mt-2">
                    <Calendar size={11} />
                    Publicada {formatRelativeDate(property.fechaPublicacion)}
                  </div>
                </div>

                {/* Datos de zona */}
                <div className="px-5 py-4 border-b border-white/10">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/40 mb-3">Zona</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-sm text-white/60 flex-shrink-0">
                        <MapPin size={13} className="text-white/40" /> Colonia
                      </span>
                      <span className="text-sm font-semibold text-white text-right truncate">{property.colonia}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-sm text-white/60 flex-shrink-0">
                        <Building2 size={13} className="text-white/40" /> Municipio
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {property.municipio === 'Centro' ? 'Villahermosa' : property.municipio}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-sm text-white/60 flex-shrink-0">
                        <Droplets size={13} className="text-white/40" /> Inundación
                      </span>
                      <FloodRiskBadge nivel={property.riesgoInundacion} compact />
                    </div>
                    {property.cercaDosoBocas && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-sm text-white/60">
                          <Zap size={13} className="text-white/40" /> Dos Bocas
                        </span>
                        <span className="text-xs font-bold bg-amber-400/20 text-amber-200 px-2.5 py-1 rounded-full">Zona cercana</span>
                      </div>
                    )}
                    {property.zonaEcologica && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-sm text-white/60">
                          <Leaf size={13} className="text-white/40" /> Zona ecológica
                        </span>
                        <span className="text-xs font-bold bg-white/15 text-white px-2.5 py-1 rounded-full">Sí</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Servicios — solo renta */}
                {property.operacion === 'renta' && property.servicios && property.servicios.length > 0 && (
                  <div className="px-5 py-4 border-b border-white/10">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/40 mb-3">Servicios incluidos</p>
                    <div className="flex flex-wrap gap-2">
                      {SERVICIOS_RENTA
                        .filter((s) => property.servicios!.includes(s.key))
                        .map(({ key, label, Icon }) => (
                          <div key={key} title={label} className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white">
                            <Icon size={18} />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Agente */}
                <div className="px-5 py-4">
                  <AgentCard
                    agent={{ nombre: property.agente.nombre, verificado: property.agente.verificado }}
                    propiedadId={property.id}
                    propertyTitle={property.titulo}
                    requiereMensajePrimero={property.requiereMensajePrimero}
                    enRevision={enRevision}
                    naked
                    dark
                  />
                </div>
              </div>

              {/* ② Card de contacto */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-20" id="contacto">
                <div className="px-5 py-5">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-4">Enviar mensaje</p>
                  <ContactForm propertyTitle={property.titulo} propertyId={property.id} />
                </div>
              </div>

              {/* ③ Compartir */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex gap-2">
                <FavoriteButton propiedadId={property.id} />
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 text-gray-600 hover:text-green-600 text-sm font-semibold py-2.5 rounded-xl transition-all">
                  <Share2 size={15} /> Compartir
                </a>
              </div>

              <div className="text-center">
                <ReportButton propiedadId={property.id} />
              </div>

            </div>
          </div>
        </div>

        {/* ── Propiedades similares ── */}
        {similar.length > 0 && (
          <section className="pb-14">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-1">Quizás también te interesa</p>
                <h2 className="text-xl font-heading font-bold text-gray-900">Propiedades similares</h2>
              </div>
              <Link href="/propiedades" className="text-sm text-brand font-semibold hover:underline">
                Ver más →
              </Link>
            </div>
            <SimilarCarousel properties={similar} />
          </section>
        )}

      </div>
    </div>
  );
}
