'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Info, Pencil, Trash2, Play, Pause, Archive, Star, Building2, Download, Upload, TrendingUp, Loader2,
} from 'lucide-react';
import { ESTADOS_ARCHIVADOS, ESTADO_CFG, mapMiaBackend, type EstadoPublicacion, type MiPropiedad } from '@/lib/misPropiedades';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { type BackendPublicProperty } from '@/lib/api';
import { getPropertyTypeConfig } from '@/lib/propertyTypeConfig';
import { generarReporteDesempeno } from '@/lib/reportePdf';
import { obtenerResumenReporte } from '@/lib/aiClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { usePerfilInmobiliaria } from '@/hooks/usePerfilInmobiliaria';
import { Tooltip } from '@/components/ui/Tooltip';
import { ArchivarPropiedadModal } from '@/components/property/ArchivarPropiedadModal';
import { EliminarPropiedadModal } from '@/components/property/EliminarPropiedadModal';
import { DestacarPropiedadModal } from '@/components/property/DestacarPropiedadModal';

// Debe coincidir con LIMITE_PROPIEDADES_ACTIVAS en el backend
// (properties.service.ts) — solo para el mensaje, el servidor lo hace
// cumplir de verdad (código LIMITE_PROPIEDADES_ALCANZADO).
// 2026-08-10: bajado de 4 a 3, ver docs/PLAN-AUDITORIA-FASE1-MVP.md punto 0.
const LIMITE_PROPIEDADES = 3;

type FiltroEstado = EstadoPublicacion | 'todas' | 'archivada';

const FILTERS: { value: FiltroEstado; label: string }[] = [
  { value: 'todas',     label: 'Todas' },
  { value: 'activa',    label: 'Activas' },
  { value: 'pausada',   label: 'Pausadas' },
  { value: 'vencida',   label: 'Vencidas' },
  { value: 'archivada', label: 'Archivadas' },
];

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);
}

export default function MisPropiedadesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const perfil = usePerfilInmobiliaria(true);
  const [filter, setFilter] = useState<FiltroEstado>('todas');
  const [items, setItems] = useState<MiPropiedad[]>([]);
  const [archivando, setArchivando] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [destacando, setDestacando] = useState<string | null>(null);
  const [generandoReporte, setGenerandoReporte] = useState(false);

  const cargarPropiedades = () => {
    if (!user) return;
    backendFetch<{ propiedades: BackendPublicProperty[] }>('/propiedades/mias')
      .then(({ propiedades }) => setItems(propiedades.map(mapMiaBackend)))
      .catch(() => toast.error('No se pudieron cargar tus propiedades.'));
  };

  useEffect(() => {
    cargarPropiedades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = filter === 'todas'
    ? items
    : filter === 'archivada'
      ? items.filter((i) => ESTADOS_ARCHIVADOS.includes(i.estado))
      : items.filter((i) => i.estado === filter);
  const counts: Record<FiltroEstado, number> = {
    todas: items.length,
    activa: items.filter((i) => i.estado === 'activa').length,
    pausada: items.filter((i) => i.estado === 'pausada').length,
    vencida: items.filter((i) => i.estado === 'vencida').length,
    vendida: items.filter((i) => i.estado === 'vendida').length,
    rentada: items.filter((i) => i.estado === 'rentada').length,
    archivada: items.filter((i) => ESTADOS_ARCHIVADOS.includes(i.estado)).length,
  };

  function pendiente(accion: string) {
    toast.info(`"${accion}" estará disponible cuando se conecte el panel real de propiedades (Módulo 2, Fase 2).`);
  }

  async function descargarReporte() {
    setGenerandoReporte(true);
    const resumenIA = await obtenerResumenReporte(items);
    setGenerandoReporte(false);
    generarReporteDesempeno({
      nombreCuenta: user?.nombre ?? 'Mi cuenta',
      propiedades: items,
      nombreEmpresa: perfil?.nombreEmpresa,
      logoDataUrl: perfil?.logoDataUrl,
      resumenIA,
    });
    toast.success('Reporte descargado.');
  }

  async function actualizarEstado(id: string, nextEstado: EstadoPublicacion) {
    try {
      await backendFetch(`/propiedades/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nextEstado }),
      });
      setItems((prev) => prev.map((it) => (it.property.id === id ? { ...it, estado: nextEstado } : it)));
    } catch (err) {
      if (err instanceof BackendApiError) {
        const code = (err.body as { code?: string } | null)?.code;
        toast.error(
          code === 'LIMITE_PROPIEDADES_ALCANZADO'
            ? `Ya tienes ${LIMITE_PROPIEDADES} propiedades activas — el máximo gratuito. Contáctanos para un plan profesional si necesitas reactivar más.`
            : err.message,
        );
        return;
      }
      toast.error('No se pudo actualizar la propiedad.');
    }
  }

  // También sirve para "reactivar" desde vendida/rentada por si se archivó
  // por error — vencida se maneja aparte con "Renovar" (pendiente).
  function togglePausa(id: string) {
    const actual = items.find((it) => it.property.id === id);
    if (!actual) return;
    actualizarEstado(id, actual.estado === 'activa' ? 'pausada' : 'activa');
  }

  function archivar(id: string, operacion: 'venta' | 'renta') {
    actualizarEstado(id, operacion === 'venta' ? 'vendida' : 'rentada');
  }

  const propiedadArchivando = archivando ? items.find((i) => i.property.id === archivando) : undefined;
  const propiedadEliminando = eliminando ? items.find((i) => i.property.id === eliminando) : undefined;
  const propiedadDestacando = destacando ? items.find((i) => i.property.id === destacando) : undefined;

  async function confirmarEliminar(id: string) {
    try {
      await backendFetch(`/propiedades/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((it) => it.property.id !== id));
      toast.success('Propiedad eliminada.');
    } catch {
      toast.error('No se pudo eliminar la propiedad.');
    }
  }

  async function confirmarDestacar(id: string, dias: number) {
    try {
      await backendFetch(`/propiedades/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ featured: true }),
      });
      setItems((prev) => prev.map((it) => (
        it.property.id === id ? { ...it, property: { ...it.property, featured: true } } : it
      )));
      toast.success(`Propiedad destacada por ${dias} días.`);
    } catch {
      toast.error('No se pudo destacar la propiedad.');
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-brand transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900">Mis propiedades</h1>
            <p className="text-sm text-gray-500">Gestiona tus publicaciones y revisa su desempeño</p>
          </div>
        </div>
        {/* flex-wrap — sin esto, los 4 botones (Analítica/Descargar
            reporte/Importar CSV/Publicar nueva) forzaban una sola fila más
            ancha que la pantalla, y como el padre no tiene overflow-x-auto
            propio, arrastraba TODA la página a scroll horizontal en móvil
            (bug real confirmado en auditoría de responsividad, 2026-08-10
            — la fila de pestañas de estado de abajo, el header, todo se
            veía "cortado" porque en realidad la página entera era más
            ancha que el viewport). */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/dashboard/analitica"
            className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-brand/40 text-gray-700 hover:text-brand text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <TrendingUp size={15} /> Analítica
          </Link>
          <button
            type="button"
            onClick={descargarReporte}
            disabled={items.length === 0 || generandoReporte}
            className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-brand/40 text-gray-700 hover:text-brand text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generandoReporte ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {generandoReporte ? 'Generando...' : 'Descargar reporte'}
          </button>
          <Link href="/dashboard/propiedades/importar"
            className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-brand/40 text-gray-700 hover:text-brand text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Upload size={15} /> Importar CSV
          </Link>
          <Link href="/publicar"
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Plus size={15} /> Publicar nueva
          </Link>
        </div>
      </div>

      {/* Estadísticas de vistas/contactos todavía no existen (BACKEND.md
          §12, analítica fuera del alcance del MVP) — honesto sobre esa
          única pieza que sigue pendiente, las propiedades ya son reales. */}
      <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-6">
        <Info size={15} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand-dark leading-relaxed">
          Las estadísticas de vistas y contactos todavía no están disponibles — llegan en una fase futura.
        </p>
      </div>

      {/* Filtros por estado */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl border-2 transition-all ${
              filter === f.value
                ? 'bg-brand border-brand text-white'
                : 'bg-white border-gray-200 text-gray-500 hover:border-brand/40 hover:text-brand'
            }`}
          >
            {f.label}
            <span className={`text-xs ${filter === f.value ? 'text-white/70' : 'text-gray-400'}`}>
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Building2 size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium mb-2">
            No tienes propiedades {filter !== 'todas' ? FILTERS.find((f) => f.value === filter)?.label.toLowerCase() : ''} por aquí
          </p>
          <p className="text-gray-400 text-sm mb-6">
            {filter === 'todas'
              ? 'Publica tu primera propiedad para empezar a gestionar tu cartera.'
              : 'Cambia el filtro para ver tus otras publicaciones, o publica una nueva.'}
          </p>
          <Link href="/publicar"
            className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-brand-dark transition-colors">
            <Plus size={15} /> Publicar propiedad
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ property: p, estado, publicadaHace }) => {
            const cfg = getPropertyTypeConfig(p.tipo);
            const estadoCfg = ESTADO_CFG[estado];
            return (
              // flex-col en móvil, flex-row desde sm: — con los íconos de
              // acción siempre visibles (w-8 cada uno) más la miniatura, no
              // quedaba ancho real para el título/ubicación en una sola fila
              // angosta y se truncaban a "Casa e...", "Tabasco ..." (bug
              // real confirmado en auditoría de responsividad, 2026-08-10).
              // Ahora en móvil la info ocupa su propia fila completa y las
              // acciones bajan a una segunda fila alineada a la derecha;
              // desde sm: vuelve al layout original de una sola fila.
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white border border-gray-100 rounded-2xl p-3.5 hover:border-brand/30 hover:shadow-sm transition-all">
                <div className="flex items-center gap-4 min-w-0">
                  <Link href={`/propiedades/${p.slug}`}
                    className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ background: `linear-gradient(160deg, ${cfg.from} 0%, ${cfg.to} 100%)` }}>
                    <cfg.Icon size={22} style={{ color: cfg.accent }} strokeWidth={1.75} />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${estadoCfg.cls}`}>
                        {estadoCfg.label}
                      </span>
                      <span className="text-xs text-gray-400">Publicada {publicadaHace}</span>
                      {p.featured && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                          <Star size={9} className="fill-current" /> Destacada
                        </span>
                      )}
                    </div>
                    <Link href={`/propiedades/${p.slug}`} className="font-semibold text-gray-900 text-sm truncate block hover:text-brand transition-colors">
                      {p.titulo}
                    </Link>
                    <p className="text-xs text-gray-400 truncate">{p.colonia}, {p.municipio === 'Centro' ? 'Villahermosa' : p.municipio}</p>
                  </div>
                </div>

                <p className="hidden sm:block flex-shrink-0 font-bold text-gray-900 text-sm w-28 text-right">
                  {fmtMoney(p.precio)}{p.operacion === 'renta' && <span className="text-xs font-normal text-gray-400">/mes</span>}
                </p>

                <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-auto">
                  <Tooltip label={
                    estado === 'activa' ? 'Pausar publicación'
                      : estado === 'pausada' ? 'Reactivar publicación'
                      : estado === 'vencida' ? 'Renovar publicación'
                      : 'Reactivar publicación'
                  }>
                    <button
                      type="button"
                      onClick={() => estado === 'vencida' ? pendiente('Renovar') : togglePausa(p.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-brand hover:bg-brand-pale transition-colors"
                    >
                      {estado === 'activa' ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                  </Tooltip>
                  {!ESTADOS_ARCHIVADOS.includes(estado) && (
                    <>
                      <Tooltip label={p.featured ? 'Ya está destacada' : 'Destacar propiedad'}>
                        <button
                          type="button"
                          disabled={p.featured}
                          onClick={() => setDestacando(p.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-40 disabled:hover:text-gray-400 disabled:hover:bg-transparent disabled:cursor-default"
                        >
                          <Star size={15} className={p.featured ? 'fill-current text-amber-400' : ''} />
                        </button>
                      </Tooltip>
                      <Tooltip label={p.operacion === 'venta' ? 'Marcar como vendida' : 'Marcar como rentada'}>
                        <button
                          type="button"
                          onClick={() => setArchivando(p.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-brand hover:bg-brand-pale transition-colors"
                        >
                          <Archive size={15} />
                        </button>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip label="Editar propiedad">
                    <Link href={`/dashboard/propiedades/${p.id}/editar`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-brand hover:bg-brand-pale transition-colors"
                    >
                      <Pencil size={15} />
                    </Link>
                  </Tooltip>
                  <Tooltip label="Eliminar propiedad">
                    <button
                      type="button"
                      onClick={() => setEliminando(p.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {propiedadArchivando && (
        <ArchivarPropiedadModal
          isOpen
          onClose={() => setArchivando(null)}
          propertyTitle={propiedadArchivando.property.titulo}
          operacion={propiedadArchivando.property.operacion}
          onConfirm={() => archivar(propiedadArchivando.property.id, propiedadArchivando.property.operacion)}
        />
      )}

      {propiedadEliminando && (
        <EliminarPropiedadModal
          isOpen
          onClose={() => setEliminando(null)}
          propertyTitle={propiedadEliminando.property.titulo}
          onConfirm={() => confirmarEliminar(propiedadEliminando.property.id)}
        />
      )}

      {propiedadDestacando && (
        <DestacarPropiedadModal
          isOpen
          onClose={() => setDestacando(null)}
          propertyTitle={propiedadDestacando.property.titulo}
          onConfirm={(dias) => confirmarDestacar(propiedadDestacando.property.id, dias)}
        />
      )}
    </div>
  );
}
