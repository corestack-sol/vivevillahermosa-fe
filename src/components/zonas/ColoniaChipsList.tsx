'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { ColoniaCard } from '@/lib/api';

// Pedido explícito 2026-08-18: en móvil máximo 10 chips visibles de entrada
// + botón "Ver más" para revelar el resto; la lista completa nunca pasa de
// 20 (el slice ya viene acotado desde zonas/page.tsx). Desde `sm:` (640px)
// se ven los 20 de una vez — hay espacio horizontal de sobra con
// flex-wrap, no hace falta esconder nada ahí.
const MOBILE_INITIAL = 10;

export function ColoniaChipsList({ chips }: { chips: ColoniaCard[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = chips.length > MOBILE_INITIAL;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-5">
      <span className="text-xs font-semibold text-gray-400 mr-1">También:</span>
      {chips.map((c, i) => {
        const href = c.slug ? `/zonas/${c.slug}` : `/propiedades?q=${encodeURIComponent(c.nombre)}`;
        // sm:!block gana siempre desde tablet — el estado `expanded` (solo
        // relevante en móvil) nunca esconde nada a partir de ahí.
        const mobileHidden = i >= MOBILE_INITIAL && !expanded ? 'hidden sm:!block' : '';
        return (
          <Link key={c.nombre} href={href}
            className={`text-sm font-medium text-gray-600 hover:text-brand bg-white border border-gray-200 hover:border-brand/40 hover:bg-brand-pale/40 px-3 py-1.5 rounded-full transition-all ${mobileHidden}`}>
            {c.nombre}
          </Link>
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
