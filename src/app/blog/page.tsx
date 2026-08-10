import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import blogData from '@/data/blog.json';

export const metadata: Metadata = {
  title: 'Blog Inmobiliario de Tabasco | Vive Villahermosa',
  description: 'Guías, comparativas y consejos sobre el mercado inmobiliario de Tabasco y Villahermosa. Inundaciones, colonias, precios y más.',
};

const CATEGORIA_COLORS: Record<string, string> = {
  Guía: 'bg-blue-50 text-blue-700',
  Comparativa: 'bg-purple-50 text-purple-700',
  Consejos: 'bg-green-50 text-green-700',
  Mercado: 'bg-amber-50 text-amber-700',
};

export default function BlogPage() {
  const posts = blogData;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2 animate-fade-up">
          Blog inmobiliario de Tabasco
        </h1>
        <p className="text-gray-500 animate-fade-up" style={{ animationDelay: '80ms' }}>
          Todo lo que necesitas saber para encontrar, rentar o vender una propiedad en Tabasco.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-brand/30 transition-all"
          >
            {/* Thumbnail */}
            <div className="h-36 bg-gradient-to-br from-brand-pale to-sky/20 flex items-center justify-center text-5xl">
              {post.imagen}
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${CATEGORIA_COLORS[post.categoria] ?? 'bg-gray-100 text-gray-600'}`}>
                  {post.categoria}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={10} /> {post.lectura} min
                </span>
              </div>

              <h2 className="text-sm font-bold text-gray-800 leading-snug mb-2 group-hover:text-brand transition-colors line-clamp-2">
                {post.titulo}
              </h2>
              <p className="text-xs text-gray-500 line-clamp-3 mb-4">{post.resumen}</p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {new Date(post.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="text-xs text-brand font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                  Leer <ArrowRight size={12} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
