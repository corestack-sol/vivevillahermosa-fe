import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, ArrowLeft, ChevronRight } from 'lucide-react';
import blogData from '@/data/blog.json';
import { getCategoriaVisual } from '../categoriaConfig';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogData.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = blogData.find((p) => p.slug === slug);
  if (!post) return { title: 'Artículo no encontrado | Vive Villahermosa' };
  return {
    title: `${post.titulo} | Vive Villahermosa Blog`,
    description: post.resumen,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = blogData.find((p) => p.slug === slug);
  if (!post) notFound();

  const related = blogData.filter((p) => p.slug !== slug).slice(0, 3);
  const visual = getCategoriaVisual(post.categoria);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs text-gray-400 mb-6 flex-wrap">
          <Link href="/" className="hover:text-brand">Inicio</Link>
          <ChevronRight size={12} />
          <Link href="/blog" className="hover:text-brand">Blog</Link>
          <ChevronRight size={12} />
          <span className="text-gray-600 truncate max-w-xs">{post.titulo}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: visual.from, color: visual.accent }}
            >
              {post.categoria}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={11} /> {post.lectura} min de lectura
            </span>
            <span className="text-xs text-gray-400">
              {new Date(post.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          {/* Ícono + degradado por categoría, no el emoji suelto de antes */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `linear-gradient(to bottom right, ${visual.from}, ${visual.to})` }}
          >
            <visual.Icon size={28} strokeWidth={1.5} style={{ color: visual.accent }} />
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 leading-snug mb-3">
            {post.titulo}
          </h1>
          <p className="text-gray-500 text-base leading-relaxed">{post.resumen}</p>
        </div>

        {/* Content */}
        <div className="prose prose-sm max-w-none text-gray-700 space-y-4 mb-12">
          {post.contenido.split('\n\n').map((para, i) => (
            <p key={i} className="leading-relaxed">{para}</p>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-brand-pale rounded-2xl p-6 mb-12">
          <p className="font-heading font-bold text-brand-dark mb-2">¿Listo para encontrar tu propiedad en Tabasco?</p>
          <p className="text-sm text-gray-600 mb-4">
            Explora propiedades con riesgo de inundación incluido. Filtra por colonia, precio y zona.
          </p>
          <div className="flex gap-3">
            <Link href="/propiedades"
              className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-dark transition-colors">
              Ver propiedades
            </Link>
            <Link href="/publicar"
              className="inline-flex items-center gap-2 border-2 border-brand text-brand text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand hover:text-white transition-colors">
              Publicar gratis
            </Link>
          </div>
        </div>

        {/* Back */}
        <Link href="/blog" className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand transition-colors mb-12">
          <ArrowLeft size={16} /> Volver al blog
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
                <Link key={r.id} href={`/blog/${r.slug}`}
                  className="group bg-white rounded-2xl border border-gray-200 p-5 hover:border-brand/30 hover:shadow-md transition-all">
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
  );
}
