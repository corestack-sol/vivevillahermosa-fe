import React from 'react';
import type { Property } from '@/types/property';
import { BedDouble, Bath, Car, Maximize, Building2, Calendar } from 'lucide-react';

interface PropertySpecsProps {
  property: Property;
  compact?: boolean;
}

export function PropertySpecs({ property, compact = false }: PropertySpecsProps) {
  const specs = [
    property.operacion === 'venta' && property.m2Construidos > 0 && {
      icon: <Maximize size={compact ? 14 : 16} />,
      label: `${property.m2Construidos} m²`,
      title: 'Construidos',
    },
    property.recamaras > 0 && {
      icon: <BedDouble size={compact ? 14 : 16} />,
      label: `${property.recamaras} rec.`,
      title: 'Recámaras',
    },
    (property.banos > 0 || property.mediosBanos > 0) && {
      icon: <Bath size={compact ? 14 : 16} />,
      label: `${property.banos + property.mediosBanos} baños`,
      title: 'Baños',
    },
    property.estacionamientos > 0 && {
      icon: <Car size={compact ? 14 : 16} />,
      label: `${property.estacionamientos} auto${property.estacionamientos > 1 ? 's' : ''}`,
      title: 'Estacionamientos',
    },
    !compact && property.operacion === 'venta' && property.m2Terreno > 0 && {
      icon: <Building2 size={16} />,
      label: `${property.m2Terreno} m² terreno`,
      title: 'Terreno',
    },
    !compact && property.operacion === 'venta' && property.antiguedad > 0 && {
      icon: <Calendar size={16} />,
      label: `${property.antiguedad} año${property.antiguedad !== 1 ? 's' : ''}`,
      title: 'Antigüedad',
    },
  ].filter(Boolean) as { icon: React.ReactElement; label: string; title: string }[];

  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {specs.map((spec) => (
          <span key={spec.title} className="flex items-center gap-1 text-xs text-gray-500">
            <span className="text-gray-400">{spec.icon}</span>
            {spec.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {specs.map((spec) => (
        <div
          key={spec.title}
          className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl"
        >
          <span className="text-brand">{spec.icon}</span>
          <div>
            <p className="text-xs text-gray-400">{spec.title}</p>
            <p className="text-base font-semibold text-gray-800">{spec.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
