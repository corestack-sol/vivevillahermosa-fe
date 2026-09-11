import type { FloodRisk } from '@/types/property';
import { Droplets, Info } from 'lucide-react';

interface FloodRiskBadgeProps {
  nivel: FloodRisk;
  compact?: boolean;
  /**
   * 'atlas' SOLO si `riesgoInundacion` coincide exacto con lo que el
   * backend registró como detección automática al publicar/editar
   * (`riesgoInundacionDetectado`, ver docs/BACKEND-FUENTE-RIESGO-
   * INUNDACION-11092026.md). 'propietario' en CUALQUIER otro caso — y eso
   * incluye más de un escenario real, no solo "el dueño lo escribió a
   * mano": también cubre una propiedad publicada ANTES de que este campo
   * existiera (el backend no hizo backfill, decisión suya, "lectura
   * conservadora") y una colonia sin registro en el Atlas. Por eso el
   * texto de 'propietario' de abajo NO afirma que la persona lo haya
   * reportado — sería la misma "cita falsa" que este sistema entero
   * existe para evitar, solo que en la dirección contraria (aseverar
   * origen NO-Atlas cuando en realidad sí pudo venir de ahí). Hallazgo
   * real 2026-09-11: el texto anterior sí lo afirmaba en automático.
   */
  fuente?: 'atlas' | 'propietario';
}

// Mismo criterio que src/lib/floodColors.ts: describe el registro
// histórico, no una predicción de la plataforma — "Riesgo Alto/Medio/
// Bajo" sonaba a que estuviéramos pronosticando algo.
//
// Colores del badge sin tocar — pedido explícito 2026-08-21: "mantén los
// colores originales de los badges, solo te pedí cambiar el fondo de esa
// sección". Lo único que cambia por el fondo más oscuro de la sección
// (PropertyDetailView.tsx) es que ambas cajas ganan shadow-sm, más abajo —
// separación por elevación, no por color.
const config = {
  alto: {
    label: 'Históricamente inundable',
    description: 'Esta zona tiene historial de inundaciones severas.',
    classes: 'bg-red-50 text-red-700 border-red-200',
    iconClass: 'text-red-500',
    dot: 'bg-red-500',
    compactText: 'text-red-300',
  },
  medio: {
    label: 'Inundaciones menores ocasionales',
    description: 'Zona con anegamiento ocasional en temporada de lluvias.',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
    iconClass: 'text-amber-500',
    dot: 'bg-amber-400',
    compactText: 'text-amber-300',
  },
  bajo: {
    label: 'Bajo historial de inundaciones',
    description: 'Zona con bajo historial de inundaciones.',
    classes: 'bg-green-50 text-green-700 border-green-200',
    iconClass: 'text-green-500',
    dot: 'bg-emerald-400',
    compactText: 'text-emerald-300',
  },
};

export function FloodRiskBadge({ nivel, compact = false, fuente }: FloodRiskBadgeProps) {
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
      <div className={`flex gap-3 p-4 rounded-xl border shadow-sm ${c.classes}`}>
        <Droplets className={`flex-shrink-0 mt-1 ${c.iconClass}`} size={22} />
        <div className="min-w-0">
          <p className="font-bold text-xl leading-tight">{c.label}</p>
          <p className="text-base mt-1 opacity-80">{c.description}</p>
          <p className="text-xs opacity-40 mt-2 leading-relaxed">
            {fuente === 'atlas'
              ? 'Según el Atlas de Riesgos del Municipio de Centro, 2023. Ayuntamiento de Centro. P 377.'
              : fuente === 'propietario'
              ? 'No podemos confirmar este nivel contra el Atlas de Riesgos Municipal — puede que quien publicó lo haya ajustado, o que la propiedad sea de antes de que pudiéramos verificarlo.'
              : 'Este dato proviene de registros públicos de inundación y/o de lo reportado por quien publicó la propiedad.'}
          </p>
        </div>
      </div>

      <div className="flex gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 shadow-sm">
        <Info size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-500 leading-relaxed space-y-1.5">
          <p>
            <span className="font-semibold">Dato informativo.</span>{' '}
            Esta clasificación se basa en registros históricos y modelos de simulación, o en lo reportado por quien publicó. Te recomendamos verificar directamente con el H. Ayuntamiento de Centro o IMPLAN antes de tomar una decisión.
          </p>
          <p>
            El precio de la propiedad no está condicionado por la zona de riesgo — puede estar justificado por acabados, servicios, ubicación u otras características propias del inmueble.
          </p>
        </div>
      </div>
    </div>
  );
}
