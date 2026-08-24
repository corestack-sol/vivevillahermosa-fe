import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import guiasData from '@/data/guias.json';
import { getCategoriaVisual } from './categoriaConfig';

export const metadata: Metadata = {
  // Sin "inmobiliario" en el título — mismo criterio que /nosotros
  // (2026-08-18): la marca no debe quedar encasillada a un solo rubro.
  // "Guías" en vez de "Blog" (renombrado 2026-08-23, pedido explícito).
  // Título ajustado 2026-08-23 para reflejar el contenido real hoy — ya
  // no es solo mercado/inundaciones, incluye seguridad/detección de
  // fraude. Ruta y archivo de datos también se renombraron de blog→guias
  // ese mismo día (pedido explícito), con redirects 308 desde /blog en
  // next.config.ts para no romper lo ya indexado (ver sitemap.ts).
  title: 'Guías de vivienda y seguridad en Tabasco | Vive Villahermosa',
  description: 'Guías, comparativas y consejos sobre vivienda, mercado y seguridad en Tabasco y Villahermosa. Inundaciones, colonias, precios, cómo detectar fraudes y más.',
};

export default function GuiasPage() {
  const posts = guiasData;

  return (
    <div className="relative bg-page overflow-hidden">
      {/* Mismo collage de íconos de Tabasco del Hero de Home
          (public/images/hero-bg-collage.webp) — pedido explícito
          2026-08-23. opacity-[0.35] — subido varias veces (0.05→0.15→
          0.25→0.35) porque contra el fondo claro de esta página se
          seguía perdiendo. Capa aparte (absolute, detrás) en vez de
          opacity en la sección completa — así el texto/cards de encima
          quedan a opacidad normal. */}
      <div
        className="absolute inset-0 opacity-[0.35] pointer-events-none"
        style={{ backgroundImage: 'url(/images/hero-bg-collage.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }}
        aria-hidden="true"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2 animate-fade-up">
          Guías de Tabasco
        </h1>
        <p className="text-gray-500 animate-fade-up" style={{ animationDelay: '80ms' }}>
          Guías prácticas para encontrar, rentar o vender una propiedad en Tabasco — y para no caer en un fraude en el intento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => {
          const visual = getCategoriaVisual(post.categoria);
          return (
          <Link
            key={post.id}
            href={`/guias/${post.slug}`}
            className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-brand/30 transition-all"
          >
            {/* Thumbnail — ícono + degradado por categoría, no el emoji suelto de antes */}
            <div className="h-36 flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, ${visual.from}, ${visual.to})` }}>
              <visual.Icon size={34} strokeWidth={1.5} style={{ color: visual.accent }} />
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: visual.from, color: visual.accent }}
                >
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
                  {new Date(post.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' })}
                </span>
                <span className="text-xs text-brand font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                  Leer <ArrowRight size={12} />
                </span>
              </div>
            </div>
          </Link>
          );
        })}
      </div>
      </div>
    </div>
  );
}
