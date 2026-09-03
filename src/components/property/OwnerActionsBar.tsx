'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Pencil, Trash2, Play, Pause, Archive, Star, ArrowRight, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { ESTADOS_ARCHIVADOS, ESTADO_CFG, type EstadoPublicacion } from '@/lib/misPropiedades';
import { Tooltip } from '@/components/ui/Tooltip';
import { ArchivarPropiedadModal } from '@/components/property/ArchivarPropiedadModal';
import { EliminarPropiedadModal } from '@/components/property/EliminarPropiedadModal';
import { PausarPropiedadModal } from '@/components/property/PausarPropiedadModal';
import { DestacarPropiedadModal } from '@/components/property/DestacarPropiedadModal';
import { useRouter } from 'next/navigation';

// Debe coincidir con el límite real del backend — solo se usa para el
// mensaje de error, el servidor es quien de verdad lo hace cumplir
// (código LIMITE_PROPIEDADES_ALCANZADO).
// 2026-08-10: bajado de 4 a 3, ver docs/PLAN-AUDITORIA-FASE1-MVP.md punto 0.
const LIMITE_PROPIEDADES = 3;

interface MiaBackend {
  id: string;
  titulo: string;
  operacion: 'venta' | 'renta';
  estado: EstadoPublicacion;
  featured: boolean;
  // Confirmado en vivo 2026-09-02 — el backend ya lo manda real (ver
  // docs/BACKEND-VISTAS-CONTACTOS-02092026.md). Opcional se queda igual,
  // por si algún día vuelve a faltar (ej. propiedad muy vieja).
  contactosReales?: number;
}

/**
 * Banner de gestión visible solo si la propiedad que se está viendo es tuya
 * de verdad — GET /propiedades/mias real (BACKEND.md §3), ya no datos de
 * muestra ni localStorage. Mismas acciones que /dashboard/propiedades, para
 * no tener que salir de la ficha pública para gestionarla.
 */
export function OwnerActionsBar({ propertyId, lat, lng }: { propertyId: string; lat: number; lng: number }) {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  // Destacar es feature profesional (inmobiliaria) — pedido explícito
  // 2026-08-21: "los usuarios normales no deben tener esa opción". Mismo
  // criterio ya usado para "Panel profesional" (2026-08-20).
  const esProfesional = !!user && user.rol === 'agente';

  const [mine, setMine] = useState<MiaBackend | null>(null);
  const [showArchivar, setShowArchivar] = useState(false);
  const [showEliminar, setShowEliminar] = useState(false);
  const [showPausar, setShowPausar] = useState(false);
  const [showDestacar, setShowDestacar] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    backendFetch<{ propiedades: MiaBackend[] }>('/propiedades/mias')
      .then(({ propiedades }) => {
        if (cancelado) return;
        setMine(propiedades.find((p) => p.id === propertyId) ?? null);
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [user, propertyId]);

  if (!user || !mine) return null;

  const estadoCfg = ESTADO_CFG[mine.estado];

  function pendiente(accion: string) {
    toast.info(`"${accion}" estará disponible cuando se conecte el panel real de propiedades (Módulo 2, Fase 2).`);
  }

  // `extra` — motivo/motivoDetalle (pausar) o encontradoEnPlataforma/
  // medioAlterno (archivar), ver docs/BACKEND-MOTIVOS-CIERRE-23082026.md.
  // Van como QUERY PARAMS, nunca en el body — verificado en vivo 2026-08-23:
  // el backend valida el body de PATCH con whitelist estricta y rechaza
  // TODO el request (400 "property motivo should not exist") si lleva un
  // campo que no reconoce. Los query params sí los tolera sin problema
  // (confirmado igual en vivo) — el backend hoy no los persiste, pero al
  // menos no rompe la acción real de cambiar `estado`.
  async function actualizarEstado(nuevo: EstadoPublicacion, extra?: Record<string, string>) {
    try {
      const qs = extra ? `?${new URLSearchParams(extra).toString()}` : '';
      await backendFetch(`/propiedades/${propertyId}${qs}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevo }),
      });
      setMine((prev) => (prev ? { ...prev, estado: nuevo } : prev));
    } catch (err) {
      if (err instanceof BackendApiError) {
        const code = (err.body as { code?: string } | null)?.code;
        toast.error(
          code === 'LIMITE_PROPIEDADES_ALCANZADO'
            ? `Ya tienes ${LIMITE_PROPIEDADES} propiedades (activas o pausadas) — el máximo gratuito. Elimina alguna para reactivar esta.`
            : err.message,
        );
        return;
      }
      toast.error('No se pudo actualizar la propiedad.');
    }
  }

  // Reactivar se queda directo (no necesita explicarse) — solo pausar
  // pide motivo, vía PausarPropiedadModal. Pedido explícito 2026-08-23.
  function togglePausa() {
    if (mine!.estado === 'activa') { setShowPausar(true); return; }
    actualizarEstado('activa');
  }

  // lat/lng aquí son los reales, no los enmascarados — el backend solo los
  // manda cuando confirma que quien pide la propiedad es su propio dueño
  // (ver el comentario en api.ts sobre BackendPublicProperty.lat/lng). Solo
  // copia el link, no comparte nada — el dueño decide si lo pega o no en
  // su conversación real de WhatsApp con el interesado.
  async function copiarUbicacion() {
    const url = `https://maps.google.com/?q=${lat},${lng}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace de ubicación copiado — pégalo en tu conversación de WhatsApp.');
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  function archivar(encontradoEnPlataforma: boolean, medioAlterno?: string, medioAlternoDetalle?: string) {
    actualizarEstado(mine!.operacion === 'venta' ? 'vendida' : 'rentada', {
      encontradoEnPlataforma: String(encontradoEnPlataforma),
      ...(medioAlterno && { medioAlterno }),
      ...(medioAlternoDetalle && { medioAlternoDetalle }),
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap bg-brand-pale border border-brand/20 rounded-2xl px-5 py-4 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
          <Building2 size={17} className="text-brand" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-brand-dark">Estás viendo una de tus propiedades</p>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${estadoCfg.cls}`}>
              {estadoCfg.label}
            </span>
            {mine.featured && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                <Star size={9} className="fill-current" /> Destacada
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Tooltip label={
          mine.estado === 'activa' ? 'Pausar publicación'
            : mine.estado === 'pausada' ? 'Reactivar publicación'
            : mine.estado === 'vencida' ? 'Renovar publicación'
            : 'Reactivar publicación'
        }>
          <button
            type="button"
            onClick={() => (mine.estado === 'vencida' ? pendiente('Renovar') : togglePausa())}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-brand-dark/60 hover:text-brand hover:bg-white transition-colors"
          >
            {mine.estado === 'activa' ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </Tooltip>
        {!ESTADOS_ARCHIVADOS.includes(mine.estado) && (
          <>
            {esProfesional && (
              <Tooltip label={mine.featured ? 'Ya está destacada' : 'Destacar propiedad'}>
                <button
                  type="button"
                  disabled={mine.featured}
                  onClick={() => setShowDestacar(true)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-brand-dark/60 hover:text-amber-500 hover:bg-white transition-colors disabled:opacity-40 disabled:hover:text-brand-dark/60 disabled:hover:bg-transparent disabled:cursor-default"
                >
                  <Star size={16} className={mine.featured ? 'fill-current text-amber-400' : ''} />
                </button>
              </Tooltip>
            )}
            <Tooltip label={mine.operacion === 'venta' ? 'Marcar como vendida' : 'Marcar como rentada'}>
              <button
                type="button"
                onClick={() => setShowArchivar(true)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-brand-dark/60 hover:text-brand hover:bg-white transition-colors"
              >
                <Archive size={16} />
              </button>
            </Tooltip>
          </>
        )}
        {/* Aparte del resto (no solo ícono) — pedido explícito 2026-09-03:
            va a ser el botón que más se use de todos (compartir ubicación
            real por WhatsApp), necesita destacarse y decir qué hace sin
            depender de un tooltip al pasar el mouse. */}
        <button
          type="button"
          onClick={copiarUbicacion}
          title="Copiar mi ubicación exacta"
          className="flex items-center gap-1.5 bg-white border border-brand/25 text-brand hover:bg-brand hover:text-white hover:border-brand transition-colors text-xs font-semibold pl-2.5 pr-3 py-2 rounded-xl mx-2"
        >
          <MapPin size={14} /> Copiar ubicación
        </button>
        <Tooltip label="Editar propiedad">
          <Link href={`/dashboard/propiedades/${propertyId}/editar`}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-brand-dark/60 hover:text-brand hover:bg-white transition-colors"
          >
            <Pencil size={16} />
          </Link>
        </Tooltip>
        <Tooltip label="Eliminar propiedad">
          <button
            type="button"
            onClick={() => setShowEliminar(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-brand-dark/60 hover:text-red-500 hover:bg-white transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </Tooltip>
        <Link href="/dashboard/propiedades"
          className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark ml-2">
          Gestionar en mi panel <ArrowRight size={13} />
        </Link>
      </div>

      <ArchivarPropiedadModal
        isOpen={showArchivar}
        onClose={() => setShowArchivar(false)}
        propertyTitle={mine.titulo}
        operacion={mine.operacion}
        onConfirm={archivar}
        contactosReales={mine.contactosReales}
      />
      <PausarPropiedadModal
        isOpen={showPausar}
        onClose={() => setShowPausar(false)}
        propertyTitle={mine.titulo}
        onConfirm={(motivo, motivoDetalle) => actualizarEstado('pausada', { motivo, ...(motivoDetalle && { motivoDetalle }) })}
      />
      <EliminarPropiedadModal
        isOpen={showEliminar}
        onClose={() => setShowEliminar(false)}
        propertyTitle={mine.titulo}
        onConfirm={async (motivo, motivoDetalle) => {
          try {
            const qs = new URLSearchParams({ motivo, ...(motivoDetalle && { motivoDetalle }) });
            await backendFetch(`/propiedades/${propertyId}?${qs.toString()}`, { method: 'DELETE' });
            toast.success('Propiedad eliminada.');
            router.push('/dashboard/propiedades');
          } catch {
            toast.error('No se pudo eliminar la propiedad.');
          }
        }}
      />
      <DestacarPropiedadModal
        isOpen={showDestacar}
        onClose={() => setShowDestacar(false)}
        propertyTitle={mine.titulo}
        onConfirm={async (dias) => {
          try {
            await backendFetch(`/propiedades/${propertyId}`, {
              method: 'PATCH',
              body: JSON.stringify({ featured: true }),
            });
            setMine((prev) => (prev ? { ...prev, featured: true } : prev));
            toast.success(`Propiedad destacada por ${dias} días.`);
          } catch {
            toast.error('No se pudo destacar la propiedad.');
          }
        }}
      />
    </div>
  );
}
