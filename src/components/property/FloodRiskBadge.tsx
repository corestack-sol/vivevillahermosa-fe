import type { FloodRisk } from '@/types/property';
import { Droplets, Info } from 'lucide-react';
import { explicarFuenteRiesgo } from '@/lib/fuenteRiesgo';

interface FloodRiskBadgeProps {
  nivel: FloodRisk;
  compact?: boolean;
  /**
   * 'atlas' SOLO si `riesgoInundacion` coincide exacto con lo que el
   * backend registró como detección automática al publicar/editar
   * (`riesgoInundacionDetectado`, ver docs/BACKEND-FUENTE-RIESGO-
   * INUNDACION-11092026.md). 'propietario' en CUALQUIER otro caso —
   * técnicamente incluye más de un escenario (ajuste manual real,
   * propiedad de antes de que este campo existiera sin backfill, colonia
   * sin registro en el Atlas), pero pedido explícito 2026-09-11: el texto
   * de abajo se simplifica a "quien publicó lo ajustó" sin enumerar los
   * demás casos — se acepta la imprecisión de los casos legado a cambio
   * de un mensaje corto y directo.
   */
  fuente?: 'atlas' | 'propietario';
  /** Municipio de la propiedad — el Atlas de Riesgos solo cubre Centro, el texto de fuente cambia fuera de él. */
  municipio?: string;
}

// Mismo criterio que src/lib/floodColors.ts: describe el registro
// histórico, no una predicción de la plataforma — "Riesgo Alto/Medio/
// Bajo" sonaba a que estuviéramos pronosticando algo.
//
// Colores 2026-09-23 (pedido: armonía con el diseño de la ficha, libertad
// total incluido el contenido): tríada terrosa con tokens propios
// (--color-flood-*, globals.css) en vez de los red/amber/green genéricos de
// Tailwind — antes el amarillo neón y el texto a opacity-40 (contraste ~1.5:1)
// desentonaban con crema/verde bosque/terracota y la línea de fuente casi no
// se leía. Las clases van completas (no armadas por partes) para que
// Tailwind las detecte.
const config = {
  alto: {
    label: 'Históricamente inundable',
    description: 'Esta zona tiene historial de inundaciones severas.',
    box: 'bg-flood-alto-bg border-flood-alto-border',
    title: 'text-flood-alto-title',
    body: 'text-flood-alto-body',
    muted: 'text-flood-alto-muted',
    chip: 'bg-flood-alto-chip',
    dot: 'bg-flood-alto-soft',
    compactText: 'text-flood-alto-soft',
  },
  medio: {
    label: 'Inundaciones menores ocasionales',
    description: 'Zona con anegamiento ocasional en temporada de lluvias.',
    box: 'bg-flood-medio-bg border-flood-medio-border',
    title: 'text-flood-medio-title',
    body: 'text-flood-medio-body',
    muted: 'text-flood-medio-muted',
    chip: 'bg-flood-medio-chip',
    dot: 'bg-flood-medio-soft',
    compactText: 'text-flood-medio-soft',
  },
  sin_dato: {
    label: 'Sin información de riesgo de inundación',
    description: 'No tenemos un dato confiable de inundación para esta zona. Eso no significa que sea segura ni que se inunde.',
    box: 'bg-gray-100 border-gray-200',
    title: 'text-gray-800',
    body: 'text-gray-700',
    muted: 'text-gray-600',
    chip: 'bg-gray-500',
    dot: 'bg-gray-300',
    compactText: 'text-gray-300',
  },
  bajo: {
    label: 'Bajo historial de inundaciones',
    description: 'Zona con bajo historial de inundaciones.',
    box: 'bg-flood-bajo-bg border-flood-bajo-border',
    title: 'text-flood-bajo-title',
    body: 'text-flood-bajo-body',
    muted: 'text-flood-bajo-muted',
    chip: 'bg-flood-bajo-chip',
    dot: 'bg-flood-bajo-soft',
    compactText: 'text-flood-bajo-soft',
  },
};

export function FloodRiskBadge({ nivel, compact = false, fuente, municipio }: FloodRiskBadgeProps) {
  const c = config[nivel];
  const fueraDeCentro = !!municipio && municipio !== 'Centro';

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
        <span className="truncate">{nivel === 'sin_dato' ? 'Sin información' : c.label}</span>
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`flex items-start gap-3.5 p-4 rounded-xl border shadow-sm ${c.box}`}>
        <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white ${c.chip}`}>
          <Droplets size={20} />
        </span>
        <div className="min-w-0">
          <p className={`font-bold text-xl leading-tight ${c.title}`}>{c.label}</p>
          <p className={`text-base mt-1 ${c.body}`}>{c.description}</p>
          <p className={`text-xs mt-2 leading-relaxed ${c.muted}`}>
            {explicarFuenteRiesgo({ nivel, fuente, municipio })}
          </p>
        </div>
      </div>

      <div className="flex gap-2 bg-white border border-gray-200 rounded-xl px-3 py-3 shadow-sm">
        <Info size={15} className="text-accent flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 leading-relaxed space-y-1.5">
          <p>
            <span className="font-semibold text-gray-800">Dato informativo.</span>{' '}
            {nivel === 'sin_dato'
              ? 'Sin un nivel registrado no podemos orientarte sobre esta zona. Te recomendamos consultar a la autoridad municipal correspondiente y visitar la zona en temporada de lluvias antes de decidir.'
              : fueraDeCentro
              ? 'Este nivel lo indicó quien publicó la propiedad y no está verificado contra una fuente oficial. Pregunta a quien publica de dónde lo obtuvo y, si la decisión es importante, visita la zona en temporada de lluvias.'
              : 'Esta clasificación se basa en registros históricos y modelos de simulación, o en lo reportado por quien publicó. Te recomendamos verificar directamente con el H. Ayuntamiento de Centro o IMPLAN antes de tomar una decisión.'}
          </p>
          <p>
            El precio de la propiedad no está condicionado por la zona de riesgo — puede estar justificado por acabados, servicios, ubicación u otras características propias del inmueble.
          </p>
        </div>
      </div>
    </div>
  );
}
