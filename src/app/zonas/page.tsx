import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, ChevronRight, Zap, Building2, Map as MapIcon, Flame } from 'lucide-react';
import { getMunicipalitiesWithLiveStats, getColoniasRankedByPropiedades } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { ExploreZonasCta } from '@/components/search/ExploreZonasCta';

const MAX_CARDS = 9;

export const metadata: Metadata = {
  title: 'Colonias y municipios de Tabasco | Vive Villahermosa',
  description:
    'Busca casa por colonia en Villahermosa — Tabasco 2000, Gaviotas, Framboyanes, Carrizal, Atasta — o explora los 17 municipios del estado. Casas en renta y venta en Tabasco.',
};

export default async function ZonasPage() {
  const municipalities = await getMunicipalitiesWithLiveStats();
  // Ordenadas por cantidad real de propiedades, tengan o no ficha editorial
  // — las primeras MAX_CARDS se ven como tarjeta grande, el resto como chip.
  // El orden se recalcula solo según crece el catálogo (ver lib/api.ts).
  const coloniasRanked = await getColoniasRankedByPropiedades();
  const coloniasCards = coloniasRanked.slice(0, MAX_CARDS);
  const coloniasChips = coloniasRanked.slice(MAX_CARDS);
  // Solo se marca "con más propiedades" cuando de verdad se despega del
  // resto (no cuando todas empatan en 1 propiedad) — evita que la llama
  // pierda significado si el catálogo apenas empieza.
  //
  // ⚠️ BACKEND (docs/BACKEND.md §9): esto mide OFERTA (cuántas propiedades
  // activas tiene la colonia), no DEMANDA — no hay ningún rastreo real de
  // búsquedas/vistas/contactos por colonia en la plataforma hoy (verificado:
  // cero modelos de eventos en prisma/schema.prisma, cero analytics en
  // layout.tsx). Es dinámico y honesto para lo que mide, pero NO es lo mismo
  // que "colonia más solicitada ahora mismo" — a propósito no se fabricó esa
  // señal aquí: mostrarle a un visitante real un ícono de "tendencia" con un
  // número inventado sería el mismo problema que ya evitó el ranking público
  // de inmobiliarias (ver docs/plan-inmobiliarias.md). Cuando exista el
  // endpoint real de tendencia (§9), reemplazar `coloniasRanked` por ese
  // dato y el título del tooltip de abajo vuelve a decir "más solicitada".
  const maxPropiedades = coloniasCards[0]?.propiedades ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-1.5 animate-fade-up">Todo Tabasco</p>
        <h1 className="text-3xl font-display font-black text-gray-900 mb-2 animate-fade-up" style={{ animationDelay: '80ms' }}>
          ¿En qué parte de Tabasco quieres vivir?
        </h1>
        <p className="text-gray-500 animate-fade-up" style={{ animationDelay: '160ms' }}>
          Empieza por la colonia con más movimiento, o explora los 17 municipios del estado.
        </p>
      </div>

      {/* ── Colonias con más propiedades — mismo lenguaje visual que las
          tarjetas de zona del home (gradiente de marca, texto abajo).
          Ordenadas por actividad real, no por curación manual: las primeras
          MAX_CARDS se ven en grande, el resto como chip. ── */}
      <section className="mb-10">
        <h2 className="text-xl font-heading font-bold text-gray-900 mb-5">
          Colonias con más propiedades
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coloniasCards.map((colonia) => {
            const href = colonia.slug ? `/zonas/${colonia.slug}` : `/propiedades?q=${encodeURIComponent(colonia.nombre)}`;
            const conMasPropiedades = maxPropiedades > 1 && colonia.propiedades === maxPropiedades;
            return (
              <Link
                key={colonia.nombre}
                href={href}
                className="group relative h-52 rounded-3xl overflow-hidden bg-gradient-to-br from-brand-dark to-brand shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Ícono de marca de agua — mismo truco que PropertyCard, sutil, no compite con el texto */}
                <div className="absolute -right-5 -bottom-6 opacity-[0.12] pointer-events-none">
                  <Building2 size={150} strokeWidth={1} className="text-white" />
                </div>
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />

                <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1 bg-white/15 backdrop-blur-sm text-white/90 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                      <MapPin size={10} /> {colonia.municipio === 'Centro' ? 'Villahermosa' : colonia.municipio}
                    </span>
                    {conMasPropiedades && (
                      <span title="La colonia con más propiedades publicadas ahora mismo" className="flex-shrink-0">
                        <Flame size={18} className="text-amber-400" strokeWidth={2} />
                      </span>
                    )}
                  </div>
                  <span className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <ChevronRight size={15} className="text-white" />
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-heading font-bold text-white text-lg leading-snug mb-1">
                    {colonia.nombre}
                  </h3>
                  {colonia.descripcion && (
                    <p className="text-white/55 text-xs leading-relaxed line-clamp-1 mb-3">{colonia.descripcion}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-white font-bold">
                      {colonia.propiedades} propiedad{colonia.propiedades !== 1 ? 'es' : ''}
                    </span>
                    {colonia.precioPromedioRenta !== null && (
                      <>
                        <span className="text-white/30">·</span>
                        <span className="text-white/65">
                          Renta desde {formatPrice(colonia.precioPromedioRenta, 'renta')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {coloniasChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <span className="text-xs font-semibold text-gray-400 mr-1">También:</span>
            {coloniasChips.map((c) => {
              const href = c.slug ? `/zonas/${c.slug}` : `/propiedades?q=${encodeURIComponent(c.nombre)}`;
              return (
                <Link key={c.nombre} href={href}
                  className="text-sm font-medium text-gray-600 hover:text-brand bg-white border border-gray-200 hover:border-brand/40 hover:bg-brand-pale/40 px-3 py-1.5 rounded-full transition-all">
                  {c.nombre}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Municipios — grid más denso (17 items), tarjetas claras y compactas ── */}
      <section>
        <h2 className="text-xl font-heading font-bold text-gray-900 mb-5">
          Los 17 municipios — más allá de Villahermosa
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {municipalities.map((mun) => (
            <Link
              key={mun.id}
              href={`/zonas/${mun.slug}`}
              className="group bg-white rounded-2xl border border-gray-100 hover:border-brand/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-brand-pale flex items-center justify-center text-brand flex-shrink-0">
                  <MapIcon size={16} strokeWidth={1.75} />
                </div>
                {mun.cercaDosoBocas && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full flex-shrink-0">
                    <Zap size={9} /> PEMEX
                  </span>
                )}
              </div>
              <h3 className="font-heading font-bold text-gray-900 text-sm mb-1 group-hover:text-brand transition-colors">
                {mun.nombre}
              </h3>
              <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed min-h-[2rem]">{mun.descripcion}</p>
              <div className="pt-3 border-t border-gray-50">
                <span className={`text-xs font-semibold ${mun.propiedades > 0 ? 'text-brand' : 'text-gray-300'}`}>
                  {mun.propiedades > 0 ? `${mun.propiedades} propiedad${mun.propiedades !== 1 ? 'es' : ''}` : 'Sin propiedades'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="mt-12">
        <ExploreZonasCta />
      </div>
    </div>
  );
}
