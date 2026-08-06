'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { getAllProperties } from '@/lib/api';

const DURACION_OPTIONS = [15, 30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: `${m} min` }));

const schema = z.object({
  titulo: z.string().min(2, 'Escribe un título para la cita'),
  nombreCliente: z.string().min(2, 'Escribe el nombre del cliente'),
  telefonoCliente: z.string().optional(),
  emailCliente: z.string().email('Correo inválido').or(z.literal('')).optional(),
  propiedadId: z.string().optional(),
  fecha: z.string().min(1, 'Elige una fecha'),
  hora: z.string().min(1, 'Elige una hora'),
  duracionMin: z.string().min(1),
  notas: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface NuevaCitaModalProps {
  isOpen: boolean;
  onClose: () => void;
  fechaInicial: Date;
  duracionDefault: number;
  onCreated: () => void;
}

export function NuevaCitaModal({ isOpen, onClose, fechaInicial, duracionDefault, onCreated }: NuevaCitaModalProps) {
  const toast = useToast();
  const propiedadOptions = useMemo(
    () => getAllProperties().slice(0, 100).map((p) => ({ value: p.id, label: p.titulo })),
    []
  );

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fecha: format(fechaInicial, 'yyyy-MM-dd'),
      hora: '10:00',
      duracionMin: String(duracionDefault),
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        titulo: '',
        nombreCliente: '',
        telefonoCliente: '',
        emailCliente: '',
        propiedadId: '',
        fecha: format(fechaInicial, 'yyyy-MM-dd'),
        hora: '10:00',
        duracionMin: String(duracionDefault),
        notas: '',
      });
    }
  }, [isOpen, fechaInicial, duracionDefault, reset]);

  async function onSubmit(data: FormData) {
    const fechaHora = new Date(`${data.fecha}T${data.hora}:00`);
    // Un date/time input casi siempre da un valor válido, pero no está
    // garantizado (autocompletado del navegador, entrada manual rara) — sin
    // este check, `.toISOString()` más abajo lanza sobre un Invalid Date y
    // el usuario solo ve el toast genérico de "no se pudo agendar", sin
    // pista de que el problema es la fecha que escribió.
    if (Number.isNaN(fechaHora.getTime())) {
      toast.error('La fecha u hora no son válidas.');
      return;
    }
    try {
      const res = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: data.titulo,
          nombreCliente: data.nombreCliente,
          telefonoCliente: data.telefonoCliente || undefined,
          emailCliente: data.emailCliente || undefined,
          propiedadId: data.propiedadId || undefined,
          notas: data.notas || undefined,
          fecha: fechaHora.toISOString(),
          duracionMin: Number(data.duracionMin),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Cita agendada.');
      onCreated();
      onClose();
    } catch {
      toast.error('No se pudo agendar la cita. Intenta de nuevo.');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva cita" maxWidth="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input label="Título" placeholder="Ej. Visita a departamento en Tabasco 2000" error={errors.titulo?.message} {...register('titulo')} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha" type="date" error={errors.fecha?.message} {...register('fecha')} />
          <Input label="Hora" type="time" error={errors.hora?.message} {...register('hora')} />
        </div>

        <Select label="Duración" options={DURACION_OPTIONS} error={errors.duracionMin?.message} {...register('duracionMin')} />

        <Select label="Propiedad (opcional)" options={propiedadOptions} placeholder="Sin propiedad asociada" {...register('propiedadId')} />

        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Datos del cliente</p>
          <div className="space-y-3">
            <Input label="Nombre" placeholder="Nombre del cliente" error={errors.nombreCliente?.message} {...register('nombreCliente')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Teléfono (opcional)" placeholder="993 000 0000" {...register('telefonoCliente')} />
              <Input label="Correo (opcional)" type="email" placeholder="cliente@correo.com" error={errors.emailCliente?.message} {...register('emailCliente')} />
            </div>
            <p className="text-xs text-gray-400">Si dejas el correo, el cliente también recibe el recordatorio.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
          <textarea
            {...register('notas')}
            rows={3}
            placeholder="Detalles adicionales de la cita..."
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">Cancelar</Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1 justify-center">Agendar cita</Button>
        </div>
      </form>
    </Modal>
  );
}
