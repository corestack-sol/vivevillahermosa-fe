import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, ArrowRight, Home, Sparkles } from 'lucide-react';
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
  // Card destacada — pedido explícito 2026-08-24: "Cómo funciona Vive
  // Villahermosa" debe sentirse premium/distinta al resto, no una card
  // más del grid. Se identifica por slug (no por posición en el array)
  // para que sobreviva a un reordenamiento futuro de guias.json.
  const featured = guiasData.find((p) => p.slug === 'como-funciona-vive-villahermosa');
  const posts = guiasData.filter((p) => p !== featured);

  return (
    <div className="relative bg-page overflow-hidden">
      {/* Mismo collage de íconos de Tabasco del Hero de Home
          (public/images/hero-bg-collage.webp) — pedido explícito
          2026-08-23. opacity-[0.45] — subido varias veces (0.05→0.15→
          0.25→0.35→0.45) porque contra el fondo claro de esta página se
          seguía perdiendo. Capa aparte (absolute, detrás) en vez de
          opacity en la sección completa — así el texto/cards de encima
          quedan a opacidad normal. */}
      <div
        className="absolute inset-0 opacity-[0.45] pointer-events-none"
        style={{ backgroundImage: 'url(/images/hero-bg-collage.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }}
        aria-hidden="true"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2 animate-fade-up">
          Guías de Tabasco
        </h1>
        <p className="text-gray-500 animate-fade-up" style={{ animationDelay: '80ms' }}>
          Guías prácticas para encontrar o rentar una propiedad en Tabasco — y para no caer en un fraude en el intento.
        </p>
      </div>

      {/* Card destacada — fondo brand-dark en vez del degradado pastel de
          categoría que usa el resto, layout horizontal en vez de vertical,
          CTA con texto propio en vez del "Leer →" genérico. Distinta a
          propósito, no una card más grande. */}
      {featured && (
        <Link
          href={`/guias/${featured.slug}`}
          className="group relative block mb-8 rounded-3xl overflow-hidden bg-brand-dark shadow-lg hover:shadow-2xl transition-all duration-300"
        >
          <Sparkles size={140} strokeWidth={1} className="absolute -right-6 -top-10 text-white/[0.06] pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-center">
            <div className="flex-shrink-0 flex items-center justify-center pt-7 sm:pt-0 sm:pl-8">
              <div className="w-16 h-16 rounded-2xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <Home size={28} strokeWidth={1.5} className="text-white" />
              </div>
            </div>
            <div className="flex-1 p-6 sm:py-7 sm:pr-8 text-center sm:text-left">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-coral mb-2">
                Empieza aquí
              </span>
              <h2 className="text-lg sm:text-xl font-heading font-bold text-white leading-snug mb-1.5">
                {featured.titulo}
              </h2>
              <p className="text-sm text-white/60 mb-4 max-w-xl">{featured.resumen}</p>
              <span className="inline-flex items-center gap-1.5 bg-white text-brand-dark text-sm font-bold px-4 py-2 rounded-xl group-hover:gap-2.5 transition-all">
                Leer guía completa <ArrowRight size={14} />
              </span>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => {
          const visual = getCategoriaVisual(post.categoria);
          return (
          <Link
            key={post.id}
            href={`/guias/${post.slug}`}
            className="group bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-brand/30 hover:-translate-y-1 transition-all duration-200"
          >
            {/* Thumbnail — ícono + degradado por categoría, con el mismo
                brillo radial que ya usa el hero de artículo (misma
                identidad visual en todo /guias, no un degradado plano). */}
            <div
              className="relative h-36 overflow-hidden flex items-center justify-center"
              style={{
                background: `
                  radial-gradient(ellipse at 30% 30%, color-mix(in srgb, ${visual.accent} 18%, transparent) 0%, transparent 65%),
                  linear-gradient(150deg, ${visual.from} 0%, ${visual.to} 100%)
                `,
              }}
            >
              <visual.Icon
                size={36}
                strokeWidth={1.5}
                style={{ color: visual.accent }}
                className="transition-transform duration-300 group-hover:scale-110"
              />
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

              <h2 className="text-base font-bold text-gray-800 leading-snug mb-2 group-hover:text-brand transition-colors line-clamp-2">
                {post.titulo}
              </h2>
              <p className="text-xs text-gray-500 line-clamp-3 mb-4">{post.resumen}</p>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
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
