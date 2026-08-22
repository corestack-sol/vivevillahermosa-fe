import {
  Waves, Trees, ShieldCheck, CarFront, Sun, PanelsTopLeft,
  Dumbbell, ArrowUpDown, Warehouse, BedDouble, Flame, Droplet,
  DoorClosed, Fan,
  type LucideIcon,
} from 'lucide-react';

export interface AmenidadConfig {
  key: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * Características FÍSICAS de la propiedad — distinto de SERVICIOS_RENTA
 * (servicios.ts), que son "incluido en la renta" (wifi, agua caliente,
 * gas). Bug real encontrado 2026-08-21: `amenidades` existe en el tipo
 * `Property` y ya se muestra en la ficha (PropertyDetailView.tsx), pero
 * PublishForm.tsx nunca tuvo un selector — mandaba `amenidades: []` fijo,
 * así que ninguna propiedad publicada desde el formulario podía tener
 * ninguna. Este catálogo es nuevo, alineado con los 3 valores ya vistos
 * en datos reales del backend (Alberca, Jardín, Seguridad 24h).
 */
export const AMENIDADES_OPTIONS: AmenidadConfig[] = [
  { key: 'alberca',       label: 'Alberca',              Icon: Waves        },
  { key: 'jardin',        label: 'Jardín',                Icon: Trees        },
  { key: 'seguridad_24h', label: 'Seguridad 24h',         Icon: ShieldCheck  },
  { key: 'estacionamiento_techado', label: 'Estacionamiento techado', Icon: CarFront },
  { key: 'terraza',       label: 'Terraza',                Icon: Sun          },
  { key: 'balcon',        label: 'Balcón',                 Icon: PanelsTopLeft },
  { key: 'gimnasio',      label: 'Gimnasio',               Icon: Dumbbell     },
  { key: 'elevador',      label: 'Elevador',               Icon: ArrowUpDown  },
  { key: 'bodega',        label: 'Bodega',                 Icon: Warehouse    },
  { key: 'cuarto_servicio', label: 'Cuarto de servicio',   Icon: BedDouble    },
  { key: 'asadores',      label: 'Área de asadores',       Icon: Flame        },
  { key: 'jacuzzi',       label: 'Jacuzzi',                Icon: Droplet      },
  { key: 'closets',       label: 'Clósets amplios',        Icon: DoorClosed   },
  { key: 'aire_central',  label: 'Aire acondicionado',     Icon: Fan          },
];

// Por LABEL, no por key — Property.amenidades ya guarda strings legibles
// en datos reales del backend ("Alberca", "Jardín", "Seguridad 24h"), a
// diferencia de SERVICIOS_RENTA que sí usa keys cortas. `key` aquí es solo
// para el `key` de React y el ícono, nunca se manda al backend.
export const AMENIDADES_MAP = new Map(AMENIDADES_OPTIONS.map((a) => [a.label, a]));
