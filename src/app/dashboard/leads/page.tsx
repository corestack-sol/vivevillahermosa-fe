'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Info, Phone, Mail, MapPin, FileText, User as UserIcon, Tag, EyeOff, Eye } from 'lucide-react';
import { getPropertyById } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import {
  getLeadsDemo, aplicarEstadosGuardados, moverLead, ESTADO_LEAD_CFG, ORDEN_PIPELINE,
  type LeadConEstado, type EstadoLead,
} from '@/lib/leadsDemo';
import { formatRelativeDate, formatDate } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { readJson, writeJson } from '@/lib/localStore';

const KEY_COLUMNAS_OCULTAS = 'vivevillahermosa_leads_columnas_ocultas';

// Tailwind necesita las clases completas presentes en el código para
// generarlas — un string armado dinámicamente (`xl:grid-cols-${n}`) no
// funciona con su JIT, de ahí esta tabla en vez de interpolar el número.
const XL_COLS_CLASS: Record<number, string> = {
  1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6',
};

/** Reutilizado en la card (versión compacta) y en el modal de detalle. */
function SelectorEtapa({ lead, onMover, className }: { lead: LeadConEstado; onMover: (id: string, estado: EstadoLead) => void; className?: string }) {
  return (
    <select
      value={lead.estado}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onMover(lead.id, e.target.value as EstadoLead)}
      className={className ?? 'w-full min-w-0 text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand'}
    >
      {ORDEN_PIPELINE.map((e) => (
        <option key={e} value={e}>{ESTADO_LEAD_CFG[e].label}</option>
      ))}
    </select>
  );
}

export default function LeadsPage() {
  const toast = useToast();
  const [leads, setLeads] = useState<LeadConEstado[]>(getLeadsDemo());
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [ocultas, setOcultas] = useState<Set<EstadoLead>>(new Set());

  // Los cambios de estado y las columnas ocultas guardadas solo existen en
  // cliente — se aplican en un efecto para que el primer render (servidor y
  // cliente) coincida.
  useEffect(() => {
    function aplicar() {
      setLeads(aplicarEstadosGuardados(getLeadsDemo()));
      setOcultas(new Set(readJson<EstadoLead[]>(KEY_COLUMNAS_OCULTAS, [])));
    }
    aplicar();
  }, []);

  function handleMover(id: string, estado: EstadoLead) {
    moverLead(id, estado);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, estado } : l)));
    toast.success(`Movido a "${ESTADO_LEAD_CFG[estado].label}".`);
  }

  function ocultarColumna(estado: EstadoLead) {
    setOcultas((prev) => {
      const next = new Set(prev).add(estado);
      writeJson(KEY_COLUMNAS_OCULTAS, Array.from(next));
      return next;
    });
  }

  function mostrarColumna(estado: EstadoLead) {
    setOcultas((prev) => {
      const next = new Set(prev);
      next.delete(estado);
      writeJson(KEY_COLUMNAS_OCULTAS, Array.from(next));
      return next;
    });
  }

  const detalleLead = detalleId ? leads.find((l) => l.id === detalleId) ?? null : null;
  const columnasVisibles = ORDEN_PIPELINE.filter((e) => !ocultas.has(e));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-gray-400 hover:text-brand transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">Da seguimiento a cada persona interesada, de primer contacto a cierre</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-6">
        <Info size={15} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand-dark leading-relaxed">
          <strong>Vista previa con datos de muestra.</strong> Cuando el formulario de contacto de tus
          propiedades se conecte al backend real, cada mensaje nuevo creará un lead aquí automáticamente —
          por ahora puedes mover estos leads de ejemplo entre etapas para ver cómo funcionará.
        </p>
      </div>

      {ocultas.size > 0 && (
        <div className="flex items-center flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-400">Columnas ocultas:</span>
          {ORDEN_PIPELINE.filter((e) => ocultas.has(e)).map((estado) => (
            <button
              key={estado}
              type="button"
              onClick={() => mostrarColumna(estado)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1 transition-colors"
            >
              <Eye size={11} /> {ESTADO_LEAD_CFG[estado].label}
            </button>
          ))}
        </div>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${XL_COLS_CLASS[Math.max(1, columnasVisibles.length)] ?? 'xl:grid-cols-6'} gap-4`}>
        {columnasVisibles.map((estado) => {
          const cfg = ESTADO_LEAD_CFG[estado];
          const columna = leads.filter((l) => l.estado === estado);
          return (
            <div key={estado} className="min-w-0">
              <div className={`flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-xl border mb-3 ${cfg.cls}`}>
                <span className="truncate">{cfg.label}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="opacity-70">{columna.length}</span>
                  <button
                    type="button"
                    onClick={() => ocultarColumna(estado)}
                    title="Ocultar columna"
                    className="opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <EyeOff size={12} />
                  </button>
                </span>
              </div>
              <div className="space-y-2.5">
                {columna.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-6">Sin leads aquí</p>
                ) : columna.map((lead) => {
                  const propiedad = lead.propiedadId ? getPropertyById(lead.propiedadId) : undefined;
                  return (
                    <div key={lead.id}
                      onClick={() => setDetalleId(lead.id)}
                      className="bg-white border border-gray-100 rounded-2xl p-3.5 shadow-sm cursor-pointer hover:border-brand/30 hover:shadow-md transition-all"
                    >
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-1.5 min-w-0">
                        <UserIcon size={12} className="text-gray-300 flex-shrink-0" />
                        <span className="truncate">{lead.nombre}</span>
                      </p>
                      <div className="space-y-1 text-xs text-gray-500 mb-2">
                        {lead.telefono && (
                          <p className="flex items-center gap-1.5 min-w-0"><Phone size={11} className="text-gray-300 flex-shrink-0" /> <span className="truncate">{lead.telefono}</span></p>
                        )}
                        {lead.email && (
                          <p className="flex items-center gap-1.5 min-w-0"><Mail size={11} className="text-gray-300 flex-shrink-0" /> <span className="truncate">{lead.email}</span></p>
                        )}
                        {propiedad && (
                          <Link href={`/propiedades/${propiedad.slug}`} onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 min-w-0 text-brand hover:underline">
                            <MapPin size={11} className="flex-shrink-0" />
                            <span className="truncate">{propiedad.titulo}</span>
                          </Link>
                        )}
                        {lead.notas && (
                          <p className="flex items-start gap-1.5 pt-0.5 min-w-0"><FileText size={11} className="text-gray-300 flex-shrink-0 mt-0.5" /> <span className="line-clamp-2">{lead.notas}</span></p>
                        )}
                      </div>
                      <div className="pt-2 border-t border-gray-50 space-y-1.5">
                        <span className="block text-[10px] text-gray-400">{formatRelativeDate(lead.fecha)}</span>
                        <SelectorEtapa lead={lead} onMover={handleMover} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {columnasVisibles.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-10">
          Ocultaste todas las columnas — usa los chips de arriba para mostrar alguna de nuevo.
        </p>
      )}

      {detalleLead && (
        <Modal isOpen onClose={() => setDetalleId(null)} title={detalleLead.nombre} maxWidth="sm">
          <div className="space-y-4">
            <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ESTADO_LEAD_CFG[detalleLead.estado].cls}`}>
              {ESTADO_LEAD_CFG[detalleLead.estado].label}
            </span>

            <div className="space-y-2.5 text-sm text-gray-700">
              {detalleLead.telefono && (
                <a href={`tel:${detalleLead.telefono}`} className="flex items-center gap-2 hover:text-brand">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" /> {detalleLead.telefono}
                </a>
              )}
              {detalleLead.email && (
                <a href={`mailto:${detalleLead.email}`} className="flex items-center gap-2 hover:text-brand break-all">
                  <Mail size={14} className="text-gray-400 flex-shrink-0" /> {detalleLead.email}
                </a>
              )}
              {detalleLead.propiedadId && (() => {
                const propiedad = getPropertyById(detalleLead.propiedadId);
                return propiedad ? (
                  <Link href={`/propiedades/${propiedad.slug}`} className="flex items-center gap-2 text-brand hover:underline">
                    <MapPin size={14} className="flex-shrink-0" /> {propiedad.titulo}
                  </Link>
                ) : null;
              })()}
              <p className="flex items-center gap-2">
                <Tag size={14} className="text-gray-400 flex-shrink-0" /> {detalleLead.origen}
              </p>
              <p className="flex items-center gap-2 text-gray-400">
                {formatDate(detalleLead.fecha)}
              </p>
              {detalleLead.notas && (
                <p className="flex items-start gap-2 bg-gray-50 rounded-xl p-3 leading-relaxed">
                  <FileText size={14} className="text-gray-400 flex-shrink-0 mt-0.5" /> {detalleLead.notas}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Etapa</label>
              <SelectorEtapa
                lead={detalleLead}
                onMover={handleMover}
                className="w-full text-base sm:text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
