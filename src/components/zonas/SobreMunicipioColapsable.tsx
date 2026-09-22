'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Tarjeta "Sobre el municipio" con encabezado plegable SOLO en móvil: cerrada,
 * deja a la vista únicamente lo que el contenido marque como siempre visible;
 * el resto (marcado con `hidden md:block group-data-[abierto=true]:block`) se
 * muestra al abrir. En escritorio (md+) siempre está todo visible y el botón
 * no aparece. El contenido sigue en el HTML inicial, así que un buscador lo lee.
 */
export function SobreMunicipioColapsable({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <section
      aria-labelledby="sobre-municipio"
      data-abierto={abierto}
      className="group bg-white rounded-2xl border border-gray-200 p-5 space-y-5 animate-fade-up"
      style={{ animationDelay: '60ms' }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="sobre-municipio" className="font-heading font-bold text-gray-800">{titulo}</h2>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-label={abierto ? 'Ocultar información del municipio' : 'Mostrar más información del municipio'}
          className="md:hidden -m-2 p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-brand transition-colors"
        >
          <ChevronDown
            size={20}
            aria-hidden="true"
            className={`transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {children}
    </section>
  );
}
