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
export const PROPERTY_TYPE_CONFIG: Record<PropertyType, PropertyTypeConfig> = {
  casa:         { label: 'Casa',       labelPlural: 'Casas',         Icon: Home,      from: '#FFFBEB', to: '#FDE68A', accent: '#B45309', glow: '#F59E0B' },
  departamento: { label: 'Depto',      labelPlural: 'Departamentos', Icon: Building2, from: '#EFF6FF', to: '#93C5FD', accent: '#1D4ED8', glow: '#3B82F6' },
  terreno:      { label: 'Terreno',    labelPlural: 'Terrenos',      Icon: Leaf,      from: '#F0FDF4', to: '#86EFAC', accent: '#15803D', glow: '#22C55E' },
  local:        { label: 'Local',      labelPlural: 'Locales',       Icon: Store,     from: '#FFF7ED', to: '#FDBA74', accent: '#C2410C', glow: '#F97316' },
  oficina:      { label: 'Oficina',    labelPlural: 'Oficinas',      Icon: Briefcase, from: '#F5F3FF', to: '#C4B5FD', accent: '#6D28D9', glow: '#8B5CF6' },
  bodega:       { label: 'Bodega',     labelPlural: 'Bodegas',       Icon: Warehouse, from: '#F8FAFC', to: '#CBD5E1', accent: '#334155', glow: '#64748B' },
  habitacion:   { label: 'Habitación', labelPlural: 'Habitaciones',  Icon: DoorOpen,  from: '#FFF1F2', to: '#FCA5A5', accent: '#BE123C', glow: '#F43F5E' },
};

export function getPropertyTypeConfig(tipo: string): PropertyTypeConfig {
  return PROPERTY_TYPE_CONFIG[tipo as PropertyType] ?? PROPERTY_TYPE_CONFIG.casa;
}
