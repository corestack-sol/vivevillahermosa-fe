'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { MUNICIPIO_OPTIONS } from '@/lib/publishSchema';
import { CATEGORIA_SERVICIO_OPTIONS, publishServicioSchema, type PublishServicioFormData } from '@/lib/publishServicioSchema';

interface PublishServicioFormProps {
  /** Si viene, el submit hace PATCH a este id en vez de POST (editar en vez de crear). */
  servicioId?: string;
  valoresIniciales?: Partial<PublishServicioFormData>;
}

/**
 * Directorio de servicios — exploratorio, no conectado a la navegación
 * principal todavía (ver docs/BACKEND.md). Publicar es
 * gratis: el usuario decidió esperar a tener tráfico real antes de
 * monetizar (ver /servicios/planes, que es solo una vista previa de
 * precios, nada cobra todavía).
 */
export function PublishServicioForm({ servicioId, valoresIniciales }: PublishServicioFormProps) {
  const router = useRouter();
  const [sendError, setSendError] = useState<string | null>(null);
  const editando = Boolean(servicioId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PublishServicioFormData>({
    resolver: zodResolver(publishServicioSchema),
    defaultValues: valoresIniciales,
  });

  const onSubmit = async (data: PublishServicioFormData) => {
    setSendError(null);
    try {
      const res = await fetch(editando ? `/api/servicios/${servicioId}` : '/api/servicios', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar el servicio');
      router.push(editando ? '/dashboard/servicios' : `/dashboard/servicios/${json.id}/portafolio`);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'No se pudo guardar el servicio, intenta de nuevo.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 max-w-xl mx-auto">
      <Select
        label="Categoría de servicio"
        options={[...CATEGORIA_SERVICIO_OPTIONS]}
        error={errors.categoria?.message}
        {...register('categoria')}
      />
      <Input label="Tu nombre o el de tu negocio" placeholder="Ej. Plomería Hernández" error={errors.nombre?.message} {...register('nombre')} />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Describe tu servicio</label>
        <textarea
          {...register('descripcion')}
          rows={4}
          placeholder="Cuéntale a la gente qué haces, tu experiencia, si trabajas fines de semana, etc."
          className={`w-full rounded-xl border px-4 py-2.5 text-base sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 resize-none ${
            errors.descripcion ? 'border-danger' : 'border-gray-200 focus:border-brand focus:ring-brand/40'
          }`}
        />
        {errors.descripcion && <p className="mt-1 text-xs text-danger">{errors.descripcion.message}</p>}
      </div>
      <Select
        label="Municipio donde ofreces el servicio"
        options={MUNICIPIO_OPTIONS}
        error={errors.municipio?.message}
        {...register('municipio')}
      />
      <Input label="Colonia (opcional)" placeholder="Si trabajas sobre todo en una zona" error={errors.colonia?.message} {...register('colonia')} />
      <Input label="Teléfono / WhatsApp" type="tel" placeholder="993 123 4567" maxLength={12} error={errors.telefono?.message} {...register('telefono')} />
      <Input label="Correo (opcional)" type="email" placeholder="tu@correo.com" error={errors.email?.message} {...register('email')} />

      <p className="flex items-start gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
        <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" />
        Tu teléfono solo lo ven usuarios con sesión iniciada — nunca queda visible para cualquiera que visite la página, igual que el contacto de las propiedades.
      </p>

      {sendError && <p className="text-xs text-danger text-center">{sendError}</p>}

      <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
        {editando ? 'Guardar cambios' : 'Publicar servicio (gratis)'}
      </Button>
    </form>
  );
}
