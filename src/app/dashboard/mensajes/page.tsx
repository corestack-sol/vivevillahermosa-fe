'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';
import { formatRelativeDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';
import { combinarBandejaMensajes, type ConversacionResumen, type MensajeLegado, type ItemBandejaMensajes } from '@/lib/mensajeria';

interface PropiedadMia {
  id: string;
  titulo: string;
  slug: string;
  fotos: string[];
}

/**
 * Bandeja única de mensajería — pedido explícito 2026-09-06: unificar en
 * una sola lista el chat nuevo (Conversacion/Mensaje, bidireccional) y el
 * sistema viejo de contacto de una sola vía (contacto_propiedad), que
 * antes vivía separado en dashboard/propiedades/[id]/mensajes/page.tsx
 * (esa ruta se queda como está, ahora es redundante pero no rompe nada).
 * Una cuenta puede ser interesada en unas propiedades y dueña de otras a
 * la vez — por eso una sola lista, no dos separadas.
 *
 * `GET /propiedades/:id/mensajes` (legado) es por-propiedad, no existe un
 * "todos mis mensajes viejos" — por eso primero se piden las propiedades
 * propias (`/propiedades/mias`) y luego se junta el legado de cada una en
 * paralelo. Solo dueños de al menos una propiedad pagan ese costo extra;
 * alguien que solo es interesado nunca tiene propiedades propias, así que
 * esa lista sale vacía y no se hace ningún fetch de más.
 */
export default function MensajesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ItemBandejaMensajes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!user) return;
    let cancelado = false;

    Promise.all([
      backendFetch<{ conversaciones: ConversacionResumen[] }>('/mensajes/conversaciones').catch(() => ({ conversaciones: [] })),
      backendFetch<{ propiedades: PropiedadMia[] }>('/propiedades/mias').catch(() => ({ propiedades: [] })),
    ]).then(async ([convData, propData]) => {
      if (cancelado) return;
      const propiedades = propData.propiedades ?? [];
      const legadosPorPropiedad = await Promise.all(
        propiedades.map((p) =>
          backendFetch<{ mensajes: MensajeLegado[] }>(`/propiedades/${p.id}/mensajes`)
            .then((d) => (d.mensajes ?? []).map((mensaje) => ({
              propiedad: { id: p.id, titulo: p.titulo, slug: p.slug, foto: p.fotos[0] ?? null },
              mensaje,
            })))
            .catch(() => []),
        ),
      );
      if (cancelado) return;
      setItems(combinarBandejaMensajes(convData.conversaciones ?? [], legadosPorPropiedad.flat()));
    }).finally(() => {
      if (!cancelado) setLoading(false);
    });

    return () => { cancelado = true; };
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

      {items.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle size={32} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Sin conversaciones todavía</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
          {items.map((it) => {
            const hrefChat = it.tipo === 'conversacion'
              ? `/dashboard/mensajes/${it.id}`
              : `/dashboard/mensajes/legado/${it.propiedadId}/${it.mensajeId}`;
            return (
              <div
                key={it.id}
                className={`flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors ${it.noLeidos > 0 ? 'bg-brand-pale/20' : ''}`}
              >
                {/* Foto de la propiedad — link APARTE a la ficha pública, pedido
                    explícito 2026-09-06. No puede ir anidado dentro del <Link>
                    de la fila (HTML inválido, un <a> dentro de otro <a>), por
                    eso el resto de la fila es su propio <Link> hermano. */}
                <Link
                  href={`/propiedades/${it.propiedad.slug}`}
                  title="Ver propiedad"
                  className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  {it.propiedad.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- mismo patrón que PropertyCard.tsx/PropertyGallery.tsx (fotos de Cloudinary, dominio no configurado en next.config.ts para next/image)
                    <img src={it.propiedad.foto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 size={18} className="text-gray-300" />
                  )}
                </Link>
                <Link href={hrefChat} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {it.noLeidos > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                      <p className="text-sm font-semibold text-gray-800 truncate">{it.otraPersonaNombre}</p>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{it.propiedad.titulo}</p>
                    {it.ultimoTexto && (
                      <p className="text-sm text-gray-600 truncate mt-0.5">{it.ultimoTexto}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {it.fecha && (
                      <span className="text-[11px] text-gray-400">{formatRelativeDate(it.fecha)}</span>
                    )}
                    {it.noLeidos > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                        {it.noLeidos > 9 ? '9+' : it.noLeidos}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
