'use client';

import { X } from 'lucide-react';
import type { SearchFilters } from '@/types/search';
import { getLandmark, CATEGORIAS_GENERICAS } from '@/lib/landmarks';
import { matchColonia } from '@/lib/colonias';
import { getZonaDestacada, ZONA_DESTACADA_CUALQUIERA } from '@/lib/zonasDestacadas';

interface ActiveFiltersProps {
  filters: SearchFilters;
  onUpdate: (updates: Partial<SearchFilters>) => void;
  onClear: () => void;
}

type FilterChip = { label: string; onRemove: () => void };

function formatPeso(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export function ActiveFilters({ filters, onUpdate, onClear }: ActiveFiltersProps) {
  const chips: FilterChip[] = [];

  if (filters.q)                chips.push({ label: `"${filters.q}"`,                    onRemove: () => onUpdate({ q: '' }) });
  if (filters.tipo)             chips.push({ label: filters.tipo,                         onRemove: () => onUpdate({ tipo: '' }) });
  if (filters.operacion)        chips.push({ label: filters.operacion,                    onRemove: () => onUpdate({ operacion: '' }) });
  if (filters.municipio)        chips.push({ label: filters.municipio,                    onRemove: () => onUpdate({ municipio: '' }) });
  if (filters.precioMin && filters.precioMin > 0)
                                chips.push({ label: `Desde ${formatPeso(filters.precioMin)}`, onRemove: () => onUpdate({ precioMin: 0 }) });
  if (filters.precioMax && filters.precioMax > 0)
                                chips.push({ label: `Hasta ${formatPeso(filters.precioMax)}`, onRemove: () => onUpdate({ precioMax: 0 }) });
  if (filters.recamaras)        chips.push({ label: `${filters.recamaras}+ rec.`,         onRemove: () => onUpdate({ recamaras: 0 }) });
  if (filters.recamarasMax)     chips.push({ label: `Máx. ${filters.recamarasMax} rec.`,  onRemove: () => onUpdate({ recamarasMax: 0 }) });
  if (filters.banos)            chips.push({ label: `${filters.banos}+ baños`,            onRemove: () => onUpdate({ banos: 0 }) });
  if (filters.m2Min)            chips.push({ label: `Desde ${filters.m2Min}m²`,           onRemove: () => onUpdate({ m2Min: 0 }) });
  if (filters.m2Max)            chips.push({ label: `Hasta ${filters.m2Max}m²`,           onRemove: () => onUpdate({ m2Max: 0 }) });
  if (filters.amenidad)         chips.push({ label: filters.amenidad,                     onRemove: () => onUpdate({ amenidad: '' }) });
  if (filters.riesgoInundacion) chips.push({ label: `Riesgo ${filters.riesgoInundacion}`, onRemove: () => onUpdate({ riesgoInundacion: '' }) });
  if (filters.cercaDosoBocas)   chips.push({ label: 'Dos Bocas',                         onRemove: () => onUpdate({ cercaDosoBocas: false }) });
  if (filters.landmark) {
    const landmark = getLandmark(filters.landmark);
    if (landmark) chips.push({ label: `Cerca de ${landmark.label}`, onRemove: () => onUpdate({ landmark: '' }) });
  } else if (filters.categoriaLandmark) {
    const cat = CATEGORIAS_GENERICAS.find((c) => c.value === filters.categoriaLandmark);
    if (cat) chips.push({ label: `Cerca de ${cat.label}`, onRemove: () => onUpdate({ categoriaLandmark: '' }) });
  } else if (filters.colonia) {
    const coord = matchColonia(filters.colonia);
    chips.push({ label: coord ? `Cerca de ${coord.label}` : filters.colonia, onRemove: () => onUpdate({ colonia: '' }) });
  }
  if (filters.zonaDestacada) {
    const label = filters.zonaDestacada === ZONA_DESTACADA_CUALQUIERA
      ? 'Zona de alta plusvalía'
      : getZonaDestacada(filters.zonaDestacada)?.label;
    if (label) chips.push({ label, onRemove: () => onUpdate({ zonaDestacada: '' }) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      {chips.map((chip) => (
        <button
          key={chip.label}
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 bg-brand-pale text-brand text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          {chip.label}
          <X size={11} />
        </button>
      ))}
      <button
        onClick={onClear}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
      >
        Limpiar todo
      </button>
    </div>
  );
}
