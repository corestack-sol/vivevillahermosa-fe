'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, BellRing, BellOff, Plus, Trash2, ArrowLeft, Zap, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { Skeleton } from '@/components/ui/Skeleton';
import { MUNICIPIO_OPTIONS } from '@/lib/publishSchema';
import { obtenerEstadoPush, suscribirPush, desuscribirPush, type EstadoPush } from '@/lib/push';

const schema = z.object({
  municipio: z.string().optional(),
  tipo: z.string().optional(),
  operacion: z.enum(['venta', 'renta', '']).optional(),
  precioMax: z.string().optional(),
  dosBocas: z.boolean(),
  sinRiesgo: z.boolean(),
});
type FormData = z.infer<typeof schema>;

interface Alerta {
  id: string;
  municipio?: string | null;
  tipo?: string | null;
  operacion?: string | null;
  precioMax?: number | null;
  dosBocas: boolean;
  sinRiesgo: boolean;
  createdAt: string;
  expiraEn?: string | null;
}

const TIPO_OPTIONS = [
  { value: 'casa', label: 'Casa' },
  { value: 'departamento', label: 'Departamento' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'habitacion', label: 'Habitación / Roomie' },
];

export default function AlertasPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [fetching, setFetching] = useState(true);
  const [eliminando, setEliminando] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLDivElement>(null);
  // Push — pedido explícito 2026-09-02, ver docs/BACKEND-PUSH-
  // NOTIFICACIONES-02092026.md. 'inactivo' por default (no
  // 'no-soportado') para no mostrar "sin soporte" un instante antes de
  // que el efecto confirme el estado real.
  const [estadoPush, setEstadoPush] = useState<EstadoPush>('inactivo');
  const [cambiandoPush, setCambiandoPush] = useState(false);

  const { register, handleSubmit, reset, setFocus, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { dosBocas: false, sinRiesgo: false },
  });

  function irAlFormulario() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFocus('municipio');
  }

  useEffect(() => {
    if (!loading && !user) { router.push('/auth/login'); return; }
    if (!user) return;
    backendFetch<{ alertas: Alerta[] }>('/alertas')
      .then((d) => setAlertas(d.alertas ?? []))
      .finally(() => setFetching(false));
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    obtenerEstadoPush().then(setEstadoPush).catch(() => {});
  }, [user]);

  async function alternarPush() {
    setCambiandoPush(true);
    try {
      if (estadoPush === 'activo') {
        await desuscribirPush();
        setEstadoPush('inactivo');
        toast.success('Notificaciones push desactivadas.');
      } else {
        await suscribirPush();
        setEstadoPush('activo');
        toast.success('Notificaciones push activadas — te avisamos apenas haya una coincidencia.');
      }
    } catch (err) {
      // Notification.requestPermission() resuelto 'denied' llega aquí
      // como Error normal (suscribirPush lo lanza a propósito) — se
      // relee el estado real en vez de asumir, por si el navegador ya
      // había bloqueado el permiso desde antes de esta sesión.
      const real = await obtenerEstadoPush();
      setEstadoPush(real);
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el estado de las notificaciones push.');
    } finally {
      setCambiandoPush(false);
    }
  }

  async function onSubmit(data: FormData) {
    const body = {
      municipio: data.municipio || undefined,
      tipo: data.tipo || undefined,
      operacion: data.operacion || undefined,
      precioMax: data.precioMax ? Number(data.precioMax) : undefined,
      dosBocas: data.dosBocas,
      sinRiesgo: data.sinRiesgo,
    };
    // Sin ningún filtro, la alerta coincide con TODA publicación futura —
    // válido (alertaLabel ya contempla "Todas las propiedades"), pero
    // merece una confirmación explícita en vez de crearse con un clic.
    const vacia = !body.municipio && !body.tipo && !body.operacion && !body.precioMax && !body.dosBocas && !body.sinRiesgo;
    if (vacia && !window.confirm('No elegiste ningún filtro — esta alerta te avisará de TODAS las propiedades nuevas que se publiquen. ¿Crearla así?')) {
      return;
    }
    try {
      const d = await backendFetch<{ alerta: Alerta }>('/alertas', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAlertas((prev) => [d.alerta, ...prev]);
      reset();
      toast.success('Alerta creada — te avisaremos cuando haya coincidencias.');
    } catch {
      // Antes fallaba en silencio: el usuario no se enteraba si la alerta
      // no se guardó (ej. por rate limit o error del servidor).
      toast.error('No se pudo crear la alerta. Intenta de nuevo.');
    }
  }

  async function deleteAlerta(id: string) {
    // Un doble clic rápido antes disparaba un segundo DELETE sobre un id
    // ya borrado — el servidor lo rechazaba y el catch mostraba "no se
    // pudo eliminar" aunque el borrado original sí funcionó.
    if (eliminando.has(id)) return;
    setEliminando((prev) => new Set(prev).add(id));
    const previous = alertas;
    const removed  = previous.find((a) => a.id === id);
    setAlertas((prev) => prev.filter((a) => a.id !== id)); // optimista
    try {
      await backendFetch(`/alertas?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast.success('Alerta eliminada.', removed ? { label: 'Deshacer', onClick: () => restoreAlerta(removed) } : undefined);
    } catch {
      setAlertas(previous); // revertir
      toast.error('No se pudo eliminar la alerta. Intenta de nuevo.');
    } finally {
      setEliminando((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  // "Deshacer" recrea la alerta con los mismos criterios — el DELETE ya se
  // confirmó en el servidor, así que restaurar es un POST nuevo, no revertir
  // la misma fila (tendrá un id distinto, pero el mismo efecto para el usuario).
  async function restoreAlerta(a: Alerta) {
    try {
      const d = await backendFetch<{ alerta: Alerta }>('/alertas', {
        method: 'POST',
        body: JSON.stringify({
          municipio: a.municipio ?? undefined,
          tipo: a.tipo ?? undefined,
          operacion: a.operacion ?? undefined,
          precioMax: a.precioMax ?? undefined,
          dosBocas: a.dosBocas,
          sinRiesgo: a.sinRiesgo,
        }),
      });
      setAlertas((prev) => [d.alerta, ...prev]);
      toast.success('Alerta restaurada.');
    } catch (err) {
      toast.error(err instanceof BackendApiError ? err.message : 'No se pudo restaurar la alerta.');
    }
  }

  function alertaLabel(a: Alerta) {
    const parts: string[] = [];
    if (a.operacion) parts.push(a.operacion === 'renta' ? 'Renta' : 'Venta');
    if (a.tipo) parts.push(a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1));
    if (a.municipio) parts.push(a.municipio === 'Centro' ? 'Villahermosa' : a.municipio);
    if (a.precioMax) parts.push(`hasta $${a.precioMax.toLocaleString('es-MX')}`);
    if (a.dosBocas) parts.push('Dos Bocas');
    if (a.sinRiesgo) parts.push('zona segura');
    return parts.length ? parts.join(' · ') : 'Todas las propiedades';
  }

  if (loading || fetching) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton variant="circle" className="w-6 h-6" />
          <Skeleton className="w-40" />
        </div>
        <Skeleton variant="image" className="w-full h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-brand transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <Bell size={20} className="text-amber-500" /> Mis alertas
          </h1>
          <p className="text-sm text-gray-500">Recibe aviso cuando se publique la propiedad que buscas</p>
        </div>
      </div>

      {/* Notificaciones push — pedido explícito 2026-09-02. Solo se
          muestra si el navegador las soporta en absoluto ('no-soportado'
          se salta, no tiene sentido ofrecer un botón que nunca va a
          funcionar). 'denegado' no tiene botón — no hay nada que este
          código pueda hacer, el bloqueo vive en la configuración del
          navegador. */}
      {estadoPush !== 'no-soportado' && (
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 mb-8 ${
          estadoPush === 'activo' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'
        }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            estadoPush === 'activo' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
          }`}>
            {estadoPush === 'activo' ? <BellRing size={16} /> : <BellOff size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800">
              {estadoPush === 'activo' ? 'Notificaciones push activadas' : 'Activa las notificaciones push'}
            </p>
            <p className="text-xs text-gray-500">
              {estadoPush === 'denegado'
                ? 'Bloqueadas en la configuración de tu navegador — actívalas ahí para recibir avisos.'
                : estadoPush === 'activo'
                  ? 'Te avisamos en cuanto una propiedad coincida con alguna alerta, aunque no tengas la pestaña abierta.'
                  : 'Recibe el aviso al instante, sin depender del correo ni de tener la pestaña abierta.'}
            </p>
          </div>
          {estadoPush !== 'denegado' && (
            <button
              type="button"
              onClick={alternarPush}
              disabled={cambiandoPush}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-60 ${
                estadoPush === 'activo'
                  ? 'text-gray-500 border border-gray-200 hover:bg-gray-50'
                  : 'bg-brand text-white hover:bg-brand-dark'
              }`}
            >
              {cambiandoPush && <Loader2 size={13} className="animate-spin" />}
              {estadoPush === 'activo' ? 'Desactivar' : 'Activar'}
            </button>
          )}
        </div>
      )}

      {/* Form */}
      <div ref={formRef} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <Plus size={15} className="text-brand" /> Nueva alerta
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Municipio</label>
              <select {...register('municipio')}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-brand bg-white">
                <option value="">Cualquiera</option>
                {MUNICIPIO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select {...register('tipo')}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-brand bg-white">
                <option value="">Cualquier tipo</option>
                {TIPO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Operación</label>
              <select {...register('operacion')}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-brand bg-white">
                <option value="">Venta y renta</option>
                <option value="renta">Solo renta</option>
                <option value="venta">Solo venta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Precio máximo (MXN)</label>
              <input type="number" {...register('precioMax')} placeholder="Sin límite"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-brand" />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" {...register('dosBocas')} className="rounded text-brand" />
              <Zap size={14} className="text-gray-400" /> Cerca de Dos Bocas
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" {...register('sinRiesgo')} className="rounded text-brand" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" /> Solo zona segura
            </label>
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60">
            {isSubmitting ? 'Guardando...' : 'Crear alerta'}
          </button>
        </form>
      </div>

      {/* List */}
      {alertas.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <Bell size={40} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium mb-2">No tienes alertas activas todavía</p>
          <p className="text-gray-400 text-sm mb-6">Te avisamos por correo y en tu panel en cuanto se publique algo que coincida. Cada alerta dura 15 días.</p>
          <button type="button" onClick={irAlFormulario}
            className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-brand-dark transition-colors">
            <Plus size={15} /> Crear tu primera alerta
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{alertas.length} alerta{alertas.length > 1 ? 's' : ''} activa{alertas.length > 1 ? 's' : ''}</p>
          {alertas.map((a) => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-start justify-between gap-3 transition-all hover:border-brand/30 hover:shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bell size={14} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{alertaLabel(a)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Creada el {new Date(a.createdAt).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })}
                    {a.expiraEn && ` · expira el ${new Date(a.expiraEn).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })}`}
                  </p>
                </div>
              </div>
              <button onClick={() => deleteAlerta(a.id)} disabled={eliminando.has(a.id)}
                className="text-gray-300 hover:text-red-500 transition-colors p-1 flex-shrink-0 disabled:opacity-40">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
