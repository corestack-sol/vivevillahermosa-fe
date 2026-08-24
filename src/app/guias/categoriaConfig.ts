import { Compass, Scale, Lightbulb, TrendingUp, type LucideIcon } from 'lucide-react';

export interface CategoriaVisual {
  Icon: LucideIcon;
  from: string;
  to: string;
  accent: string;
}

// Reemplaza el emoji suelto que hacía de "thumbnail" (🌊, 🏗️...) — se veía
// a medio hacer al lado de fotos reales de propiedad en el resto del
// sitio. Reusa la misma familia de gradientes por tipo que ya usan
// PropertyCard/MapaClient/FilterPanel (--type-X en globals.css, paleta
// "Tabasco patio") en vez de inventar un cuarto sistema de color — la
// categoría de blog toma prestado un triple from/to/accent existente en
// vez de sumar hex nuevos. Pedido explícito 2026-08-19.
export const CATEGORIA_CONFIG: Record<string, CategoriaVisual> = {
  Guía:        { Icon: Compass,    from: 'var(--type-departamento-from)', to: 'var(--type-departamento-to)', accent: 'var(--type-departamento-accent)' },
  Comparativa: { Icon: Scale,      from: 'var(--type-habitacion-from)',   to: 'var(--type-habitacion-to)',   accent: 'var(--type-habitacion-accent)' },
  Consejos:    { Icon: Lightbulb,  from: 'var(--type-terreno-from)',      to: 'var(--type-terreno-to)',      accent: 'var(--type-terreno-accent)' },
  Mercado:     { Icon: TrendingUp, from: 'var(--type-casa-from)',         to: 'var(--type-casa-to)',         accent: 'var(--type-casa-accent)' },
};

const FALLBACK: CategoriaVisual = { Icon: Compass, from: 'var(--color-gray-100)', to: 'var(--color-gray-200)', accent: 'var(--color-gray-600)' };

export function getCategoriaVisual(categoria: string): CategoriaVisual {
  return CATEGORIA_CONFIG[categoria] ?? FALLBACK;
}
