import type { AlertaFraude } from '@/types/property';
import { ShieldAlert } from 'lucide-react';

interface FraudAlertBadgeProps {
  alerta: AlertaFraude;
  compact?: boolean;
}

/**
 * Tono deliberadamente neutral — "en revisión", no "fraudulenta" ni
 * "sospechosa". El análisis (src/lib/ai.ts) puede equivocarse (ej. un precio
 * genuinamente bueno), así que esto es una invitación a verificar con
 * cuidado, no una acusación pública contra quien publicó.
 */
export function FraudAlertBadge({ alerta, compact = false }: FraudAlertBadgeProps) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-amber-300">
        <ShieldAlert size={11} />
        En revisión
      </span>
    );
  }

  return (
    <div className="flex gap-3 p-4 rounded-xl border bg-amber-50 text-amber-700 border-amber-200">
      <ShieldAlert className="flex-shrink-0 mt-1 text-amber-500" size={22} />
      <div className="min-w-0">
        <p className="font-bold text-base leading-tight">Anuncio en revisión</p>
        <p className="text-sm mt-1 opacity-80">
          Este anuncio tiene características que nuestro sistema marca para revisión adicional. No significa que sea fraudulento — te recomendamos verificar la propiedad con cuidado antes de dar cualquier anticipo o depósito.
        </p>
        <ul className="text-xs mt-2 opacity-70 list-disc list-inside space-y-0.5">
          {alerta.señales.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </div>
    </div>
  );
}
