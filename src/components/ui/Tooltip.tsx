import type { ReactNode } from 'react';

interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Tooltip CSS-only (sin JS/estado) — mismo patrón de "group-hover" que ya
 * se usa en otras partes de la plataforma (flechas de PropertyGallery,
 * chevron de las tarjetas de zona). Se usa "group/tooltip" con nombre para
 * no chocar con un `group` del elemento padre si ya existe uno.
 * Se agregó porque el `title` nativo del navegador es lento, chico, y no
 * aparece en móvil — un usuario confundió el ícono de "Contactos" con
 * "comentarios" a pesar de que ya tenía `title="Contactos"`.
 */
export function Tooltip({ label, children, className = '' }: TooltipProps) {
  return (
    <span className={`relative inline-flex group/tooltip ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-lg bg-gray-900 text-white text-[11px] font-medium px-2 py-1 opacity-0 scale-95 group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 transition-all duration-150 z-30"
      >
        {label}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
