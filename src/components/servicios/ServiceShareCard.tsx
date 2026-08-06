'use client';

import { useState } from 'react';
import { Share2, Link2, Check } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

interface Props {
  servicioId: string;
  nombre: string;
}

/**
 * El diferenciador más simple y honesto que la plataforma puede ofrecer a
 * un proveedor: una ficha profesional gratis con un link propio que puede
 * poner en su estado de WhatsApp, una tarjeta, la calcomanía de su
 * camioneta — a diferencia de un post en un grupo de Facebook que se
 * entierra en el feed en horas, esta ficha se queda buscable indefinidamente.
 * No requiere verificación, reseñas, ni ningún dato que no podamos respaldar
 * de verdad — solo el link en sí.
 *
 * La URL se arma al hacer clic (no en el render) — evita depender de
 * `window` durante el primer render, que en SSR no existe y causaba un
 * mismatch de hidratación en el href de WhatsApp si se calculaba antes.
 * Mismo patrón que el botón "copiar link" de dashboard/servicios/page.tsx.
 */
export function ServiceShareCard({ servicioId, nombre }: Props) {
  const toast = useToast();
  const [copiado, setCopiado] = useState(false);

  function construirUrl() {
    return `${window.location.origin}/servicios/${servicioId}`;
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(construirUrl());
      setCopiado(true);
      toast.success('Link copiado');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar el link');
    }
  }

  function compartirPorWhatsapp() {
    const texto = encodeURIComponent(`🔧 *${nombre}*\n${construirUrl()}`);
    window.open(`https://wa.me/?text=${texto}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex gap-2">
      <button
        type="button"
        onClick={copiarLink}
        className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-brand hover:bg-brand-pale text-gray-600 hover:text-brand text-sm font-semibold py-2.5 rounded-xl transition-all"
      >
        {copiado ? <Check size={15} /> : <Link2 size={15} />}
        {copiado ? 'Copiado' : 'Copiar link'}
      </button>
      <button
        type="button"
        onClick={compartirPorWhatsapp}
        className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 text-gray-600 hover:text-green-600 text-sm font-semibold py-2.5 rounded-xl transition-all"
      >
        <Share2 size={15} /> Compartir
      </button>
    </div>
  );
}
