'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, RotateCw } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';

// Sin este archivo, cualquier error no atrapado (ej. el backend caído
// justo cuando el Home hace sus 4 llamadas server-side) tumbaba TODO el
// sitio a la página de error genérica de Next.js, sin marca ni salida —
// confirmado: no existía ningún error.tsx/global-error.tsx en todo el
// árbol. Mismo estilo visual que not-found.tsx para que un error real se
// sienta parte del sitio, no un mensaje de framework.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-brand-dark via-brand to-brand-light">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(ellipse, rgba(13,112,101,0.35) 0%, transparent 70%)' }} />
      </div>

      <div className="relative min-h-[70vh] flex items-center justify-center px-4 py-20">
        <div className="max-w-lg w-full text-center">
          {/* Misma mascota que not-found.tsx (pedido explícito 2026-09-02) —
              un solo ícono de "algo no salió bien" en toda la plataforma,
              en vez de uno genérico por tipo de error. */}
          <Image
            src="/images/icons/404-mascota.webp"
            alt=""
            width={168}
            height={104}
            priority
            className="mx-auto mb-6"
          />

          <p className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] mb-3">Algo salió mal</p>
          <h1 className="font-display font-black text-white leading-tight mb-3"
            style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', letterSpacing: '-0.02em' }}>
            No pudimos cargar esta página
          </h1>
          <p className="text-white/55 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
            Fue un problema pasajero de nuestro lado. Intenta de nuevo en un momento.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={reset} className={buttonClasses('light', 'lg')}>
              <RotateCw size={16} /> Intentar de nuevo
            </button>
            <Link href="/" className={buttonClasses('outline', 'lg', '!border-white/30 !text-white hover:!bg-white/10')}>
              <Home size={16} /> Ir al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
