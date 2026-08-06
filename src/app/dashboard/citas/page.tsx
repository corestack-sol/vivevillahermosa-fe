'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DayPicker, type ClassNames } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import { format, startOfMonth, endOfMonth, addDays, subDays, parseISO } from 'date-fns';
import {
  ArrowLeft, Plus, Settings, Clock, User, Phone, Mail, Trash2, CheckCircle2, XCircle,
  MapPin, FileText, CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useConfiguracionAgenda } from '@/hooks/useConfiguracionAgenda';
import { getPropertyById } from '@/lib/api';
import { Skeleton } from '@/components/ui/Skeleton';
import { NuevaCitaModal } from '@/components/citas/NuevaCitaModal';
import { ConfiguracionAgendaModal } from '@/components/citas/ConfiguracionAgendaModal';

interface Cita {
  id: string;
  propiedadId: string | null;
  titulo: string;
  nombreCliente: string;
  telefonoCliente: string | null;
  emailCliente: string | null;
  notas: string | null;
  fecha: string;
  duracionMin: number;
  estado: 'confirmada' | 'cancelada' | 'completada';
}

const DIA_KEY = 'yyyy-MM-dd';

const dayPickerClassNames: Partial<ClassNames> = {
  months: 'flex flex-col',
  month: 'w-full',
  month_caption: 'flex items-center justify-center h-10 relative mb-2',
  caption_label: 'text-base font-heading font-bold text-gray-900 capitalize',
  nav: 'absolute inset-x-0 top-0 h-10 flex items-center justify-between pointer-events-none',
  button_previous: 'pointer-events-auto p-2 rounded-lg text-gray-400 hover:text-brand hover:bg-brand-pale transition-colors disabled:opacity-30 disabled:pointer-events-none',
  button_next: 'pointer-events-auto p-2 rounded-lg text-gray-400 hover:text-brand hover:bg-brand-pale transition-colors disabled:opacity-30 disabled:pointer-events-none',
  month_grid: 'w-full border-collapse',
  weekday: 'text-[11px] font-semibold text-gray-400 uppercase pb-2',
  day: 'text-center p-0.5',
  day_button: 'relative w-10 h-10 mx-auto rounded-xl text-sm font-medium text-gray-700 hover:bg-brand-pale transition-colors flex items-center justify-center cursor-pointer',
  today: '[&>button]:font-bold [&>button]:text-brand [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-brand/40',
  selected: '[&>button]:!bg-brand [&>button]:!text-white [&>button]:hover:!bg-brand-dark',
  outside: '[&>button]:text-gray-300',
  hidden: 'invisible',
};

const modifiersClassNames = {
  conCitas: '[&>button]:after:content-[\'\'] [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:-translate-x-1/2 [&>button]:after:w-1 [&>button]:after:h-1 [&>button]:after:rounded-full [&>button]:after:bg-accent',
  noLaborable: '[&>button]:text-gray-300 [&>button]:bg-gray-50',
};

const ESTADO_CFG: Record<Cita['estado'], { label: string; cls: string }> = {
  confirmada: { label: 'Confirmada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-400 border-gray-200' },
  completada: { label: 'Completada', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function CitasPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const esProfesional = !!user && user.rol !== 'buscador';

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [citas, setCitas] = useState<Cita[]>([]);
  const [citasLoading, setCitasLoading] = useState(true);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const { config, setConfig } = useConfiguracionAgenda(esProfesional);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!authLoading && user && user.rol === 'buscador') { router.push('/dashboard'); }
  }, [authLoading, user, router]);

  const cargarCitas = useCallback(() => {
    if (!esProfesional) return;
    setCitasLoading(true);
    const desde = subDays(startOfMonth(month), 7);
    const hasta = addDays(endOfMonth(month), 7);
    fetch(`/api/citas?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`)
      .then((r) => r.json())
      .then((d) => setCitas(d.citas ?? []))
      .catch(() => {})
      .finally(() => setCitasLoading(false));
  }, [month, esProfesional]);

  useEffect(() => {
    function cargar() { cargarCitas(); }
    cargar();
  }, [cargarCitas]);

  const diasLaborablesSet = useMemo(
    () => new Set((config?.diasLaborables ?? '1,2,3,4,5').split(',').filter(Boolean).map(Number)),
    [config]
  );

  const citasPorDia = useMemo(() => {
    const map = new Map<string, Cita[]>();
    for (const c of citas) {
      if (c.estado === 'cancelada') continue;
      const key = format(new Date(c.fecha), DIA_KEY);
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return map;
  }, [citas]);

  const diasConCitas = useMemo(() => Array.from(citasPorDia.keys()).map((k) => parseISO(k)), [citasPorDia]);
  const citasDelDia = citasPorDia.get(format(selectedDate, DIA_KEY)) ?? [];

  async function actualizarEstado(id: string, estado: 'cancelada' | 'completada') {
    const previous = citas;
    setCitas((prev) => prev.map((c) => (c.id === id ? { ...c, estado } : c)));
    try {
      const res = await fetch(`/api/citas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error();
      toast.success(estado === 'cancelada' ? 'Cita cancelada.' : 'Cita marcada como completada.');
    } catch {
      setCitas(previous);
      toast.error('No se pudo actualizar la cita.');
    }
  }

  async function eliminarCita(id: string) {
    const previous = citas;
    setCitas((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/citas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Cita eliminada.');
    } catch {
      setCitas(previous);
      toast.error('No se pudo eliminar la cita.');
    }
  }

  if (authLoading || !user || user.rol === 'buscador') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="w-48 mb-8" />
        <Skeleton variant="image" className="w-full h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-brand transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays size={20} className="text-brand" /> Mi agenda
            </h1>
            <p className="text-sm text-gray-500">Agenda y da seguimiento a tus citas con clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-brand/40 text-gray-700 hover:text-brand text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Settings size={15} /> Configuración
          </button>
          <button
            type="button"
            onClick={() => setShowNueva(true)}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={15} /> Nueva cita
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* Calendario */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          {citasLoading ? (
            <Skeleton variant="image" className="w-full h-80 rounded-xl" />
          ) : (
            <>
              <DayPicker
                mode="single"
                locale={es}
                month={month}
                onMonthChange={setMonth}
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                showOutsideDays
                modifiers={{ conCitas: diasConCitas, noLaborable: (date) => !diasLaborablesSet.has(date.getDay()) }}
                modifiersClassNames={modifiersClassNames}
                classNames={dayPickerClassNames}
              />
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Día con citas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-gray-50 border border-gray-200" /> No laborable
                </span>
              </div>
            </>
          )}
        </div>

        {/* Panel del día seleccionado */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-brand uppercase tracking-wide">
                {!diasLaborablesSet.has(selectedDate.getDay()) && 'No laborable · '}
                {citasDelDia.length} cita{citasDelDia.length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm font-heading font-bold text-gray-900 capitalize">
                {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>
          </div>

          {citasDelDia.length === 0 ? (
            <div className="text-center py-10">
              <CalendarDays size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-4">Sin citas este día</p>
              {diasLaborablesSet.has(selectedDate.getDay()) ? (
                <button
                  type="button"
                  onClick={() => setShowNueva(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark"
                >
                  <Plus size={14} /> Agendar una
                </button>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  Este día no es laborable según tu configuración de agenda
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 -mr-1">
              {citasDelDia.map((cita) => {
                const propiedad = cita.propiedadId ? getPropertyById(cita.propiedadId) : undefined;
                const estadoCfg = ESTADO_CFG[cita.estado];
                return (
                  <div key={cita.id} className="border border-gray-100 rounded-xl p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                        <Clock size={12} className="text-gray-400" />
                        {format(new Date(cita.fecha), 'HH:mm')} · {cita.duracionMin} min
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border flex-shrink-0 ${estadoCfg.cls}`}>
                        {estadoCfg.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">{cita.titulo}</p>
                    <div className="space-y-1 text-xs text-gray-500">
                      <p className="flex items-center gap-1.5"><User size={11} className="text-gray-300 flex-shrink-0" /> {cita.nombreCliente}</p>
                      {cita.telefonoCliente && (
                        <p className="flex items-center gap-1.5"><Phone size={11} className="text-gray-300 flex-shrink-0" /> {cita.telefonoCliente}</p>
                      )}
                      {cita.emailCliente && (
                        <p className="flex items-center gap-1.5"><Mail size={11} className="text-gray-300 flex-shrink-0" /> {cita.emailCliente}</p>
                      )}
                      {propiedad && (
                        <Link href={`/propiedades/${propiedad.slug}`} className="flex items-center gap-1.5 text-brand hover:underline">
                          <MapPin size={11} className="flex-shrink-0" /> {propiedad.titulo}
                        </Link>
                      )}
                      {cita.notas && (
                        <p className="flex items-start gap-1.5 pt-1"><FileText size={11} className="text-gray-300 flex-shrink-0 mt-0.5" /> {cita.notas}</p>
                      )}
                    </div>

                    {cita.estado === 'confirmada' && (
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-50">
                        <button
                          type="button"
                          onClick={() => actualizarEstado(cita.id, 'completada')}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <CheckCircle2 size={13} /> Completada
                        </button>
                        <button
                          type="button"
                          onClick={() => actualizarEstado(cita.id, 'cancelada')}
                          className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <XCircle size={13} /> Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarCita(cita.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors ml-auto"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <NuevaCitaModal
        isOpen={showNueva}
        onClose={() => setShowNueva(false)}
        fechaInicial={selectedDate}
        duracionDefault={config?.duracionCitaMin ?? 30}
        onCreated={cargarCitas}
      />
      <ConfiguracionAgendaModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        config={config}
        onSaved={setConfig}
      />
    </div>
  );
}
