'use client';

import type { SortOption } from '@/types/search';

interface SortSelectProps {
  value: SortOption;
  onChange: (sort: SortOption) => void;
}

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevancia', label: 'Relevancia' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
  { value: 'reciente', label: 'Más recientes' },
  { value: 'colonia-asc', label: 'Colonia: A-Z' },
  { value: 'm2-desc', label: 'Tamaño: mayor a menor' },
  { value: 'm2-asc', label: 'Tamaño: menor a mayor' },
];

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="text-base sm:text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-700 bg-white focus:outline-none focus:border-brand"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
