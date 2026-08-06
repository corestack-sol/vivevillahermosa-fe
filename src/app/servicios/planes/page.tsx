import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Clock, Star } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Planes para proveedores de servicios | Vive Villahermosa',
  description: 'Publica tu servicio gratis en Tabasco. Planes destacados próximamente.',
};

const GRATIS_FEATURES = [
  'Tu servicio visible en el directorio',
  'Contacto directo (WhatsApp, llamada, correo)',
  'Sin límite de tiempo mientras esté activo',
];

const DESTACADO_FEATURES = [
  'Aparece primero en tu categoría y municipio',
  'Insignia "Destacado" en tu ficha',
  'Estadísticas de vistas y contactos',
];

/**
 * Vista previa de precios — NADA cobra todavía. El usuario decidió esperar
 * a tener una base real de usuarios/tráfico antes de monetizar el
 * directorio de servicios (a diferencia de las propiedades, aquí no hay ni
 * siquiera un botón "Destacar" fake — solo esta página de expectativa,
 * mismo criterio honesto que PlanesInmobiliaria.tsx: nunca insinuar que
 * algo se cobró o se activó cuando no fue así.
 */
export default function PlanesServiciosPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-1.5">Para proveedores de servicios</p>
        <h1 className="text-3xl font-heading font-black text-gray-900 leading-tight mb-3">
          Publica gratis, por ahora
        </h1>
        <p className="text-gray-500 leading-relaxed">
          Estamos empezando este directorio — mientras construimos una base real de usuarios, publicar tu servicio es completamente gratis.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 flex flex-col">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Gratis</p>
          <div className="flex items-baseline gap-1.5 mb-5">
            <span className="font-display font-black text-4xl text-gray-900">$0</span>
            <span className="text-gray-400 text-sm">por ahora</span>
          </div>
          <ul className="space-y-3 mb-7 flex-1">
            {GRATIS_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                <CheckCircle2 size={17} className="text-brand flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <Link href="/servicios/publicar" className={buttonClasses('outline', 'lg', 'w-full justify-center')}>
            Publicar gratis
          </Link>
        </div>

        <div className="relative bg-gray-900 text-white rounded-3xl p-8 flex flex-col overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full blur-[80px]" style={{ background: 'rgba(245,158,11,0.15)' }} />
          </div>
          <div className="relative flex-1 flex flex-col">
            <div className="inline-flex items-center gap-1.5 bg-white/10 text-amber-300 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-3 w-fit">
              <Star size={11} /> Destacado
            </div>
            <p className="text-sm font-bold text-white/60 uppercase tracking-wide mb-2">Plan destacado</p>
            <div className="flex items-baseline gap-1.5 mb-5">
              <span className="font-display font-black text-4xl text-white">—</span>
              <span className="text-white/50 text-sm">precio por definir</span>
            </div>
            <ul className="space-y-3 mb-7">
              {DESTACADO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                  <CheckCircle2 size={17} className="text-amber-300 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              <p className="flex items-center justify-center gap-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                <Clock size={15} className="flex-shrink-0" />
                Se activará cuando haya suficientes usuarios reales
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
