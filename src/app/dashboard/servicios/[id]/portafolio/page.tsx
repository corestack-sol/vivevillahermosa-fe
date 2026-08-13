'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ImagePlus, Trash2, Loader2, Camera, ShieldAlert } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { resizeImageToDataUrl } from '@/lib/imageResize';
import { backendFetch } from '@/lib/backendApi';
import type { TrabajoServicio as Trabajo } from '@/lib/api';

function fetchTrabajos(servicioId: string): Promise<Trabajo[]> {
  return backendFetch<Trabajo[]>(`/servicios/${servicioId}/trabajos`).catch(() => []);
}

// undefined = todavía resolviendo, null = no es tuyo (o no existe) — mismo
// patrón que dashboard/propiedades/[id]/editar/page.tsx, para no mostrar el
// formulario de edición a alguien que solo tiene el id en la URL.
function fetchNombreServicio(servicioId: string): Promise<string | null> {
  return backendFetch<{ id: string; nombre: string }[]>('/servicios/mios')
    .catch(() => [])
    .then((mios) => mios.find((s) => s.id === servicioId)?.nombre ?? null);
}

/**
 * Portafolio del proveedor — pensado como una carta de presentación que se
 * va llenando poco a poco: sube una foto de un trabajo hoy, otra la próxima
 * semana, sin necesidad de terminar todo de una sola vez. El texto de cada
 * entrada es opcional (hay proveedores que solo quieren mostrar la foto).
 */
export default function PortafolioPage() {
  const params = useParams<{ id: string }>();
  const servicioId = params.id;
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState<string | null | undefined>(undefined);
  const [trabajos, setTrabajos] = useState<Trabajo[] | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrabajos(servicioId).then(setTrabajos).catch(() => setTrabajos([]));
    fetchNombreServicio(servicioId).then(setNombre).catch(() => {});
  }, [servicioId]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Elige un archivo de imagen (PNG, JPG o WebP).');
      return;
    }
    setProcesandoImagen(true);
    try {
      const resized = await resizeImageToDataUrl(file, 1200, 'image/jpeg', 0.82);
      setPreviewDataUrl(resized);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo procesar la imagen.');
    } finally {
      setProcesandoImagen(false);
    }
  }

  async function agregarTrabajo() {
    if (!previewDataUrl) return;
    setSubiendo(true);
    try {
      // Misma subida en dos pasos que PublishForm.tsx (propiedades): la
      // imagen va primero a POST /servicios/fotos (multipart, Cloudinary
      // real), y solo la URL resultante se manda al crear la entrada del
      // portafolio — TrabajoServicio.imagen ya no guarda base64 inline.
      const blob = await (await fetch(previewDataUrl)).blob();
      const body = new FormData();
      body.append('file', blob, 'trabajo.jpg');
      const { url } = await backendFetch<{ url: string }>('/servicios/fotos', {
        method: 'POST',
        body,
      });

      await backendFetch(`/servicios/${servicioId}/trabajos`, {
        method: 'POST',
        body: JSON.stringify({ imagen: url, descripcion }),
      });
      setPreviewDataUrl(null);
      setDescripcion('');
      setTrabajos(await fetchTrabajos(servicioId));
      toast.success('Agregado a tu portafolio');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar, intenta de nuevo.');
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminarTrabajo(id: string) {
    if (!confirm('¿Quitar esta entrada de tu portafolio?')) return;
    setEliminandoId(id);
    try {
      await backendFetch(`/servicios/${servicioId}/trabajos/${id}`, { method: 'DELETE' });
      setTrabajos(await fetchTrabajos(servicioId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar, intenta de nuevo.');
    } finally {
      setEliminandoId(null);
    }
  }

  if (nombre === undefined) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex justify-center">
        <Loader2 className="animate-spin text-brand" size={22} />
      </div>
    );
  }

  if (nombre === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <ShieldAlert size={28} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
        <p className="text-gray-500 mb-4">No tienes permiso para administrar este portafolio.</p>
        <Link href="/dashboard/servicios" className={buttonClasses('outline', 'sm')}>Volver a mis servicios</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/dashboard/servicios" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand mb-4">
        <ArrowLeft size={15} /> Volver a mis servicios
      </Link>

      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Mi portafolio</h1>
      <p className="text-sm text-gray-500 mb-6">
        {nombre ? `${nombre} — ` : ''}tu carta de presentación: sube fotos de tus trabajos y, si quieres, cuenta la historia detrás de cada una. Puedes agregar entradas cuando quieras, no hace falta terminarlo hoy.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />

        {previewDataUrl ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI local, no aplica next/image */}
            <img src={previewDataUrl} alt="Vista previa" className="w-full max-h-72 object-cover rounded-xl" />
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              maxLength={700}
              placeholder="Cuenta la historia de este trabajo (opcional) — qué se hizo, dónde, algún detalle que te enorgullezca…"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-brand focus:ring-brand/40 resize-none"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="md" onClick={() => { setPreviewDataUrl(null); setDescripcion(''); }} disabled={subiendo}>
                Cancelar
              </Button>
              <Button size="md" className="flex-1" onClick={agregarTrabajo} isLoading={subiendo}>
                Agregar al portafolio
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={procesandoImagen}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-gray-200 hover:border-brand hover:bg-brand-pale rounded-xl text-gray-500 hover:text-brand transition-colors disabled:opacity-50"
          >
            {procesandoImagen ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}
            <span className="text-sm font-semibold">{procesandoImagen ? 'Procesando imagen…' : 'Subir foto de un trabajo'}</span>
          </button>
        )}
      </div>

      {trabajos === null ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand" size={22} /></div>
      ) : trabajos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <Camera size={28} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="text-gray-500 text-sm">Todavía no has agregado ningún trabajo a tu portafolio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {trabajos.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL de Cloudinary, mismo patrón que PropertyGallery.tsx */}
              <img src={t.imagen} alt={t.descripcion ?? 'Trabajo realizado'} loading="lazy" className="w-full h-44 object-cover" />
              <div className="p-3">
                {t.descripcion && <p className="text-sm text-gray-700 whitespace-pre-line mb-2">{t.descripcion}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">{new Date(t.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <button
                    type="button"
                    onClick={() => eliminarTrabajo(t.id)}
                    disabled={eliminandoId === t.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
