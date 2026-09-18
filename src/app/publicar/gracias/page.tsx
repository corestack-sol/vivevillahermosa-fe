'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle, ChevronRight, Home, Smartphone, Bell, Sparkles } from 'lucide-react';

export default function GraciasPage() {
  const [propId, setPropId] = useState<string | null>(null);

  useEffect(() => {
    function leerPropiedadPublicada() {
      try {
        const saved = sessionStorage.getItem('lastPublishedProperty');
        if (saved) {
          const parsed = JSON.parse(saved);
          setPropId(typeof parsed?.id === 'string' ? parsed.id : null);
        }
      } catch {}
    }
    leerPropiedadPublicada();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
          <CheckCircle className="text-green-600" size={40} />
        </div>

        <h1 className="text-3xl font-heading font-bold text-gray-900 mb-3">
          ¡Propiedad publicada!
        </h1>
        <p className="text-gray-500 mb-2">
          Tu anuncio ha sido recibido y estará disponible en Vive Villahermosa próximamente.
        </p>
        {propId && (
          <Link
            href={`/propiedades/${propId}`}
            className="inline-flex items-center gap-1.5 text-sm text-brand font-semibold hover:underline mb-6"
          >
            Ver mi ficha pública <ChevronRight size={14} />
          </Link>
        )}

        <div className="bg-brand-pale rounded-2xl p-5 mb-6 text-left">
          <h2 className="font-semibold text-brand-dark text-sm mb-3">¿Qué sigue?</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <Smartphone size={16} className="flex-shrink-0 text-brand" />
              Recibirás los contactos de interesados directamente por teléfono o WhatsApp
            </li>
            <li className="flex gap-2">
              <Bell size={16} className="flex-shrink-0 text-brand" />
              Ya puedes editarla, pausarla o eliminarla cuando quieras desde tu panel
            </li>
            <li className="flex gap-2">
              <Sparkles size={16} className="flex-shrink-0 text-brand" />
              Comparte tu propiedad en redes sociales para más alcance
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard/propiedades"
            className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors"
          >
            <Home size={18} /> Gestionar mi propiedad
          </Link>
          <Link
            href="/propiedades"
            className="flex-1 flex items-center justify-center gap-2 border-2 border-brand text-brand font-semibold py-3 rounded-xl hover:bg-brand-pale transition-colors"
          >
            Ver propiedades <ChevronRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
