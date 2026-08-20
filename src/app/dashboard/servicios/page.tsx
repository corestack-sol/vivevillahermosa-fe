'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Eye, Trash2, Play, Pause, Wrench, Link2, Check, Camera } from 'lucide-react';
import { categoriaServicioLabel } from '@/lib/publishServicioSchema';
import { buttonClasses } from '@/components/ui/Button';
import { CardListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/context/ToastContext';
import { backendFetch } from '@/lib/backendApi';

interface MiServicio {
  id: string;
  categoria: string;
  nombre: string;
  descripcion: string;
  municipio: string;
  colonia: string | null;
  activo: boolean;
  createdAt: string;
}

// Fuera del componente y devolviendo la promesa (en vez de hacer setState
// ella misma) para poder usarla tanto en el efecto de carga inicial como
// en los handlers de acción con un simple `.then(setItems)` — mismo patrón
// que usePerfilInmobiliaria.ts, no una función async llamada directo
// dentro del cuerpo del efecto.
function fetchMisServicios(): Promise<MiServicio[]> {
  return backendFetch<MiServicio[]>('/servicios/mios').catch(() => []);
}

/**
 * "Mis servicios" — a diferencia de dashboard/propiedades (que simula sobre
 * localStorage porque Property.userId no existe), esto sí lee/escribe una
 * tabla real de Prisma directo, así que no hace falta ningún sistema de
 * overrides — el servidor ya es la fuente de verdad.
 */
export default function MisServiciosPage() {
  const toast = useToast();
  const [items, setItems] = useState<MiServicio[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  useEffect(() => {
    fetchMisServicios().then(setItems).catch(() => {});
  }, []);

  async function copiarLink(id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/servicios/${id}`);
      setCopiadoId(id);
      toast.success('Link copiado');
      setTimeout(() => setCopiadoId(null), 2000);
    } catch {
      toast.error('No se pudo copiar el link');
    }
  }

  async function togglePausa(id: string, activo: boolean) {
    setOcupado(id);
    await backendFetch(`/servicios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ activo: !activo }),
    }).catch(() => {});
    setItems(await fetchMisServicios());
    setOcupado(null);
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este servicio? No se puede deshacer.')) return;
    setOcupado(id);
    await backendFetch(`/servicios/${id}`, { method: 'DELETE' }).catch(() => {});
    setItems(await fetchMisServicios());
    setOcupado(null);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand mb-4">
        <ArrowLeft size={15} /> Volver al panel
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-gray-900">Mis servicios</h1>
        <Link href="/servicios/publicar" className={buttonClasses('secondary', 'md')}>
          <Plus size={16} /> Publicar servicio
        </Link>
      </div>

      {items === null ? (
        <CardListSkeleton rows={3} />
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Wrench size={32} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="text-gray-500 font-medium mb-1">Todavía no has publicado ningún servicio</p>
          <Link href="/servicios/publicar" className={buttonClasses('outline', 'sm')}>
            <Plus size={14} /> Publicar mi primer servicio
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-brand">{categoriaServicioLabel(s.categoria)}</span>
                  {!s.activo && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Pausado</span>
                  )}
                </div>
                <p className="font-semibold text-gray-800 text-sm truncate">{s.nombre}</p>
                <p className="text-xs text-gray-400 truncate">{s.colonia ? `${s.colonia}, ` : ''}{s.municipio}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Link
                  href={`/servicios/${s.id}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-brand hover:bg-brand-pale transition-colors"
                  title="Ver ficha pública"
                >
                  <Eye size={14} />
                </Link>
                <Link
                  href={`/dashboard/servicios/${s.id}/portafolio`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-brand hover:bg-brand-pale transition-colors"
                  title="Mi portafolio"
                >
                  <Camera size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => copiarLink(s.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-brand hover:bg-brand-pale transition-colors"
                  title="Copiar link"
                >
                  {copiadoId === s.id ? <Check size={14} /> : <Link2 size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => togglePausa(s.id, s.activo)}
                  disabled={ocupado === s.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-brand hover:bg-brand-pale transition-colors disabled:opacity-50"
                  title={s.activo ? 'Pausar' : 'Reactivar'}
                >
                  {s.activo ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => eliminar(s.id)}
                  disabled={ocupado === s.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
