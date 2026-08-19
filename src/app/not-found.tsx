import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Home, ArrowRight } from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { buttonClasses } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Página no encontrada | Vive Villahermosa',
};

export default function NotFound() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-brand-dark via-brand to-brand-light">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(ellipse, rgba(13,112,101,0.35) 0%, transparent 70%)' }} />
      </div>

      <div className="relative min-h-[70vh] flex items-center justify-center px-4 py-20">
        <div className="max-w-lg w-full text-center">
          {/* Misma mascota que "Próximamente en [municipio]" (/zonas/[slug])
              — pedido explícito 2026-08-19, un solo ícono de "esto no está
              listo/no existe" en toda la plataforma en vez de uno genérico
              por página. */}
          <Image
            src="/images/icons/404-mascota.webp"
            alt=""
            width={168}
            height={104}
            priority
            className="mx-auto mb-6"
          />

          <p className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] mb-3">Error 404</p>
          <h1 className="font-display font-black text-white leading-tight mb-3"
            style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', letterSpacing: '-0.02em' }}>
            Esta página no existe
          </h1>
          <p className="text-white/55 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
            El enlace puede estar roto o la propiedad ya no está disponible. Busca de nuevo o vuelve al inicio.
          </p>

          <SearchBar className="mb-7" />

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className={buttonClasses('light', 'lg')}>
              <Home size={16} /> Ir al inicio
            </Link>
            <Link href="/propiedades" className={buttonClasses('outline', 'lg', '!border-white/30 !text-white hover:!bg-white/10')}>
              Ver propiedades <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
