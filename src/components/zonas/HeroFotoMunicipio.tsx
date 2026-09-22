'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/Skeleton';

interface HeroFotoMunicipioProps {
  src: string;
  alt: string;
}

/**
 * Foto de portada del municipio con skeleton mientras carga — antes
 * aparecía en blanco/degradado sólido hasta que el navegador terminaba de
 * pintarla, sin ningún indicio de que algo estaba cargando. Pedido
 * explícito 2026-09-22: el ícono del pejelagarto (misma pieza que ya usa
 * BrandParticles.tsx como decoración flotante) en vez de un ícono
 * genérico, "para que se sienta tabasqueño".
 */
export function HeroFotoMunicipio({ src, alt }: HeroFotoMunicipioProps) {
  const [cargada, setCargada] = useState(false);

  return (
    <>
      {!cargada && (
        <div className="absolute inset-0">
          <Skeleton variant="image" className="absolute inset-0 h-full w-full rounded-none" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Image src="/images/icons/peje-icon.webp" alt="" width={66} height={51} className="opacity-40" />
          </div>
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="(min-width: 1024px) 66vw, 100vw"
        className={`object-cover transition-opacity duration-300 ${cargada ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setCargada(true)}
      />
    </>
  );
}
