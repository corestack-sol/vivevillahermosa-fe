'use client';

import Link from 'next/link';
import { CheckCircle2, Building2, Sparkles, ArrowUpRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { loginRedirectUrl } from '@/lib/authRedirect';
import { buttonClasses } from '@/components/ui/Button';

const PARTICULAR_FEATURES = [
  'Publica hasta 2 propiedades',
  'Contacto directo por WhatsApp o correo',
  'Favoritos y alertas de búsqueda',
  'Visible en el catálogo público',
];

const INMOBILIARIA_FEATURES = [
  'Propiedades ilimitadas',
  'Panel profesional: gestiona toda tu cartera en un solo lugar',
  'Estadísticas por anuncio (vistas, contactos, favoritos)',
  'Anuncios destacados en el catálogo',
  'Perfil de agencia verificado',
  'Soporte prioritario',
];

export function PlanesInmobiliaria() {
  const { user, loading } = useAuth();
  const esProfesional = !!user && user.rol !== 'particular';

  return (
    <section className="bg-white border-y border-gray-100 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-1.5">Para inmobiliarias y agentes</p>
          <h2 className="text-3xl font-display font-black text-gray-900 leading-tight mb-3">
            Un plan para cada forma de vender
          </h2>
          <p className="text-gray-500 leading-relaxed">
            Publica una propiedad como particular, o gestiona toda tu cartera con el panel profesional pensado para agencias.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Particular — gratis */}
          <div className="bg-white border border-gray-200 rounded-3xl p-8 flex flex-col">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Particular</p>
            <div className="flex items-baseline gap-1.5 mb-5">
              <span className="font-display font-black text-4xl text-gray-900">$0</span>
              <span className="text-gray-400 text-sm">para siempre</span>
            </div>
            <ul className="space-y-3 mb-7 flex-1">
              {PARTICULAR_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <CheckCircle2 size={17} className="text-brand flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/publicar" className={buttonClasses('outline', 'lg', 'w-full justify-center')}>
              Publicar gratis
            </Link>
          </div>

          {/* Inmobiliaria — de paga */}
          <div className="relative bg-brand-dark text-white rounded-3xl p-8 flex flex-col overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full blur-[80px]" style={{ background: 'rgba(245,158,11,0.18)' }} />
            </div>
            <div className="relative flex-1 flex flex-col">
              <div className="inline-flex items-center gap-1.5 bg-white/10 text-amber-300 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-3 w-fit">
                <Sparkles size={11} /> Recomendado para agencias
              </div>
              <p className="text-sm font-bold text-white/60 uppercase tracking-wide mb-2">Inmobiliaria</p>
              <div className="flex items-baseline gap-1.5 mb-5">
                <span className="font-display font-black text-4xl text-white">$499</span>
                <span className="text-white/50 text-sm">MXN / mes</span>
              </div>
              <ul className="space-y-3 mb-7">
                {INMOBILIARIA_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                    <CheckCircle2 size={17} className="text-amber-300 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* La activación en sí vive en el menú de cuenta del header
                  (icono de perfil, arriba a la derecha) — aquí solo se
                  informa el plan y a dónde ir según el estado de la cuenta. */}
              <div className="mt-auto">
                {loading ? null : esProfesional ? (
                  <Link href="/dashboard/propiedades"
                    className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-colors">
                    <CheckCircle size={16} className="text-emerald-300" /> Plan activo — ir a mi panel
                  </Link>
                ) : user ? (
                  <p className="flex items-center justify-center gap-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                    <Building2 size={15} className="flex-shrink-0" />
                    Actívalo desde el menú de tu cuenta, arriba a la derecha
                  </p>
                ) : (
                  <Link href={loginRedirectUrl('/')}
                    className="flex items-center justify-center gap-2 bg-white text-brand-dark hover:bg-white/90 text-sm font-semibold px-4 py-3 rounded-xl transition-colors">
                    Inicia sesión para activarlo <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
