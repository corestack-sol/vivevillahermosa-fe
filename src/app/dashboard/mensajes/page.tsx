'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MessageCircle, Building2, ArrowDownLeft, ArrowUpRight, Trash2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { formatRelativeDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { combinarBandejaMensajes, type ConversacionResumen, type MensajeLegado, type ItemBandejaMensajes } from '@/lib/mensajeria';
import { estaLegadoLeido, marcarLegadoLeido } from '@/lib/mensajesLegadoLeidos';

interface PropiedadMia {
  id: string;
  titulo: string;
  slug: string;
  fotos: string[];
}

/**
 * Bandeja única de mensajería — pedido explícito 2026-09-06: unificar en
 * una sola lista el chat nuevo (Conversacion/Mensaje, bidireccional) y el
 * sistema viejo de contacto de una sola vía (contacto_propiedad). La
 * página vieja por-propiedad (dashboard/propiedades/[id]/mensajes) se
 * eliminó 2026-09-07 — quedó totalmente redundante contra esta, con peor
 * experiencia (sin chat, sin agrupar por interesado). Una cuenta puede
 * ser interesada en unas propiedades y dueña de otras a la vez — por eso
 * una sola lista, no dos separadas.
 *
 * `?propiedad={id}` (pedido explícito 2026-09-07) filtra la misma lista a
 * una sola propiedad — es a donde enlaza el ícono de mensajes de cada
 * card en /dashboard/propiedades, en vez de a la página vieja ya
 * eliminada. Mismo dato, mismo fetch, solo recortado en el render.
 *
 * `GET /propiedades/:id/mensajes` (legado) es por-propiedad, no existe un
 * "todos mis mensajes viejos" — por eso primero se piden las propiedades
 * propias (`/propiedades/mias`) y luego se junta el legado de cada una en
 * paralelo. Solo dueños de al menos una propiedad pagan ese costo extra;
 * alguien que solo es interesado nunca tiene propiedades propias, así que
 * esa lista sale vacía y no se hace ningún fetch de más.
 */
export default function MensajesPage() {
  return (
    <Suspense fallback={null}>
      <MensajesContent />
    </Suspense>
  );
}

function MensajesContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  // Filtro por propiedad — pedido explícito 2026-09-07: el ícono de
  // mensajes de cada card en /dashboard/propiedades enlaza aquí con
  // ?propiedad={id} en vez de a la página vieja por-propiedad (ya
  // eliminada). Mismo dato de siempre, solo recortado a una propiedad.
  const propiedadFiltro = searchParams.get('propiedad');
  const [items, setItems] = useState<ItemBandejaMensajes[]>([]);
  const [loading, setLoading] = useState(true);
  // Eliminar chat completo — pedido explícito 2026-09-07. Backend nuevo,
  // no existe todavía (confirmado en vivo: DELETE /conversaciones/:id y
  // DELETE /propiedades/:id/mensajes/:mensajeId, ambos 404) — ver
  // docs/BACKEND-ELIMINAR-CONVERSACION-07092026.md. "Eliminar" borra solo
  // de TU bandeja (semántica documentada), no destruye el historial de la
  // otra persona.
  const [itemAEliminar, setItemAEliminar] = useState<ItemBandejaMensajes | null>(null);
  const [eliminando, setEliminando] = useState(false);
  // Paginado — pedido explícito 2026-09-07. El backend no pagina
  // `/mensajes/conversaciones` (trae todo de una), así que se pagina acá
  // en memoria sobre la lista ya combinada — no hay fetch de más por
  // cambiar de página.
  const POR_PAGINA = 15;
  const [pagina, setPagina] = useState(1);

  async function confirmarEliminar() {
    if (!itemAEliminar) return;
    setEliminando(true);
    try {
      if (itemAEliminar.tipo === 'conversacion') {
        await backendFetch(`/conversaciones/${itemAEliminar.id}`, { method: 'DELETE' });
      } else {
        await backendFetch(`/propiedades/${itemAEliminar.propiedadId}/mensajes/${itemAEliminar.mensajeId}`, { method: 'DELETE' });
      }
      setItems((prev) => prev.filter((x) => x.id !== itemAEliminar.id));
      toast.success('Chat eliminado.');
    } catch (err) {
      toast.error(err instanceof BackendApiError ? err.message : 'No se pudo eliminar el chat.');
    } finally {
      setEliminando(false);
      setItemAEliminar(null);
    }
  }

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
              // El backend nunca expuso un endpoint para marcar un mensaje
              // legado como leído (confirmado en vivo 2026-09-06) — se
              // completa con lo que este navegador recuerda haber abierto
              // (ver marcarLegadoLeido en mensajesLegadoLeidos.ts).
              mensaje: { ...mensaje, leido: mensaje.leido || estaLegadoLeido(mensaje.id) },
            })))
            .catch(() => []),
        ),
      );
      if (cancelado) return;
      // soyDueno — pedido explícito 2026-09-07: diferenciar "me
      // contactaron en una propiedad mía" de "yo contacté a alguien más".
      const misPropiedadIds = new Set(propiedades.map((p) => p.id));
      setItems(combinarBandejaMensajes(convData.conversaciones ?? [], legadosPorPropiedad.flat(), misPropiedadIds));
    }).finally(() => {
      if (!cancelado) setLoading(false);
    });

    return () => { cancelado = true; };
  }, [authLoading, user, router]);

  useEffect(() => {
    function reiniciarPagina() {
      setPagina(1);
    }
    reiniciarPagina();
  }, [propiedadFiltro]);

  if (authLoading || !user || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="w-48 mb-8" />
        <Skeleton variant="image" className="w-full h-96 rounded-2xl" />
      </div>
    );
  }

  const itemsFiltrados = propiedadFiltro ? items.filter((it) => it.propiedad.id === propiedadFiltro) : items;
  const propiedadFiltroTitulo = propiedadFiltro
    ? items.find((it) => it.propiedad.id === propiedadFiltro)?.propiedad.titulo
    : undefined;
  const totalPaginas = Math.max(1, Math.ceil(itemsFiltrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const itemsPagina = itemsFiltrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

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

      {propiedadFiltro && (
        <div className="flex items-center justify-between gap-3 bg-brand-pale border border-brand/20 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-xs text-brand-dark truncate">
            Solo mensajes de <strong>{propiedadFiltroTitulo ?? 'esta propiedad'}</strong>
          </p>
          <Link href="/dashboard/mensajes" className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark flex-shrink-0">
            <X size={12} /> Ver todos
          </Link>
        </div>
      )}

      {itemsFiltrados.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle size={32} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">{propiedadFiltro ? 'Sin mensajes para esta propiedad todavía' : 'Sin conversaciones todavía'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
          {itemsPagina.map((it) => {
            const hrefChat = it.tipo === 'conversacion'
              ? `/dashboard/mensajes/${it.id}`
              : `/dashboard/mensajes/legado/${it.propiedadId}/${it.mensajeId}`;
            // Marca leído al instante, sin esperar a volver a esta pantalla
            // para que se note — pedido explícito 2026-09-06. Una
            // conversación real ya se marca leída en el backend en cuanto
            // se abre el hilo (confirmado en vivo: GET /conversaciones/:id/
            // mensajes marca los mensajes, esto solo adelanta la UI); un
            // mensaje legado no tiene backend que lo recuerde, así que
            // además queda guardado en este navegador.
            function marcarLeidoAlAbrir() {
              if (it.tipo === 'legado') marcarLegadoLeido(it.mensajeId);
              setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, noLeidos: 0 } : x)));
            }
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
                <Link href={hrefChat} onClick={marcarLeidoAlAbrir} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {it.noLeidos > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                      <p className="text-sm font-semibold text-gray-800 truncate">{it.otraPersonaNombre}</p>
                      {/* Pedido explícito 2026-09-07: distinguir "me
                          contactaron en mi propiedad" de "yo contacté a
                          alguien más" — sin esto las dos se veían igual. */}
                      {it.soyDueno ? (
                        <span title="Te contactó en tu propiedad" className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          <ArrowDownLeft size={9} /> Te contactó
                        </span>
                      ) : (
                        <span title="Tú contactaste esta propiedad" className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          <ArrowUpRight size={9} /> Tú contactaste
                        </span>
                      )}
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

                {/* Eliminar chat completo — pedido explícito 2026-09-07. */}
                <button
                  type="button"
                  onClick={() => setItemAEliminar(it)}
                  aria-label="Eliminar chat"
                  className="flex-shrink-0 p-2 -m-2 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="mt-6">
          <Pagination page={paginaActual} totalPages={totalPaginas} onChange={setPagina} />
        </div>
      )}

      <Modal isOpen={!!itemAEliminar} onClose={() => setItemAEliminar(null)} title="Eliminar chat" maxWidth="sm">
        {itemAEliminar && (
          <>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              Vas a eliminar tu chat con <strong className="text-gray-800">{itemAEliminar.otraPersonaNombre}</strong> sobre <strong className="text-gray-800">{itemAEliminar.propiedad.titulo}</strong>. Solo desaparece de tu bandeja — si te vuelve a escribir, la conversación reaparece.
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => setItemAEliminar(null)} className="flex-1 justify-center">
                Cancelar
              </Button>
              <Button type="button" variant="danger" onClick={confirmarEliminar} isLoading={eliminando} className="flex-1 justify-center">
                Eliminar
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
