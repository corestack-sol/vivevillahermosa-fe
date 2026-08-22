import type { FloodRisk } from '@/types/property';
import { Droplets, Info } from 'lucide-react';

interface FloodRiskBadgeProps {
  nivel: FloodRisk;
  compact?: boolean;
}

// Mismo criterio que src/lib/floodColors.ts: describe el registro
// histórico (Atlas de Riesgos), no una predicción de la plataforma —
// "Riesgo Alto/Medio/Bajo" sonaba a que estuviéramos pronosticando algo.
//
// `classes` usa bg-white (no bg-{color}-50) — pedido explícito 2026-08-21:
// "no me gusta el contraste... con los badges". El fondo -50 pálido de
// cada color quedaba demasiado cerca en luminosidad del bg-gray-100 del
// footer donde vive este badge en PropertyDetailView.tsx — ambos tonos
// pálidos y cálidos, se mezclaban en vez de distinguirse. bg-white da
// contraste real contra ese fondo (y contra el blanco donde también se
// usa, en PublishForm.tsx, simplemente no hace nada ahí — sigue siendo
// blanco). El color de riesgo lo siguen llevando el borde, el ícono y el
// texto, con contraste de sobra para leerse.
const config = {
  alto: {
    label: 'Históricamente inundable',
    description: 'Esta zona tiene historial de inundaciones severas según el Atlas de Riesgos Municipal.',
    classes: 'bg-white text-red-700 border-red-200',
    iconClass: 'text-red-500',
    dot: 'bg-red-500',
    compactText: 'text-red-300',
  },
  medio: {
    label: 'Inundaciones menores ocasionales',
    description: 'Zona con anegamiento ocasional en temporada de lluvias según el Atlas de Riesgos Municipal.',
    classes: 'bg-white text-amber-700 border-amber-200',
    iconClass: 'text-amber-500',
    dot: 'bg-amber-400',
    compactText: 'text-amber-300',
  },
  bajo: {
    label: 'Bajo historial de inundaciones',
    description: 'Zona con bajo historial de inundaciones según el Atlas de Riesgos Municipal.',
    classes: 'bg-white text-green-700 border-green-200',
    iconClass: 'text-green-500',
    dot: 'bg-emerald-400',
    compactText: 'text-emerald-300',
  },
};

export function FloodRiskBadge({ nivel, compact = false }: FloodRiskBadgeProps) {
  const c = config[nivel];

  if (compact) {
    // truncate — este badge vive en filas flex justify-between de ancho
    // apretado (PropertyDetailView.tsx, panel "Zona") donde el label más
    // largo ("Históricamente inundable") puede no caber, sobre todo con
    // texto de accesibilidad más grande — sin esto, el texto envolvía
    // dentro de la píldora redonda en vez de recortarse con puntos
    // suspensivos, rompiendo la forma del badge.
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm min-w-0 max-w-full truncate ${c.compactText}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
        <span className="truncate">{c.label}</span>
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`flex gap-3 p-4 rounded-xl border ${c.classes}`}>
        <Droplets className={`flex-shrink-0 mt-1 ${c.iconClass}`} size={22} />
        <div className="min-w-0">
          <p className="font-bold text-xl leading-tight">{c.label}</p>
          <p className="text-base mt-1 opacity-80">{c.description}</p>
          <p className="text-xs opacity-40 mt-2 leading-relaxed">
            Atlas de Riesgos del Municipio de Centro, 2023. Ayuntamiento de Centro. P 377
          </p>
        </div>
      </div>

      {/* bg-gray-200 (no gray-50) — este badge ahora también vive dentro
          del footer de Riesgo de inundación en PropertyDetailView.tsx
          (bg-gray-100). gray-50 es MÁS claro que ese fondo, así que la caja
          "hundida" se veía invertida ahí — más clara que su propio
          contenedor en vez de recedida. gray-200 preserva la misma
          relación "un paso más oscuro que el padre" que ya tenía sobre
          blanco, en cualquiera de los dos contextos donde se usa. */}
      <div className="flex gap-2 bg-gray-200/60 border border-gray-300 rounded-xl px-3 py-3">
        <Info size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-500 leading-relaxed space-y-1.5">
          <p>
            <span className="font-semibold">Dato informativo.</span>{' '}
            Esta clasificación se basa en registros históricos y modelos de simulación. Te recomendamos verificar directamente con el H. Ayuntamiento de Centro o IMPLAN antes de tomar una decisión.
          </p>
          <p>
            El precio de la propiedad no está condicionado por la zona de riesgo — puede estar justificado por acabados, servicios, ubicación u otras características propias del inmueble.
          </p>
        </div>
      </div>
    </div>
  );
}
