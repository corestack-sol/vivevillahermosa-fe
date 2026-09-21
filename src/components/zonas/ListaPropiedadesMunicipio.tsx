'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PropertyCard } from '@/components/property/PropertyCard';
import { PROPERTY_GRID_CLASSES } from '@/lib/gridClasses';
import { getPropertiesPage } from '@/lib/api';
import type { Property } from '@/types/property';

interface Props {
  inicial: Property[];
  total: number;
  municipio: string;
  tamanoPagina: number;
}

/**
 * Propiedades de un municipio de a `tamanoPagina`: la primera tanda llega ya
 * renderizada desde el servidor y el resto se pide al backend solo cuando la
 * persona pulsa "Ver más", para no cargar cientos de tarjetas de golpe.
 */
export function ListaPropiedadesMunicipio({ inicial, total, municipio, tamanoPagina }: Props) {
  const [items, setItems] = useState(inicial);
  const [totalReal, setTotalReal] = useState(total);
  const [siguientePagina, setSiguientePagina] = useState(2);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  const hayMas = items.length < totalReal;

  async function verMas() {
    setCargando(true);
    setError(false);
    try {
      const { properties, total: nuevoTotal } = await getPropertiesPage({
        municipio,
        page: siguientePagina,
        limit: tamanoPagina,
      });
      setItems((actuales) => {
        const ids = new Set(actuales.map((p) => p.id));
        return [...actuales, ...properties.filter((p) => !ids.has(p.id))];
      });
      // Una página vacía significa que ya no hay más, aunque el total dijera otra cosa.
      setTotalReal(properties.length === 0 ? items.length : nuevoTotal);
      setSiguientePagina((p) => p + 1);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      <div className={PROPERTY_GRID_CLASSES}>
        {items.map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2" aria-live="polite">
        <p className="text-xs text-gray-500">
          Mostrando {items.length} de {totalReal} propiedades
        </p>
        {hayMas && (
          <button
            type="button"
            onClick={verMas}
            disabled={cargando}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-brand px-6 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-pale disabled:opacity-60"
          >
            {cargando && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {cargando ? 'Cargando…' : `Ver ${Math.min(tamanoPagina, totalReal - items.length)} más`}
          </button>
        )}
        {error && (
          <p className="text-xs text-danger">No pudimos cargar más propiedades. Inténtalo de nuevo.</p>
        )}
      </div>
    </div>
  );
}
