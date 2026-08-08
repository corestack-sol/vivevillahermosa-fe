'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Eye, MessageCircle, Heart, Pencil, Trash2, Play, Pause, Archive, Star, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getMisPropiedadesDemo, ESTADOS_ARCHIVADOS, ESTADO_CFG, type EstadoPublicacion, type MiPropiedad } from '@/lib/misPropiedadesDemo';
import { getEstadoOverride, setEstadoOverride, ESTADO_OVERRIDE_EVENT } from '@/lib/estadoOverrides';
import {
  getMisPropiedadesConOverrides, eliminarPropiedad, destacarPropiedad, getDestacadoHasta,
  PROPIEDADES_LOCALES_EVENT,
} from '@/lib/propiedadesLocales';
import { Tooltip } from '@/components/ui/Tooltip';
import { ArchivarPropiedadModal } from '@/components/property/ArchivarPropiedadModal';
import { EliminarPropiedadModal } from '@/components/property/EliminarPropiedadModal';
import { DestacarPropiedadModal } from '@/components/property/DestacarPropiedadModal';
import { useRouter } from 'next/navigation';

/**
 * Banner de gestión visible solo si la propiedad que se está viendo es "tuya"
 * (según los datos de muestra de src/lib/misPropiedadesDemo.ts, más lo que
 * hayas publicado/editado en este navegador). Mismas acciones que
 * /dashboard/propiedades, para no tener que salir de la ficha pública para
 * gestionarla — disponible para cualquier cuenta, no solo inmobiliarias: el
 * publicar/gestionar/eliminar una propiedad propia no depende de tener
 * activado el modo Inmobiliaria (eso solo agrega branding opcional al
 * anuncio, ver usePerfilInmobiliaria).
 */
export function OwnerActionsBar({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const misPropiedadesBase = useMemo(() => getMisPropiedadesDemo(), []);
  const baseMine = misPropiedadesBase.find((m) => m.property.id === propertyId);

  const [mine, setMine] = useState<MiPropiedad | null>(baseMine ?? null);
  const [estado, setEstado] = useState<EstadoPublicacion | null>(baseMine?.estado ?? null);
  const [showArchivar, setShowArchivar] = useState(false);
  const [showEliminar, setShowEliminar] = useState(false);
  const [showDestacar, setShowDestacar] = useState(false);

  // El override de localStorage (estado + ediciones/eliminadas) solo existe
  // en cliente — se aplica en un efecto para que el primer render (servidor
  // y cliente) coincida.
  useEffect(() => {
    function aplicarOverride() {
      const conLocales = getMisPropiedadesConOverrides(misPropiedadesBase);
      const encontrada = conLocales.find((m) => m.property.id === propertyId) ?? null;
      setMine(encontrada);
      if (!encontrada) { setEstado(null); return; }
      const override = getEstadoOverride(propertyId);
      setEstado(override ?? encontrada.estado);
    }
    aplicarOverride();
    window.addEventListener(ESTADO_OVERRIDE_EVENT, aplicarOverride);
    window.addEventListener(PROPIEDADES_LOCALES_EVENT, aplicarOverride);
    return () => {
      window.removeEventListener(ESTADO_OVERRIDE_EVENT, aplicarOverride);
      window.removeEventListener(PROPIEDADES_LOCALES_EVENT, aplicarOverride);
    };
  }, [misPropiedadesBase, propertyId]);

  if (!user || !mine || !estado) return null;

  const estadoCfg = ESTADO_CFG[estado];
  const destacadoHasta = getDestacadoHasta(propertyId);

  function pendiente(accion: string) {
    toast.info(`"${accion}" estará disponible cuando se conecte el panel real de propiedades (Módulo 2, Fase 2).`);
  }

  // ⚠️ BACKEND: togglePausa/archivar/destacarPropiedad (abajo) y
  // eliminarPropiedad (en el modal, ver onConfirm de EliminarPropiedadModal
  // más abajo en este archivo) hoy solo escriben en localStorage
  // (src/lib/estadoOverrides.ts y src/lib/propiedadesLocales.ts). Deben
  // convertirse en `PATCH /api/propiedades/:id` (para estado/destacado) y
  // `DELETE /api/propiedades/:id` reales, validando `session.userId` contra
  // el dueño — ver el modelo Property sugerido al final de
  // prisma/schema.prisma. Mientras tanto, "dueño" se determina comparando
  // contra `getMisPropiedadesDemo()` (4 propiedades de muestra fijas, ver
  // src/lib/misPropiedadesDemo.ts) más lo creado en este navegador — no
  // contra una relación real, así que hoy CUALQUIER cuenta ve estas mismas
  // 4 propiedades como "suyas" si entra a su ficha.
  //
  // Pausar/reactivar, y también "reactivar" desde vendida/rentada (por si se
  // archivó por error) — vencida se maneja aparte con "Renovar" (pendiente).
  function togglePausa() {
    setEstado((prev) => {
      if (!prev) return prev;
      const next = prev === 'activa' ? 'pausada' : 'activa';
      setEstadoOverride(propertyId, next);
      return next;
    });
  }

  function archivar() {
    if (!mine) return;
    const next: EstadoPublicacion = mine.property.operacion === 'venta' ? 'vendida' : 'rentada';
    setEstado(next);
    setEstadoOverride(propertyId, next);
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
            {destacadoHasta && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                <Star size={9} className="fill-current" /> Destacada
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-brand-dark/60 mt-0.5">
            <Tooltip label="Vistas (dato de muestra — todavía no cuenta actividad real)">
              <span className="flex items-center gap-1" title="Vistas (dato de muestra)"><Eye size={12} /> {mine.vistas}</span>
            </Tooltip>
            <Tooltip label="Contactos recibidos (dato de muestra — todavía no cuenta actividad real)">
              <span className="flex items-center gap-1" title="Contactos recibidos (dato de muestra)"><MessageCircle size={12} /> {mine.contactos}</span>
            </Tooltip>
            <Tooltip label="Favoritos (dato de muestra — todavía no cuenta actividad real)">
              <span className="flex items-center gap-1" title="Favoritos (dato de muestra)"><Heart size={12} /> {mine.favoritos}</span>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Tooltip label={
          estado === 'activa' ? 'Pausar publicación'
            : estado === 'pausada' ? 'Reactivar publicación'
            : estado === 'vencida' ? 'Renovar publicación'
            : 'Reactivar publicación'
        }>
          <button
            type="button"
            onClick={() => (estado === 'vencida' ? pendiente('Renovar') : togglePausa())}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-brand-dark/60 hover:text-brand hover:bg-white transition-colors"
          >
            {estado === 'activa' ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </Tooltip>
        {estado && !ESTADOS_ARCHIVADOS.includes(estado) && (
          <>
            <Tooltip label={destacadoHasta ? 'Ya está destacada' : 'Destacar propiedad'}>
              <button
                type="button"
                disabled={!!destacadoHasta}
                onClick={() => setShowDestacar(true)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-brand-dark/60 hover:text-amber-500 hover:bg-white transition-colors disabled:opacity-40 disabled:hover:text-brand-dark/60 disabled:hover:bg-transparent disabled:cursor-default"
              >
                <Star size={16} className={destacadoHasta ? 'fill-current text-amber-400' : ''} />
              </button>
            </Tooltip>
            <Tooltip label={mine.property.operacion === 'venta' ? 'Marcar como vendida' : 'Marcar como rentada'}>
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
        propertyTitle={mine.property.titulo}
        operacion={mine.property.operacion}
        onConfirm={archivar}
      />
      <EliminarPropiedadModal
        isOpen={showEliminar}
        onClose={() => setShowEliminar(false)}
        propertyTitle={mine.property.titulo}
        onConfirm={() => {
          eliminarPropiedad(propertyId);
          toast.success('Propiedad eliminada.');
          router.push('/dashboard/propiedades');
        }}
      />
      <DestacarPropiedadModal
        isOpen={showDestacar}
        onClose={() => setShowDestacar(false)}
        propertyTitle={mine.property.titulo}
        onConfirm={(dias) => {
          destacarPropiedad(propertyId, dias);
          toast.success(`Propiedad destacada por ${dias} días.`);
        }}
      />
    </div>
  );
}
