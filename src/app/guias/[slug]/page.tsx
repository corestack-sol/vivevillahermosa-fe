import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PublicarCTA } from '@/components/forms/PublicarCTA';
import {
  Clock, ArrowLeft, ArrowRight, ChevronRight, Home, Sparkles, ExternalLink, SearchCheck,
  DollarSign, Droplets, Search, Heart, MessageCircle, Flag, MapPin, type LucideIcon,
} from 'lucide-react';
import guiasData from '@/data/guias.json';
import { getCategoriaVisual } from '../categoriaConfig';
import { AdSlot } from '@/components/ads/AdSlot';

interface Props {
  params: Promise<{ slug: string }>;
}

// Mismos íconos que ya usa el resto del sitio para cada concepto — pedido
// explícito 2026-09-07: no inventar un set nuevo. DollarSign (precio,
// PublishForm/comparar), Droplets (riesgo de inundación, FloodRiskBadge),
// Search (buscador, SearchBar), Heart (favoritos, FavoriteButton),
// MessageCircle (WhatsApp/chat, AgentCard), Flag (reportar, ReportButton).
const ICONOS_SECCION: Record<string, LucideIcon> = { DollarSign, Droplets, Search, Heart, MessageCircle, Flag };

// Misma paleta "Tabasco patio" (--type-X en globals.css) que ya usan
// PropertyCard/MapaClient/FilterPanel/categoriaConfig — cada tarjeta toma
// un color distinto de ese set existente en vez de un tono nuevo. Pedido
// explícito 2026-09-07: más color en las tarjetas.
const PALETAS_SECCION: Record<string, { from: string; to: string; accent: string }> = {
  casa:         { from: 'var(--type-casa-from)',         to: 'var(--type-casa-to)',         accent: 'var(--type-casa-accent)' },
  departamento: { from: 'var(--type-departamento-from)', to: 'var(--type-departamento-to)', accent: 'var(--type-departamento-accent)' },
  terreno:      { from: 'var(--type-terreno-from)',      to: 'var(--type-terreno-to)',      accent: 'var(--type-terreno-accent)' },
  local:        { from: 'var(--type-local-from)',        to: 'var(--type-local-to)',        accent: 'var(--type-local-accent)' },
  oficina:      { from: 'var(--type-oficina-from)',      to: 'var(--type-oficina-to)',      accent: 'var(--type-oficina-accent)' },
  bodega:       { from: 'var(--type-bodega-from)',        to: 'var(--type-bodega-to)',       accent: 'var(--type-bodega-accent)' },
  habitacion:   { from: 'var(--type-habitacion-from)',   to: 'var(--type-habitacion-to)',   accent: 'var(--type-habitacion-accent)' },
};
const PALETA_FALLBACK = { from: 'var(--color-brand-pale)', to: 'var(--color-brand-pale)', accent: 'var(--color-brand)' };

export async function generateStaticParams() {
  return guiasData.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = guiasData.find((p) => p.slug === slug);
  if (!post) return { title: 'Artículo no encontrado | Vive Villahermosa' };
  return {
    title: `${post.titulo} | Vive Villahermosa Guías`,
    description: post.resumen,
  };
}

export default async function GuiaPostPage({ params }: Props) {
  const { slug } = await params;
  const post = guiasData.find((p) => p.slug === slug);
  if (!post) notFound();

  const related = guiasData.filter((p) => p.slug !== slug).slice(0, 3);
  const visual = getCategoriaVisual(post.categoria);
  // Mascota propia solo para este artículo (mismo patrón sticky que
  // /privacidad) — pedido explícito 2026-09-07. El resto de las guías
  // sigue en una sola columna, sin sidebar.
  const premium = !!(post.secciones && post.secciones.length > 0);

  return (
    <div className="bg-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className={premium ? 'grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto' : 'max-w-2xl mx-auto'}>
        <div className={premium ? 'lg:col-span-2' : ''}>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6 flex-wrap">
            <Link href="/" aria-label="Inicio" className="hover:text-brand flex items-center">
              <Home size={13} />
            </Link>
            <ChevronRight size={12} />
            <Link href="/guias" className="hover:text-brand">Guías</Link>
            <ChevronRight size={12} />
            <span className="text-gray-600 truncate max-w-xs">{post.titulo}</span>
          </nav>

          {/* Hero — misma identidad visual por categoría que ya usan las
              cards de /guias (degradado + ícono + brillo radial), en vez del
              cuadrito de ícono aislado de antes. Le da a la página de
              artículo una portada real, no solo un título sobre fondo
              blanco. */}
          <div
            className="relative h-40 rounded-3xl overflow-hidden flex items-center justify-center mb-6"
            style={{
              background: `
                radial-gradient(ellipse at 30% 30%, color-mix(in srgb, ${visual.accent} 16%, transparent) 0%, transparent 65%),
                linear-gradient(150deg, ${visual.from} 0%, ${visual.to} 100%)
              `,
            }}
          >
            <visual.Icon size={44} strokeWidth={1.25} style={{ color: visual.accent }} />
            <span
              className="absolute top-3.5 left-3.5 text-xs font-bold px-2.5 py-1 rounded-full bg-white/70 backdrop-blur-sm"
              style={{ color: visual.accent }}
            >
              {post.categoria}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
            <span className="flex items-center gap-1"><Clock size={11} /> {post.lectura} min de lectura</span>
            <span aria-hidden className="text-gray-300">·</span>
            <span>
              {new Date(post.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' })}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-black text-gray-900 leading-tight mb-3" style={{ letterSpacing: '-0.01em' }}>
            {post.titulo}
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed mb-8">{post.resumen}</p>

          {/* Content — prose-base (no prose-sm) y más aire entre párrafos:
              son artículos largos pensados para leerse completos, no un
              resumen a media pantalla. */}
          {post.secciones && post.secciones.length > 0 ? (
            <>
              {/* Diseño premium — solo para este artículo (único con
                  `secciones` en guias.json), pedido explícito 2026-09-07.
                  El resto de las guías sigue con párrafos simples más
                  abajo, sin tocar su plantilla. */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                {[
                  { Icon: MapPin, label: '17 municipios' },
                  { Icon: DollarSign, label: '$0 comisión' },
                  { Icon: Droplets, label: 'Historial de inundación por zona' },
                ].map(({ Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-pale px-3 py-1.5 rounded-full">
                    <Icon size={13} className="flex-shrink-0" /> {label}
                  </span>
                ))}
              </div>

              <p className="text-gray-700 leading-[1.8] text-lg mb-8">
                {post.contenido.split('\n\n')[0]}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                {post.secciones.map((s) => {
                  const Icon = ICONOS_SECCION[s.icono] ?? Sparkles;
                  const paleta = PALETAS_SECCION[s.paleta ?? ''] ?? PALETA_FALLBACK;
                  return (
                    <div
                      key={s.titulo}
                      className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all"
                      style={{ borderTopColor: paleta.accent, borderTopWidth: 3 }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: `linear-gradient(to bottom right, ${paleta.from}, ${paleta.to})`, color: paleta.accent }}
                      >
                        <Icon size={18} strokeWidth={1.5} />
                      </div>
                      <h3 className="font-heading font-bold text-gray-900 text-sm mb-1.5">{s.titulo}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{s.texto}</p>
                    </div>
                  );
                })}
              </div>

              <div className="prose prose-base max-w-none text-gray-700 space-y-5 mb-12">
                {post.contenido.split('\n\n').slice(1).map((para, i) => (
                  <p key={i} className="leading-[1.8]">{para}</p>
                ))}
              </div>
            </>
          ) : (
            <div className="prose prose-base max-w-none text-gray-700 space-y-5 mb-12">
              {post.contenido.split('\n\n').map((para, i) => (
                <p key={i} className="leading-[1.8]">{para}</p>
              ))}
            </div>
          )}

          {/* Herramientas de verificación — opcional por artículo (ver
              guias.json), solo para el que recomienda búsqueda inversa de
              imagen. Distinto del link-dump de fuentes al final (decisión
              2026-08-23 de no incluirlo): esto es una herramienta útil
              para actuar en el momento, no una cita, así que sí amerita
              enlace directo. */}
          {post.herramientas && post.herramientas.length > 0 && (
            <div className="border border-gray-200 rounded-2xl p-5 mb-12">
              <p className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                <SearchCheck size={15} className="text-brand" /> Compruébalo tú mismo
              </p>
              <div className="flex flex-wrap gap-2.5">
                {post.herramientas.map((h) => (
                  <a
                    key={h.url}
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-gray-50 hover:bg-brand-pale border border-gray-200 hover:border-brand/30 text-gray-700 hover:text-brand text-sm font-medium px-3.5 py-2 rounded-xl transition-colors"
                  >
                    {h.label} <ExternalLink size={13} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Anuncio — pedido explícito 2026-09-08. Después del contenido,
              antes del CTA: quien llegó hasta acá ya leyó el artículo
              completo, no interrumpe la lectura ni compite con el CTA de
              publicar/buscar propiedades. */}
          <AdSlot slot="guiaArticulo" className="mb-10" minHeight={140} />

          {/* CTA */}
          <div className="relative overflow-hidden bg-brand-dark rounded-2xl p-6 sm:p-7 mb-12">
            <Sparkles size={90} strokeWidth={1} className="absolute -right-4 -bottom-6 text-white/[0.06] pointer-events-none" />
            <p className="font-heading font-bold text-white text-lg mb-1.5">¿Listo para encontrar tu propiedad en Tabasco?</p>
            <p className="text-sm text-white/60 mb-5 max-w-md">
              Explora propiedades con riesgo de inundación incluido. Filtra por colonia, precio y zona.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/propiedades"
                className="inline-flex items-center gap-1.5 bg-white text-brand-dark text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-white/90 transition-colors">
                Ver propiedades <ArrowRight size={14} />
              </Link>
              <PublicarCTA
                className="inline-flex items-center gap-2 border border-white/25 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/10 transition-colors">
                Publicar gratis
              </PublicarCTA>
            </div>
          </div>

          {/* Back */}
          <Link href="/guias" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand transition-colors mb-12">
            <ArrowLeft size={16} /> Volver a Guías
          </Link>
        </div>

        {/* Mascota — sticky, mismo patrón que /privacidad. Solo desktop
            (hidden en móvil, no hay ancho para un tercer riel). */}
        {premium && (
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24 bg-brand-pale rounded-2xl shadow-sm p-6 text-center">
              <Image
                src="/images/icons/article-mascota.webp"
                alt=""
                width={180}
                height={210}
                className="mx-auto"
              />
              <p className="text-sm text-gray-600 mt-2">
                Todo lo que lees aquí existe de verdad en la plataforma — sin promesas de más.
              </p>
            </div>
          </div>
        )}
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="border-t border-gray-200 pt-10">
            <h2 className="text-lg font-heading font-bold text-gray-800 mb-5">Más artículos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {related.map((r) => {
                const rVisual = getCategoriaVisual(r.categoria);
                return (
                  <Link key={r.id} href={`/guias/${r.slug}`}
                    className="group bg-white rounded-2xl border border-gray-200 p-5 hover:border-brand/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                      style={{ background: `linear-gradient(to bottom right, ${rVisual.from}, ${rVisual.to})` }}
                    >
                      <rVisual.Icon size={18} strokeWidth={1.5} style={{ color: rVisual.accent }} />
                    </div>
                    <p className="text-xs text-brand font-semibold mb-1">{r.categoria}</p>
                    <h3 className="text-sm font-semibold text-gray-800 group-hover:text-brand transition-colors line-clamp-2">
                      {r.titulo}
                    </h3>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
