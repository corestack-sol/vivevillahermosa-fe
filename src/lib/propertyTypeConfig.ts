import type { LucideIcon } from 'lucide-react';
import { Home, Building2, Leaf, Store, Briefcase, Warehouse, DoorOpen } from 'lucide-react';
import type { PropertyType } from '@/types/property';

export interface PropertyTypeConfig {
  label: string;
  labelPlural: string;
  Icon: LucideIcon;
  from: string;
  to: string;
  accent: string;
  glow: string;
}

/**
 * Fuente única de verdad para color e ícono por tipo de propiedad.
 * Usado por PropertyCard, MapaClient y FilterPanel para que un
 * ajuste de paleta se propague en un solo lugar.
 */
// Cada valor es `var(--type-X-campo, VALOR_ORIGINAL)` — mismo patrón que
// brand/accent/gray en globals.css: en cualquier página normal la variable
// no existe, así que el fallback (el color de siempre) es lo que se usa;
// dentro de `.theme-tabasco` (hoy solo Home, ver .theme-tabasco en
// globals.css) esas 28 variables quedan redefinidas con la paleta
// "Tabasco patio", y estas mismas tarjetas (PropertyCard, MapaClient,
// FilterPanel) heredan el cambio sin tocar ni una línea de esos archivos.
export const PROPERTY_TYPE_CONFIG: Record<PropertyType, PropertyTypeConfig> = {
  casa:         { label: 'Casa',       labelPlural: 'Casas',         Icon: Home,      from: 'var(--type-casa-from, #FFFBEB)',         to: 'var(--type-casa-to, #FDE68A)',         accent: 'var(--type-casa-accent, #B45309)',         glow: 'var(--type-casa-glow, #F59E0B)' },
  departamento: { label: 'Depto',      labelPlural: 'Departamentos', Icon: Building2, from: 'var(--type-departamento-from, #EFF6FF)', to: 'var(--type-departamento-to, #93C5FD)', accent: 'var(--type-departamento-accent, #1D4ED8)', glow: 'var(--type-departamento-glow, #3B82F6)' },
  terreno:      { label: 'Terreno',    labelPlural: 'Terrenos',      Icon: Leaf,      from: 'var(--type-terreno-from, #F0FDF4)',      to: 'var(--type-terreno-to, #86EFAC)',      accent: 'var(--type-terreno-accent, #15803D)',      glow: 'var(--type-terreno-glow, #22C55E)' },
  local:        { label: 'Local',      labelPlural: 'Locales',       Icon: Store,     from: 'var(--type-local-from, #FFF7ED)',        to: 'var(--type-local-to, #FDBA74)',        accent: 'var(--type-local-accent, #C2410C)',        glow: 'var(--type-local-glow, #F97316)' },
  oficina:      { label: 'Oficina',    labelPlural: 'Oficinas',      Icon: Briefcase, from: 'var(--type-oficina-from, #F5F3FF)',      to: 'var(--type-oficina-to, #C4B5FD)',      accent: 'var(--type-oficina-accent, #6D28D9)',      glow: 'var(--type-oficina-glow, #8B5CF6)' },
  bodega:       { label: 'Bodega',     labelPlural: 'Bodegas',       Icon: Warehouse, from: 'var(--type-bodega-from, #F8FAFC)',       to: 'var(--type-bodega-to, #CBD5E1)',       accent: 'var(--type-bodega-accent, #334155)',       glow: 'var(--type-bodega-glow, #64748B)' },
  habitacion:   { label: 'Habitación', labelPlural: 'Habitaciones',  Icon: DoorOpen,  from: 'var(--type-habitacion-from, #FFF1F2)',   to: 'var(--type-habitacion-to, #FCA5A5)',   accent: 'var(--type-habitacion-accent, #BE123C)',   glow: 'var(--type-habitacion-glow, #F43F5E)' },
};

export function getPropertyTypeConfig(tipo: string): PropertyTypeConfig {
  return PROPERTY_TYPE_CONFIG[tipo as PropertyType] ?? PROPERTY_TYPE_CONFIG.casa;
}
