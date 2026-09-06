'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';
import { formatRelativeDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ConversacionResumen } from '@/lib/mensajeria';

/**
 * Bandeja única de mensajería — reemplaza el destino de la vieja
 * "mensajes recibidos" por-propiedad (dashboard/propiedades/[id]/
 * mensajes/page.tsx, que se queda como está — sigue mostrando los
 * mensajes legado de una sola vía de antes de esta migración). Una
 * cuenta puede ser interesada en unas propiedades y dueña de otras a la
 * vez — por eso una sola lista, no dos separadas.
 *
 * Backend confirmado en vivo 2026-09-06 (cuentas de prueba reales,
 * flujo completo interesado -> dueño -> respuesta) y ContactForm.tsx ya
 * migrado al endpoint nuevo (POST /propiedades/:id/mensajes) — mismo
 * día que se reporta el bug real que esto resuelve: un mensaje de un
 * interesado no quedaba registrado en ningún lado consultable.
 */
export default function MensajesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!user) return;
    backendFetch<{ conversaciones: ConversacionResumen[] }>('/mensajes/conversaciones')
      .then((d) => setConversaciones(d.conversaciones ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user, router]);

  if (authLoading || !user || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="w-48 mb-8" />
        <Skeleton variant="image" className="w-full h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-gray-400 hover:text-brand transition-colors flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Mensajes</h1>
          <p className="text-sm text-gray-500">Tus conversaciones sobre propiedades, como interesado o como dueño</p>
        </div>
      </div>

      {conversaciones.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle size={32} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Sin conversaciones todavía</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
          {conversaciones.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors ${c.noLeidos > 0 ? 'bg-brand-pale/20' : ''}`}
            >
              {/* Foto de la propiedad — link APARTE a la ficha pública, pedido
                  explícito 2026-09-06. No puede ir anidado dentro del <Link>
                  de la fila (HTML inválido, un <a> dentro de otro <a>), por
                  eso el resto de la fila es su propio <Link> hermano. */}
              <Link
                href={`/propiedades/${c.propiedad.slug}`}
                title="Ver propiedad"
                className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                {c.propiedad.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- mismo patrón que PropertyCard.tsx/PropertyGallery.tsx (fotos de Cloudinary, dominio no configurado en next.config.ts para next/image)
                  <img src={c.propiedad.foto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={18} className="text-gray-300" />
                )}
              </Link>
              <Link href={`/dashboard/mensajes/${c.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {c.noLeidos > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.otraPersona.nombre}</p>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{c.propiedad.titulo}</p>
                  {c.ultimoMensaje && (
                    <p className="text-sm text-gray-600 truncate mt-0.5">{c.ultimoMensaje.texto}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {c.ultimoMensaje && (
                    <span className="text-[11px] text-gray-400">{formatRelativeDate(c.ultimoMensaje.createdAt)}</span>
                  )}
                  {c.noLeidos > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                      {c.noLeidos > 9 ? '9+' : c.noLeidos}
                    </span>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
