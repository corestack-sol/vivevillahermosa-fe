'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Phone, Mail, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';
import { formatRelativeDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';
import type { MensajeLegado } from '@/lib/mensajeria';
import { marcarLegadoLeido } from '@/lib/mensajesLegadoLeidos';

interface PropiedadPublica {
  titulo: string;
  slug: string;
  fotos: string[];
}

/**
 * Vista de un mensaje del sistema VIEJO de contacto (contacto_propiedad,
 * de una sola vía, antes de la mensajería bidireccional) — pedido
 * explícito 2026-09-06: que se vea con el mismo lenguaje visual que el
 * chat nuevo (mini-ficha de la propiedad arriba, burbuja de mensaje),
 * dentro de la misma bandeja unificada (dashboard/mensajes/page.tsx).
 *
 * A diferencia del chat nuevo, esto NO es una conversación real — el
 * backend nunca guardó qué cuenta mandó estos mensajes (solo nombre/
 * teléfono/correo como texto libre), así que no hay a quién mandarle una
 * respuesta desde la app. En su lugar se ofrece contacto directo
 * (tel:/mailto:), igual que ya hacía la pantalla vieja por-propiedad
 * (dashboard/propiedades/[id]/mensajes/page.tsx).
 */
export default function ConversacionLegadoPage() {
  const { propiedadId, mensajeId } = useParams<{ propiedadId: string; mensajeId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [propiedad, setPropiedad] = useState<PropiedadPublica | null>(null);
  const [mensaje, setMensaje] = useState<MensajeLegado | null>(null);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!user) return;
    let cancelado = false;
    Promise.all([
      backendFetch<PropiedadPublica>(`/propiedades/${propiedadId}`),
      backendFetch<{ mensajes: MensajeLegado[] }>(`/propiedades/${propiedadId}/mensajes`),
    ])
      .then(([p, m]) => {
        if (cancelado) return;
        const encontrado = (m.mensajes ?? []).find((x) => x.id === mensajeId);
        if (!encontrado) { setNoEncontrado(true); return; }
        setPropiedad(p);
        setMensaje(encontrado);
        // Por si se llega aquí directo (link guardado, notificación) sin
        // pasar por el clic de la tarjeta en la bandeja — ver
        // mensajesLegadoLeidos.ts, el backend no tiene endpoint para esto.
        marcarLegadoLeido(mensajeId, user?.userId ?? null);
      })
      .catch(() => { if (!cancelado) setNoEncontrado(true); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [authLoading, user, router, propiedadId, mensajeId]);

  if (authLoading || !user || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="w-48 mb-8" />
        <Skeleton variant="image" className="w-full h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col" style={{ height: 'calc(100dvh - 4rem)' }}>
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <Link href="/dashboard/mensajes" className="text-gray-400 hover:text-brand transition-colors flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-heading font-bold text-gray-900">Conversación</h1>
      </div>

      {noEncontrado || !propiedad || !mensaje ? (
        <div className="text-center py-16">
          <p className="text-sm text-gray-400">No se pudo cargar este mensaje.</p>
        </div>
      ) : (
        <>
          <Link
            href={`/propiedades/${propiedad.slug}`}
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-4 flex-shrink-0 hover:border-brand/30 hover:shadow-sm transition-all"
          >
            <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
              {propiedad.fotos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element -- mismo patrón que dashboard/mensajes/page.tsx
                <img src={propiedad.fotos[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={18} className="text-gray-300" />
              )}
            </div>
            <p className="text-sm font-semibold text-gray-800 truncate min-w-0">{propiedad.titulo}</p>
          </Link>

          <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <div className="flex justify-start">
              <div className="max-w-[75%] rounded-2xl px-3.5 py-2 bg-gray-100 text-gray-800 rounded-bl-sm">
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{mensaje.mensaje}</p>
                <p className="text-[10px] mt-1 text-gray-400">{formatRelativeDate(mensaje.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              Este mensaje es de antes del chat directo en la plataforma — no se puede responder desde aquí, pero puedes contactar a {mensaje.nombre} directo:
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 flex-shrink-0 flex-wrap">
            <a href={`tel:${mensaje.telefono}`} className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
              <Phone size={14} /> {mensaje.telefono}
            </a>
            {mensaje.email && (
              <a href={`mailto:${mensaje.email}`} className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                <Mail size={14} /> {mensaje.email}
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
