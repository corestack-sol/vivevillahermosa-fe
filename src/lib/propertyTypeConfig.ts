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
// Cada valor referencia `var(--type-X-campo)` — definidas en globals.css
// (paleta "Tabasco patio", @theme), fuente única para que un ajuste de
// paleta se propague a PropertyCard/MapaClient/FilterPanel sin tocar este
// archivo.
export const PROPERTY_TYPE_CONFIG: Record<PropertyType, PropertyTypeConfig> = {
  casa:         { label: 'Casa',       labelPlural: 'Casas',         Icon: Home,      from: 'var(--type-casa-from)',         to: 'var(--type-casa-to)',         accent: 'var(--type-casa-accent)',         glow: 'var(--type-casa-glow)' },
  departamento: { label: 'Depto',      labelPlural: 'Departamentos', Icon: Building2, from: 'var(--type-departamento-from)', to: 'var(--type-departamento-to)', accent: 'var(--type-departamento-accent)', glow: 'var(--type-departamento-glow)' },
  terreno:      { label: 'Terreno',    labelPlural: 'Terrenos',      Icon: Leaf,      from: 'var(--type-terreno-from)',      to: 'var(--type-terreno-to)',      accent: 'var(--type-terreno-accent)',      glow: 'var(--type-terreno-glow)' },
  local:        { label: 'Local',      labelPlural: 'Locales',       Icon: Store,     from: 'var(--type-local-from)',        to: 'var(--type-local-to)',        accent: 'var(--type-local-accent)',        glow: 'var(--type-local-glow)' },
  oficina:      { label: 'Oficina',    labelPlural: 'Oficinas',      Icon: Briefcase, from: 'var(--type-oficina-from)',      to: 'var(--type-oficina-to)',      accent: 'var(--type-oficina-accent)',      glow: 'var(--type-oficina-glow)' },
  bodega:       { label: 'Bodega',     labelPlural: 'Bodegas',       Icon: Warehouse, from: 'var(--type-bodega-from)',       to: 'var(--type-bodega-to)',       accent: 'var(--type-bodega-accent)',       glow: 'var(--type-bodega-glow)' },
  habitacion:   { label: 'Habitación', labelPlural: 'Habitaciones',  Icon: DoorOpen,  from: 'var(--type-habitacion-from)',   to: 'var(--type-habitacion-to)',   accent: 'var(--type-habitacion-accent)',   glow: 'var(--type-habitacion-glow)' },
};

export function getPropertyTypeConfig(tipo: string): PropertyTypeConfig {
  return PROPERTY_TYPE_CONFIG[tipo as PropertyType] ?? PROPERTY_TYPE_CONFIG.casa;
}
