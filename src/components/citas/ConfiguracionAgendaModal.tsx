'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import type { ConfiguracionAgenda } from '@/hooks/useConfiguracionAgenda';

const DIAS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

const HORA_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const hh = String(h).padStart(2, '0');
  return { value: `${hh}:00`, label: `${hh}:00` };
});

const DURACION_OPTIONS = [15, 30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: `${m} min` }));

const RECORDATORIO_OPTIONS = [
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '120', label: '2 horas antes' },
  { value: '1440', label: '1 día antes' },
];

interface ConfiguracionAgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConfiguracionAgenda | null;
  onSaved: (config: ConfiguracionAgenda) => void;
}

export function ConfiguracionAgendaModal({ isOpen, onClose, config, onSaved }: ConfiguracionAgendaModalProps) {
  const toast = useToast();
  const [diasLaborables, setDiasLaborables] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('18:00');
  const [duracionCitaMin, setDuracionCitaMin] = useState('30');
  const [recordatorioMinAntes, setRecordatorioMinAntes] = useState('60');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function cargarValores() {
      if (!isOpen) return;
      const dias = config?.diasLaborables ?? '1,2,3,4,5';
      setDiasLaborables(new Set(dias.split(',').filter(Boolean).map(Number)));
      setHoraInicio(config?.horaInicio ?? '09:00');
      setHoraFin(config?.horaFin ?? '18:00');
      setDuracionCitaMin(String(config?.duracionCitaMin ?? 30));
      setRecordatorioMinAntes(String(config?.recordatorioMinAntes ?? 60));
    }
    cargarValores();
  }, [isOpen, config]);

  function toggleDia(dia: number) {
    setDiasLaborables((prev) => {
      const next = new Set(prev);
      if (next.has(dia)) next.delete(dia); else next.add(dia);
      return next;
    });
  }

  async function handleGuardar() {
    if (diasLaborables.size === 0) {
      toast.error('Elige al menos un día laborable.');
      return;
    }
    if (horaInicio >= horaFin) {
      toast.error('La hora de inicio debe ser antes que la hora de fin.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion-agenda', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diasLaborables: Array.from(diasLaborables).sort().join(','),
          horaInicio,
          horaFin,
          duracionCitaMin: Number(duracionCitaMin),
          recordatorioMinAntes: Number(recordatorioMinAntes),
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success('Configuración de agenda guardada.');
      onSaved(data.config);
      onClose();
    } catch {
      toast.error('No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configuración de agenda" maxWidth="md">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Días laborables</label>
          <div className="flex flex-wrap gap-1.5">
            {DIAS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDia(d.value)}
                className={`w-12 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                  diasLaborables.has(d.value)
                    ? 'bg-brand border-brand text-white'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-brand/40'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Hora de inicio" options={HORA_OPTIONS} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          <Select label="Hora de fin" options={HORA_OPTIONS} value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
        </div>

        <Select label="Duración de cita por defecto" options={DURACION_OPTIONS} value={duracionCitaMin} onChange={(e) => setDuracionCitaMin(e.target.value)} />

        <div>
          <Select label="Recordatorio por correo" options={RECORDATORIO_OPTIONS} value={recordatorioMinAntes} onChange={(e) => setRecordatorioMinAntes(e.target.value)} />
          <p className="text-xs text-gray-400 mt-1.5">Se te avisa a ti y al cliente (si dejó su correo) antes de cada cita.</p>
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">Cancelar</Button>
          <Button type="button" onClick={handleGuardar} isLoading={saving} className="flex-1 justify-center">Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}
