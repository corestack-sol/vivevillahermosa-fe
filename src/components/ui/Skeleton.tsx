interface SkeletonProps {
  variant?: 'card' | 'text' | 'image' | 'circle';
  lines?: number;
  className?: string;
}

export function Skeleton({ variant = 'text', lines = 1, className = '' }: SkeletonProps) {
  if (variant === 'card') {
    // Mismo silueta que PropertyCard (tarjeta-retrato tipo card2.png) —
    // antes era una forma distinta (imagen corta + cuerpo blanco) y el
    // remplazo por la tarjeta real se sentía como un salto de layout.
    return (
      <div className={`rounded-3xl overflow-hidden aspect-[20/21] animate-shimmer ${className}`} />
    );
  }

  if (variant === 'image') {
    return <div className={`animate-shimmer rounded-xl ${className}`} />;
  }

  if (variant === 'circle') {
    return <div className={`animate-shimmer rounded-full ${className}`} />;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded animate-shimmer"
          style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

/**
 * Reemplaza el patrón repetido en las páginas de admin (`<tr><td
 * colSpan={N}><Loader2/></td></tr>` o un spinner suelto que tumbaba toda
 * la tabla, encabezados incluidos, mientras cargaba) — mantiene el
 * encabezado real visible de inmediato y solo el cuerpo hace shimmer, para
 * que la carga se sienta como parte de la tabla, no como una pantalla
 * intermedia aparte.
 */
export function TableSkeleton({ headers, rows = 6 }: { headers: string[]; rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                {headers.map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 rounded animate-shimmer" style={{ width: `${45 + ((i + j * 2) % 4) * 12}%` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Igual que `TableSkeleton`, pero solo las filas — para cuando la página
 *  ya mantiene el `<thead>` real visible fuera del condicional de carga
 *  (ej. admin/usuarios) y solo el `<tbody>` necesita el shimmer. */
export function TableRowsSkeleton({ rows = 6, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded animate-shimmer" style={{ width: `${45 + ((i + j * 2) % 4) * 12}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Misma idea que `TableSkeleton` pero para listas de tarjetas (reportes,
 *  solicitudes de revisión) en vez de tablas. */
export function CardListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2.5">
          <div className="h-3.5 rounded animate-shimmer" style={{ width: '30%' }} />
          <div className="h-4 rounded animate-shimmer" style={{ width: '85%' }} />
          <div className="h-3.5 rounded animate-shimmer" style={{ width: '55%' }} />
        </div>
      ))}
    </div>
  );
}
