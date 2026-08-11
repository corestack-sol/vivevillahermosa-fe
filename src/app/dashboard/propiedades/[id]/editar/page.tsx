'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button, buttonClasses } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { mapBackendProperty, type BackendPublicProperty } from '@/lib/api';
import {
  publishSchema, type PublishFormData, type MetodoContacto,
  TIPO_OPTIONS, MUNICIPIO_OPTIONS, METODO_CONTACTO_OPTIONS,
} from '@/lib/publishSchema';
import type { Property } from '@/types/property';

const OPERACION_OPTIONS = [
  { value: 'venta', label: 'Venta' },
  { value: 'renta', label: 'Renta' },
];

const RIESGO_OPTIONS = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
] as const;

/** Infiere qué eligió originalmente a partir de qué campos tiene guardados — no hay un `metodoContacto` persistido aparte. */
function inferirMetodoContacto(agente: Property['agente']): MetodoContacto {
  if (agente.tel && agente.email) return 'ambos';
  if (agente.email) return 'correo';
  return 'telefono';
}

export default function EditarPropiedadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  // undefined = todavía resolviendo en el efecto, null = no existe/no es tuya
  const [property, setProperty] = useState<Property | null | undefined>(undefined);

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<PublishFormData>({ resolver: zodResolver(publishSchema) });
  const tipoActual = watch('tipo');

  // GET /propiedades/:id con sesión (backendFetch manda la cookie sola)
  // devuelve la vista de dueño si el id es tuyo — 403/404 si no.
  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    backendFetch<BackendPublicProperty>(`/propiedades/${id}`)
      .then((bp) => { if (!cancelado) setProperty(mapBackendProperty(bp)); })
      .catch(() => { if (!cancelado) setProperty(null); });
    return () => { cancelado = true; };
  }, [id]);

  useEffect(() => {
    if (!property) return;
    reset({
      tipo: property.tipo,
      operacion: property.operacion,
      precio: property.precio,
      m2Construidos: property.m2Construidos,
      m2Terreno: property.m2Terreno,
      recamaras: property.recamaras,
      banos: property.banos,
      municipio: property.municipio,
      colonia: property.colonia,
      titulo: property.titulo,
      descripcion: property.descripcion,
      riesgoInundacion: property.riesgoInundacion,
      nombreContacto: property.agente.nombre,
      metodoContacto: inferirMetodoContacto(property.agente),
      telefonoContacto: property.agente.tel,
      emailContacto: property.agente.email,
      // Ya se aceptaron los Términos al publicar por primera vez — este
      // formulario de edición no los vuelve a pedir, pero el schema
      // compartido con PublishForm los sigue requiriendo para validar.
      aceptaTerminos: true,
    });
  }, [property, reset]);

  async function onSubmit(data: PublishFormData) {
    if (!property) return;
    // No se manda lat/lng — este formulario no tiene MapPicker, así que no
    // hay coordenada nueva que ofrecer. El backend recalcula
    // latPublico/lngPublico igual (cambiaUbicacion se dispara porque
    // `colonia` siempre viaja en el body), cayendo a la lat/lng real ya
    // guardada cuando no se manda una nueva (BACKEND.md §3, PATCH).
    try {
      await backendFetch(`/propiedades/${property.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          titulo: data.titulo,
          descripcion: data.descripcion,
          tipo: data.tipo,
          operacion: data.operacion,
          precio: data.precio,
          m2Construidos: data.m2Construidos || undefined,
          m2Terreno: data.m2Terreno || undefined,
          recamaras: data.recamaras || undefined,
          banos: data.banos || undefined,
          municipio: data.municipio,
          colonia: data.colonia,
          riesgoInundacion: data.riesgoInundacion,
          agenteNombre: data.nombreContacto,
          // A diferencia de PublishForm.tsx (construirAgenteContacto), aquí
          // sí hace falta mandar explícitamente `null` para el campo que ya
          // no aplica — si cambiaste de "Ambos" a "Solo correo", omitir la
          // clave (undefined) no la borraría del lado del servidor.
          agenteTel: data.metodoContacto !== 'correo' ? data.telefonoContacto : null,
          agenteEmail: data.metodoContacto !== 'telefono' ? data.emailContacto : null,
          agenteWhatsapp: data.metodoContacto !== 'correo' ? data.telefonoContacto : null,
        }),
      });
      toast.success('Propiedad actualizada.');
      router.push('/dashboard/propiedades');
    } catch (err) {
      toast.error(err instanceof BackendApiError ? err.message : 'No se pudo actualizar la propiedad.');
    }
  }

  if (property === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-[520px] rounded-3xl animate-shimmer" />
      </div>
    );
  }

  if (property === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-gray-500 mb-4">No encontramos esta propiedad en tu panel.</p>
        <Link href="/dashboard/propiedades" className="text-brand font-semibold hover:text-brand-dark">
          Volver a mis propiedades
        </Link>
      </div>
    );
  }

  const riesgoActual = watch('riesgoInundacion');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/propiedades" className="text-gray-400 hover:text-brand transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-gray-900">Editar propiedad</h1>
          <p className="text-sm text-gray-500 truncate">{property.titulo}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 md:p-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo de propiedad" options={TIPO_OPTIONS} error={errors.tipo?.message} {...register('tipo')} />
          <Select label="Operación" options={OPERACION_OPTIONS} error={errors.operacion?.message} {...register('operacion')} />
        </div>

        <Input label="Precio (MXN)" type="number" error={errors.precio?.message} {...register('precio', { valueAsNumber: true })} />

        {/* Antes ocultaba m² construidos/recámaras/baños por completo para
            "terreno" (mismo ajuste recién revertido en PublishForm.tsx) —
            un terreno puede venderse con una casa ya construida y el
            resto del lote disponible, así que sí necesita poder editar
            esos datos. "m² de terreno" faltaba por completo aquí, se
            agrega para terreno/bodega igual que en el formulario de
            publicar. */}
        {(tipoActual === 'terreno' || tipoActual === 'bodega') && (
          <Input label="m² de terreno" type="number" {...register('m2Terreno', { valueAsNumber: true })} />
        )}
        {tipoActual === 'terreno' && (
          <p className="text-xs text-gray-400">
            Si el terreno ya tiene una construcción (ej. una casa, con el resto del lote disponible), indícalo aquí. Si está vacío, déjalo en 0.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="m² construidos" type="number" {...register('m2Construidos', { valueAsNumber: true })} />
          <Input label="Recámaras" type="number" {...register('recamaras', { valueAsNumber: true })} />
        </div>
        <Input label="Baños" type="number" {...register('banos', { valueAsNumber: true })} />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Municipio" options={MUNICIPIO_OPTIONS} error={errors.municipio?.message} {...register('municipio')} />
          <Input label="Colonia" error={errors.colonia?.message} {...register('colonia')} />
        </div>

        <Input label="Título del anuncio" error={errors.titulo?.message} {...register('titulo')} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            rows={5}
            {...register('descripcion')}
            className={`w-full rounded-xl border bg-white text-gray-800 px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none ${errors.descripcion ? 'border-danger' : 'border-gray-200 focus:border-brand'}`}
          />
          {errors.descripcion && <p className="text-xs text-danger mt-1">{errors.descripcion.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Riesgo de inundación</label>
          <div className="grid grid-cols-3 gap-2">
            {RIESGO_OPTIONS.map(({ value, label }) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" value={value} {...register('riesgoInundacion')} className="sr-only" />
                <div className={`border-2 rounded-xl p-2.5 text-center text-xs font-semibold transition-colors ${
                  riesgoActual === value ? 'border-brand bg-brand-pale text-brand' : 'border-gray-200 text-gray-500 hover:border-brand/40'
                }`}>
                  {label}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-1 border-t border-gray-100" />
        <Input label="Nombre de contacto" error={errors.nombreContacto?.message} {...register('nombreContacto')} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">¿Cómo quieres que te contacten?</label>
          <div className="grid grid-cols-3 gap-2">
            {METODO_CONTACTO_OPTIONS.map((opt) => (
              <label key={opt.value} className="cursor-pointer">
                <input type="radio" value={opt.value} {...register('metodoContacto')} className="sr-only" />
                <div className={`border-2 rounded-xl p-2.5 text-center text-sm font-semibold transition-colors ${
                  watch('metodoContacto') === opt.value ? 'border-brand bg-brand-pale text-brand' : 'border-gray-200 text-gray-500 hover:border-brand/40'
                }`}>
                  {opt.label}
                </div>
              </label>
            ))}
          </div>
          {errors.metodoContacto && <p className="mt-1 text-xs text-danger">{errors.metodoContacto.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {watch('metodoContacto') !== 'correo' && (
            <Input label="Teléfono / WhatsApp" error={errors.telefonoContacto?.message} {...register('telefonoContacto')} />
          )}
          {watch('metodoContacto') !== 'telefono' && (
            <Input label="Correo electrónico" error={errors.emailContacto?.message} {...register('emailContacto')} />
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/propiedades" className={buttonClasses('outline', 'md', 'flex-1 justify-center')}>
            Cancelar
          </Link>
          <Button type="submit" variant="primary" isLoading={isSubmitting} className="flex-1 justify-center">
            <Save size={16} /> Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
