import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, ArrowLeft, ArrowRight, ChevronRight, Home, Sparkles, ExternalLink, SearchCheck } from 'lucide-react';
import guiasData from '@/data/guias.json';
import { getCategoriaVisual } from '../categoriaConfig';

interface Props {
  params: Promise<{ slug: string }>;
}

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

  return (
    <div className="bg-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="max-w-2xl mx-auto">
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
          <div className="prose prose-base max-w-none text-gray-700 space-y-5 mb-12">
            {post.contenido.split('\n\n').map((para, i) => (
              <p key={i} className="leading-[1.8]">{para}</p>
            ))}
          </div>

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
              <Link href="/publicar"
                className="inline-flex items-center gap-2 border border-white/25 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/10 transition-colors">
                Publicar gratis
              </Link>
            </div>
          </div>

          {/* Back */}
          <Link href="/guias" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand transition-colors mb-12">
            <ArrowLeft size={16} /> Volver a Guías
          </Link>
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
