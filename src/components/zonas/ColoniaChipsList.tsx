'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { ColoniaCard } from '@/lib/api';

// Pedido explícito 2026-08-18: en móvil máximo 10 chips visibles de entrada
// + botón "Ver más" para revelar el resto; el tope real de la lista lo
// pone zonas/page.tsx (Centro + hasta 2 municipios cercanos, ver
// MAX_CHIPS_CENTRO/MAX_CHIPS_POR_MUNICIPIO/MAX_MUNICIPIOS_CHIPS ahí). Desde
// `sm:` (640px) se ven todos de una vez — hay espacio horizontal de sobra
// con flex-wrap, no hace falta esconder nada ahí.
const MOBILE_INITIAL = 10;

export function ColoniaChipsList({ chips, municipioSlugs }: { chips: ColoniaCard[]; municipioSlugs: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = chips.length > MOBILE_INITIAL;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-5">
      <span className="text-xs font-semibold text-gray-400 mr-1">También:</span>
      {chips.map((c, i) => {
        const href = c.slug ? `/zonas/${c.slug}` : `/propiedades?q=${encodeURIComponent(c.nombre)}`;
        // Los chips ya vienen ordenados Centro primero, luego el resto de
        // municipios de más cerca a más lejos (mismo orden que las cards
        // verdes, ver getColoniasOrdenadasPorDemanda), agrupados por
        // municipio. Pedido explícito 2026-08-19: el municipio se muestra
        // UNA vez por grupo ("Nacajuca: chip, chip, chip"), no repetido en
        // cada chip — se compara contra el anterior en el mismo array, no
        // contra un índice fijo, para que el corte en móvil (Ver más) no
        // pierda la etiqueta si el grupo empieza justo ahí.
        const esNuevoGrupo = c.municipio !== 'Centro' && c.municipio !== chips[i - 1]?.municipio;
        const visibilidad = i >= MOBILE_INITIAL && !expanded ? 'hidden sm:!inline-flex' : 'inline-flex';
        return (
          <span key={c.nombre} className={`items-center gap-1.5 ${visibilidad}`}>
            {esNuevoGrupo && (
              municipioSlugs[c.municipio] ? (
                // Pedido explícito 2026-08-19: la etiqueta de municipio
                // enlaza a /zonas/[slug] — la misma página de municipio
                // que ya usa la grilla de abajo, con sus propiedades.
                <Link
                  href={`/zonas/${municipioSlugs[c.municipio]}`}
                  className="text-xs font-semibold text-gray-400 hover:text-brand mr-0.5 transition-colors"
                >
                  {c.municipio}:
                </Link>
              ) : (
                <span className="text-xs font-semibold text-gray-400 mr-0.5">{c.municipio}:</span>
              )
            )}
            <Link href={href}
              className="text-sm font-medium text-gray-600 hover:text-brand bg-white border border-gray-200 hover:border-brand/40 hover:bg-brand-pale/40 px-3 py-1.5 rounded-full transition-all">
              {c.nombre}
            </Link>
          </span>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="sm:hidden flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark px-3 py-1.5 rounded-full transition-colors"
        >
          {expanded ? 'Ver menos' : `Ver más (${chips.length - MOBILE_INITIAL})`}
          <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}
