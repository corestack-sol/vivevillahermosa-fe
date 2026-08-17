import type { Metadata } from 'next';
import { Scale } from 'lucide-react';
import { TERMS_SECTIONS } from '@/lib/termsSections';

export const metadata: Metadata = {
  title: 'Términos y condiciones | Vive Villahermosa',
  description: 'Términos y condiciones de uso de Vive Villahermosa: naturaleza del servicio, responsabilidad del usuario, y las reglas de la plataforma.',
};

// Página independiente y enlazable del mismo contenido que ya vivía solo en
// TermsModal.tsx (usado al publicar) — antes no se podía compartir un link
// directo a los términos completos. Ver docs/PLAN-AUDITORIA-FASE1-MVP.md
// hallazgo #10. El modal sigue existiendo (mismo contenido, TERMS_SECTIONS
// compartido) para el flujo de publicar.
export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-2 mb-2">
        <Scale size={22} className="text-brand" />
        <h1 className="text-3xl font-heading font-bold text-gray-900">Términos y condiciones</h1>
      </div>
      <p className="text-sm text-gray-400 mb-10">Vigente desde julio de 2026</p>

      <div className="prose prose-sm max-w-none text-gray-700 space-y-8">
        {TERMS_SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-heading font-bold text-gray-900 mb-2">{s.title}</h2>
            <p className="leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
