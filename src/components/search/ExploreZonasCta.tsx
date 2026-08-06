import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * Mismo bloque que el CTA final de /zonas — reutilizado en cualquier lugar
 * donde una búsqueda se queda sin resultados, para no dejar a quien busca
 * en un callejón sin salida.
 */
export function ExploreZonasCta() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-pale p-8 text-center">
      <p className="font-heading font-bold text-brand-dark text-lg mb-2">
        ¿No ves tu colonia o municipio?
      </p>
      <p className="text-gray-600 text-sm mb-5 max-w-md mx-auto">
        Explora el mapa y busca exactamente donde necesitas. Cubrimos todo el estado.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/mapa"
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          Ver mapa <ArrowRight size={15} />
        </Link>
        <Link
          href="/propiedades"
          className="flex items-center gap-2 border-2 border-brand text-brand font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-white transition-colors"
        >
          Ver todas las propiedades
        </Link>
      </div>
    </div>
  );
}
