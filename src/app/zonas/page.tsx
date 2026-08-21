import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin, ChevronRight, Zap, Map as MapIcon, Flame,
  type LucideIcon,
} from 'lucide-react';
import { getMunicipalitiesWithLiveStats, getColoniasOrdenadasPorDemanda } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { ExploreZonasCta } from '@/components/search/ExploreZonasCta';
import { ColoniaChipsList } from '@/components/zonas/ColoniaChipsList';

const MAX_CARDS = 6;

// Ícono de marca de agua por municipio — pedido explícito 2026-08-18:
// "un icono relacionado con las características que se describe por
// municipio... como marca de agua, como en las cards verdes" (esas usan
// Building2 fijo para todas). Elegido a mano contra la descripción REAL de
// cada uno (src/data/municipalities.json), no decoración arbitraria —
// municipios que de verdad comparten el mismo rasgo (ganadero, ribereño,
// agrícola) comparten ícono a propósito, no todos tienen que ser únicos.
// Dos entradas usan íconos propios (recortados de src/assets/icons/,
// public/images/icons/*-color.webp) en su color original — pedido
// explícito 2026-08-19 ("apliquenlos tal cual estan, con colores"), no
// se tiñen de verde de marca como los Lucide.
type MunIconSpec = { type: 'lucide'; Icon: LucideIcon } | { type: 'color'; src: string; aspect: number; scale?: number };

const GANADERIA: MunIconSpec = { type: 'color', src: '/images/icons/ganaderia-color.webp', aspect: 154 / 156 };
const MASCARA_TENOSIQUE: MunIconSpec = { type: 'color', src: '/images/icons/mask-tenosique-color.webp', aspect: 159 / 169 };
const CASCADA: MunIconSpec = { type: 'color', src: '/images/icons/cascada-color.webp', aspect: 148 / 164 };
const PEZ: MunIconSpec = { type: 'color', src: '/images/icons/pez-color.webp', aspect: 156 / 98 };
const CACAO: MunIconSpec = { type: 'color', src: '/images/icons/cacao-color.webp', aspect: 154 / 155 };
// aspect muy ancho (3.1) — reduce un 15% el tamaño general y luego el
// ancho 20% + 15% más (aspect *0.8*0.85) para que no se salga tanto de
// la card, pedido explícito 2026-08-19.
const PEJE: MunIconSpec = { type: 'color', src: '/images/icons/peje-color.webp', aspect: (155 / 50) * 0.8 * 0.85, scale: 0.85 };
const OLMECA: MunIconSpec = { type: 'color', src: '/images/icons/olmeca-color.webp', aspect: 159 / 178 };
const AGROINDUSTRIA: MunIconSpec = { type: 'color', src: '/images/icons/agroindustria-color.webp', aspect: 157 / 129 };
const ARTESANIA: MunIconSpec = { type: 'color', src: '/images/icons/artesania-color.webp', aspect: 151 / 184 };
const JICARA: MunIconSpec = { type: 'color', src: '/images/icons/jicara-color.webp', aspect: 153 / 245 };

const MUNICIPIO_ICON: Record<string, MunIconSpec> = {
  'centro':            OLMECA,                                    // capital del estado — cabeza olmeca, pedido explícito 2026-08-19
  'cardenas':          CACAO,                                    // agroindustria — cacao, pedido explícito 2026-08-19
  'comalcalco':        CACAO,                                    // ciudad del cacao — pedido explícito 2026-08-19
  'paraiso':           PEZ,                                      // zona costera junto a la Refinería Dos Bocas — pedido explícito 2026-08-19
  'jalpa-de-mendez':   JICARA,                                    // jícaras pintadas — pedido explícito 2026-08-19
  'nacajuca':          ARTESANIA,                                // artesanía de mimbre y bejuco — pedido explícito 2026-08-19
  'huimanguillo':      GANADERIA,                                // ganadero y petrolero — pedido explícito 2026-08-19
  'centla':            PEZ,                                      // pesca, reservas naturales — pedido explícito 2026-08-19
  'macuspana':         PEJE,                                     // pejelagarto — pedido explícito 2026-08-19
  'cunduacan':         AGROINDUSTRIA,                             // agroindustrial — pedido explícito 2026-08-19
  'tenosique':         MASCARA_TENOSIQUE,                         // Baile del Pochó — máscara real, pedido explícito 2026-08-19
  'emiliano-zapata':   AGROINDUSTRIA,                             // ribereño y agroindustrial — pedido explícito 2026-08-19
  'balancán':          GANADERIA,                                 // ganadero, grandes extensiones — pedido explícito 2026-08-19
  'jonuta':            PEZ,                                      // pesca y agricultura, ribereño — pedido explícito 2026-08-19
  'jalapa':            AGROINDUSTRIA,                             // vocación agrícola — pedido explícito 2026-08-19
  'tacotalpa':         CASCADA,                                  // "Sierra tabasqueña" — cascadas de la sierra, pedido explícito 2026-08-19
  'teapa':             CASCADA,                                  // balnearios y cascadas — ícono propio, pedido explícito 2026-08-19
};

/** Ícono de municipio — Lucide normal (se tiñe con `text-brand` vía
 *  `className`), o ícono propio en su color original (ver MunIconSpec). */
function MunicipioIcon({ spec, size, className }: { spec: MunIconSpec; size: number; className?: string }) {
  if (spec.type === 'lucide') {
    const { Icon } = spec;
    return <Icon size={size} strokeWidth={size > 40 ? 1 : 1.75} className={className} />;
  }
  const height = Math.round(size * (spec.scale ?? 1));
  const width = Math.round(height * spec.aspect);
  return (
    <Image
      src={spec.src}
      alt=""
      width={width}
      height={height}
      className="flex-shrink-0 object-contain"
    />
  );
}
// Tope de chips ("También:") por grupo — pedido explícito 2026-08-19: con
// un tope plano de 20 (el de antes), Centro por sí solo (18+ colonias con
// propiedad) llenaba las 20 y ningún otro municipio llegaba a aparecer en
// escritorio, donde se ven todos de una vez sin "Ver más". Ahora Centro
// aporta como máximo MAX_CHIPS_CENTRO, y el resto de municipios (los más
// cercanos primero, mismo orden de siempre) aportan como máximo
// MAX_CHIPS_POR_MUNICIPIO cada uno, hasta MAX_MUNICIPIOS_CHIPS distintos.
const MAX_CHIPS_CENTRO = 10;
const MAX_CHIPS_POR_MUNICIPIO = 4;
const MAX_MUNICIPIOS_CHIPS = 4;

export const metadata: Metadata = {
  title: 'Colonias y municipios de Tabasco | Vive Villahermosa',
  description:
    'Busca casa por colonia en Villahermosa — Tabasco 2000, Gaviotas, Framboyanes, Carrizal, Atasta — o explora los 17 municipios del estado. Casas en renta y venta en Tabasco.',
};

export default async function ZonasPage() {
  const municipalities = await getMunicipalitiesWithLiveStats();
  // BACKEND.md §9.1 — ordenadas por DEMANDA real (búsquedas + vistas +
  // contactos de los últimos 7 días) cuando ya hay algún evento registrado;
  // si todavía no hay ninguno (plataforma recién desplegada, o falló la
  // llamada al backend), `getColoniasOrdenadasPorDemanda` cae honestamente
  // al mismo orden por OFERTA de siempre — `porDemanda` dice cuál de los dos
  // casos es, así el texto de abajo nunca afirma una demanda que en
  // realidad no está midiendo. Las primeras MAX_CARDS se ven como tarjeta
  // grande, el resto como chip.
  const { colonias: coloniasRanked, porDemanda, tieneDemandaReal } = await getColoniasOrdenadasPorDemanda();
  const coloniasCards = coloniasRanked.slice(0, MAX_CARDS);

  // El resto ya viene ordenado por cercanía real (Centro primero, luego
  // municipios de más cerca a más lejos, ver getColoniasOrdenadasPorDemanda)
  // — recorrerlo en ese mismo orden aplicando los topes por grupo preserva
  // el orden geográfico sin que Centro se coma todo el cupo.
  const resto = coloniasRanked.slice(MAX_CARDS);
  // MAX_CHIPS_CENTRO es el tope de Centro en TODA la página, no solo en los
  // chips — las cards verdes de arriba (casi siempre de Centro, por ser el
  // municipio con más oferta) ya cuentan contra ese cupo.
  const centroEnCards = coloniasCards.filter((c) => c.municipio === 'Centro').length;
  const centroChips = resto.filter((c) => c.municipio === 'Centro').slice(0, Math.max(0, MAX_CHIPS_CENTRO - centroEnCards));
  const conteoPorMunicipio = new Map<string, number>();
  const otrosChips: typeof resto = [];
  for (const c of resto) {
    if (c.municipio === 'Centro') continue;
    if (!conteoPorMunicipio.has(c.municipio)) {
      if (conteoPorMunicipio.size >= MAX_MUNICIPIOS_CHIPS) continue;
      conteoPorMunicipio.set(c.municipio, 0);
    }
    const n = conteoPorMunicipio.get(c.municipio)!;
    if (n < MAX_CHIPS_POR_MUNICIPIO) {
      otrosChips.push(c);
      conteoPorMunicipio.set(c.municipio, n + 1);
    }
  }
  const coloniasChips = [...centroChips, ...otrosChips];
  // Municipio -> slug real (/zonas/[slug]) para que la etiqueta de grupo de
  // ColoniaChipsList ("Nacajuca:") enlace a esa página — pedido explícito
  // 2026-08-19. `municipalities` ya viene cargado para la grilla de abajo,
  // sin fetch aparte. `nombre` coincide tal cual con `colonia.municipio`
  // para todos salvo Centro ("Centro (Villahermosa)" vs. "Centro"), pero
  // Centro nunca lleva etiqueta de grupo (ver ColoniaChipsList), así que
  // ese caso no hace falta cubrirlo aquí.
  const municipioSlugPorNombre = Object.fromEntries(municipalities.map((m) => [m.nombre, m.slug]));
  // Respaldo por oferta (cuando porDemanda es false): solo se marca "con más
  // propiedades" cuando de verdad se despega del resto (no cuando todas
  // empatan en 1 propiedad) — evita que la llama pierda significado si el
  // catálogo apenas empieza.
  const maxPropiedades = coloniasCards[0]?.propiedades ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Gradiente de la llama (rojo abajo -> amarillo arriba, pedido
          explícito 2026-08-20) — se define una sola vez aquí y cada
          <Flame> de este archivo lo referencia por id via stroke. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="flame-gradient" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mb-10">
        <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-1.5 animate-fade-up">Todo Tabasco</p>
        <h1 className="text-3xl font-display font-black text-gray-900 mb-2 animate-fade-up" style={{ animationDelay: '80ms' }}>
          ¿En qué parte de Tabasco quieres vivir?
        </h1>
        <p className="text-gray-500 animate-fade-up" style={{ animationDelay: '160ms' }}>
          {/* "movimiento" no decía de qué (¿ventas? ¿búsquedas? ¿nuevas
              publicaciones?) — pedido explícito 2026-08-18: "no queda
              claro de qué". Ahora dice exactamente lo mismo que el título
              de la sección de abajo (mismo dato real, misma condición
              porDemanda), en vez de un término aparte sin definir. */}
          Empieza por la colonia {porDemanda ? 'más buscada' : 'con más propiedades'}, o explora los 17 municipios del estado.
        </p>
      </div>

      {/* ── Colonias con más propiedades — mismo lenguaje visual que las
          tarjetas de zona del home (gradiente de marca, texto abajo).
          Ordenadas por actividad real, no por curación manual: las primeras
          MAX_CARDS (6, igual en móvil y escritorio — pedido explícito
          2026-08-19) se ven en grande, el resto como chip. ── */}
      <section className="mb-10">
        <h2 className="text-xl font-heading font-bold text-gray-900 mb-5">
          {porDemanda ? 'Colonias más buscadas' : 'Colonias con más propiedades'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coloniasCards.map((colonia) => {
            const href = colonia.slug ? `/zonas/${colonia.slug}` : `/propiedades?q=${encodeURIComponent(colonia.nombre)}`;
            // Llama: en modo demanda, en TODAS las colonias con búsquedas
            // reales registradas (no solo la #1) — pedido explícito
            // 2026-08-19. En el respaldo por oferta, solo cuando de verdad
            // se despega del resto.
            const mostrarLlama = porDemanda
              ? tieneDemandaReal(colonia.nombre)
              : maxPropiedades > 1 && colonia.propiedades === maxPropiedades;
            return (
              <Link
                key={colonia.nombre}
                href={href}
                className="group relative h-52 rounded-3xl overflow-hidden bg-gradient-to-br from-brand-dark to-brand shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Ícono de marca de agua — mismo truco que PropertyCard, sutil, no compite con el texto — pedido explícito 2026-08-19 */}
                <div className="absolute -right-5 -bottom-6 opacity-[0.15] pointer-events-none">
                  <Image src="/images/icons/colonia-color.webp" alt="" width={218} height={130} className="object-contain" />
                </div>
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />

                <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1 bg-white/15 backdrop-blur-sm text-white/90 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                      <MapPin size={10} /> {colonia.municipio === 'Centro' ? 'Villahermosa' : colonia.municipio}
                    </span>
                    {mostrarLlama && (
                      <span title={porDemanda ? 'Con búsquedas reales recientes' : 'La colonia con más propiedades publicadas ahora mismo'} className="relative inline-flex flex-shrink-0">
                        <Flame size={18} stroke="url(#flame-gradient)" className="animate-flame" strokeWidth={2} />
                        <span aria-hidden="true" className="absolute -top-0.5 right-0 w-1 h-1 rounded-full bg-amber-300 animate-spark" />
                        <span aria-hidden="true" className="absolute -top-0.5 right-0.5 w-1 h-1 rounded-full bg-amber-200 animate-spark [animation-delay:0.4s]" />
                        <span aria-hidden="true" className="absolute top-0 left-0.5 w-1 h-1 rounded-full bg-red-500 animate-spark-slow" />
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

        {coloniasChips.length > 0 && <ColoniaChipsList chips={coloniasChips} municipioSlugs={municipioSlugPorNombre} />}
      </section>

      {/* ── Municipios — grid más denso (17 items), tarjetas claras y compactas ── */}
      <section>
        <h2 className="text-xl font-heading font-bold text-gray-900 mb-5">
          Los 17 municipios — más allá de Villahermosa
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {municipalities.map((mun) => {
            const munSpec = MUNICIPIO_ICON[mun.id] ?? { type: 'lucide' as const, Icon: MapIcon };
            return (
              <Link
                key={mun.id}
                href={`/zonas/${mun.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-brand/10 bg-gradient-to-br from-brand-pale/70 via-white to-white p-5 transition-all duration-200 hover:border-brand/30 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="relative flex items-start justify-between mb-3">
                  {/* El ícono pasa de insignia pequeña + marca de agua casi
                      invisible a protagonista único, a color real (los
                      íconos "color" ya traen su propio color, no se tiñen)
                      — se eligieron a mano por lo que de verdad distingue
                      a cada municipio, mejor mostrarlos que esconderlos. */}
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                    <MunicipioIcon spec={munSpec} size={30} className={munSpec.type === 'lucide' ? 'text-brand' : ''} />
                  </div>
                  {mun.cercaDosoBocas && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full flex-shrink-0">
                      <Zap size={9} /> PEMEX
                    </span>
                  )}
                </div>
                <h3 className="relative font-heading font-bold text-gray-900 text-sm mb-1 group-hover:text-brand transition-colors">
                  {mun.nombre}
                </h3>
                <p className="relative text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed min-h-[2rem]">{mun.descripcion}</p>
                <div className="relative pt-3 border-t border-gray-900/5">
                  <span className={`text-xs font-semibold ${mun.propiedades > 0 ? 'text-brand' : 'text-gray-300'}`}>
                    {mun.propiedades > 0 ? `${mun.propiedades} propiedad${mun.propiedades !== 1 ? 'es' : ''}` : 'Sin propiedades'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="mt-12">
        <ExploreZonasCta />
      </div>
    </div>
  );
}
