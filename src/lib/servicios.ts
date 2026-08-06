import {
  Wind, Wifi, Thermometer, Car, Leaf, Shirt, Sofa, Utensils,
  Shield, Waves, PawPrint, Sun, ArrowUpDown, Dumbbell,
  Flame, Zap, Droplets, Lock,
  type LucideIcon,
} from 'lucide-react';

export interface ServicioConfig {
  key: string;
  label: string;
  Icon: LucideIcon;
}

export const SERVICIOS_RENTA: ServicioConfig[] = [
  { key: 'ac',         label: 'Aire acondicionado',    Icon: Wind         },
  { key: 'wifi',       label: 'WiFi incluido',          Icon: Wifi         },
  { key: 'agua_cal',   label: 'Agua caliente',          Icon: Thermometer  },
  { key: 'parking',    label: 'Estacionamiento',        Icon: Car          },
  { key: 'patio',      label: 'Patio / Jardín',         Icon: Leaf         },
  { key: 'lavanderia', label: 'Área de lavado',         Icon: Shirt        },
  { key: 'amueblado',  label: 'Amueblado',              Icon: Sofa         },
  { key: 'cocina',     label: 'Cocina equipada',        Icon: Utensils     },
  { key: 'seguridad',  label: 'Seguridad / Vigilancia', Icon: Shield       },
  { key: 'alberca',    label: 'Alberca',                Icon: Waves        },
  { key: 'mascotas',   label: 'Mascotas permitidas',    Icon: PawPrint     },
  { key: 'terraza',    label: 'Balcón / Terraza',       Icon: Sun          },
  { key: 'elevador',   label: 'Elevador',               Icon: ArrowUpDown  },
  { key: 'gym',        label: 'Gimnasio',               Icon: Dumbbell     },
  { key: 'gas',        label: 'Gas incluido',           Icon: Flame        },
  { key: 'luz',        label: 'Luz incluida',           Icon: Zap          },
  { key: 'agua',       label: 'Agua incluida',          Icon: Droplets     },
  { key: 'porton',     label: 'Portón automático',      Icon: Lock         },
];

export const SERVICIOS_MAP = new Map(SERVICIOS_RENTA.map((s) => [s.key, s]));
