'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, ImagePlus, Star, Flame } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { resizeImageToDataUrl } from '@/lib/imageResize';
import { backendFetch } from '@/lib/backendApi';
import { MUNICIPIO_OPTIONS } from '@/lib/publishSchema';

interface ColoniaFicha {
  id: string;
  slug: string;
  nombre: string;
  municipio: string;
  lat: number;
  lng: number;
  foto: string | null;
  destacada: boolean;
}

interface ColoniaPendiente {
  colonia: string;
  municipio: string | null;
  total: number;
}

interface FormState {
  id: string | null;
  nombre: string;
  municipio: string;
  lat: string;
  lng: string;
  foto: string | null;
  destacada: boolean;
}

const FORM_VACIO: FormState = {
  id: null,
  nombre: '',
  municipio: '',
  lat: '',
  lng: '',
  foto: null,
  destacada: false,
};

const inputClasses =
  'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-brand focus:ring-brand/40';

/**
 * BACKEND.md §9.3 — catálogo de colonias con ficha editorial, gestionado a
 * mano (Opción B: la curación sigue siendo una decisión humana, nunca
 * automática desde el ranking de demanda — ver AdminColoniasService en el
 * backend). La sección de "pendientes" es la señal que cierra ese loop: no
 * crea nada sola, solo le muestra al admin qué colonias con demanda real
 * (§9.1) todavía no tienen ficha, para decidir con datos en vez de a ciegas.
 */
export default function AdminZonasPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [colonias, setColonias] = useState<ColoniaFicha[]>([]);
  const [pendientes, setPendientes] = useState<ColoniaPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const [aBorrar, setABorrar] = useState<ColoniaFicha | null>(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [c, p] = await Promise.all([
      backendFetch<ColoniaFicha[]>('/admin/zonas/colonias').catch(() => []),
      backendFetch<ColoniaPendiente[]>('/admin/zonas/colonias/pendientes').catch(() => []),
    ]);
    setColonias(c);
    setPendientes(p);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirCrear(prefill?: { nombre: string; municipio: string | null }) {
    setForm({ ...FORM_VACIO, nombre: prefill?.nombre ?? '', municipio: prefill?.municipio ?? '' });
    setModalAbierto(true);
  }

  function abrirEditar(c: ColoniaFicha) {
    setForm({
      id: c.id,
      nombre: c.nombre,
      municipio: c.municipio,
      lat: String(c.lat),
      lng: String(c.lng),
      foto: c.foto,
      destacada: c.destacada,
    });
    setModalAbierto(true);
  }

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
      // Mismo patrón de subida en dos pasos que el portafolio de servicios
      // (dashboard/servicios/[id]/portafolio/page.tsx): redimensionar en el
      // navegador, subir a POST .../fotos (Cloudinary real), y solo guardar
      // la URL resultante — nunca base64 inline en la ficha.
      const resized = await resizeImageToDataUrl(file, 1200, 'image/jpeg', 0.82);
      const blob = await (await fetch(resized)).blob();
      const body = new FormData();
      body.append('file', blob, 'colonia.jpg');
      const { url } = await backendFetch<{ url: string }>('/admin/zonas/colonias/fotos', {
        method: 'POST',
        body,
      });
      setForm((f) => ({ ...f, foto: url }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir la foto.');
    } finally {
      setProcesandoImagen(false);
    }
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.municipio || !form.lat.trim() || !form.lng.trim()) {
      toast.error('Nombre, municipio, latitud y longitud son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const body = {
        nombre: form.nombre.trim(),
        municipio: form.municipio,
        lat: Number(form.lat),
        lng: Number(form.lng),
        foto: form.foto ?? undefined,
        destacada: form.destacada,
      };
      if (form.id) {
        await backendFetch(`/admin/zonas/colonias/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Ficha actualizada');
      } else {
        await backendFetch('/admin/zonas/colonias', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Ficha creada');
      }
      setModalAbierto(false);
      cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar, intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await backendFetch(`/admin/zonas/colonias/${aBorrar.id}`, { method: 'DELETE' });
      setABorrar(null);
      cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar, intenta de nuevo.');
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Colonias con ficha</h1>
          <p className="text-gray-500 text-sm">
            El catálogo editorial que alimenta /zonas/[slug] — foto y datos revisados a mano, no se crea solo desde el ranking de demanda.
          </p>
        </div>
        <Button size="sm" onClick={() => abrirCrear()}>
          <Plus size={15} /> Nueva ficha
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline" size={20} /></div>
      ) : (
        <>
          {pendientes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
              <h2 className="flex items-center gap-1.5 font-heading font-bold text-amber-800 text-sm mb-1">
                <Flame size={15} /> Con demanda alta, sin ficha todavía
              </h2>
              <p className="text-xs text-amber-700/80 mb-3">
                Colonias que la gente busca/ve/contacta seguido (últimos 7 días) pero que no tienen página propia — decide si vale la pena curar alguna.
              </p>
              <div className="space-y-2">
                {pendientes.map((p) => (
                  <div key={p.colonia} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-amber-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.colonia}</p>
                      <p className="text-xs text-gray-400">{p.municipio ?? 'Municipio sin resolver'} · {p.total} señal{p.total !== 1 ? 'es' : ''} de demanda</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => abrirCrear({ nombre: p.colonia, municipio: p.municipio })}>
                      Crear ficha
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {colonias.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin colonias con ficha todavía</div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Colonia</th>
                      <th className="text-left px-4 py-3 font-semibold">Municipio</th>
                      <th className="text-left px-4 py-3 font-semibold">Coordenadas</th>
                      <th className="text-left px-4 py-3 font-semibold">Destacada</th>
                      <th className="text-right px-4 py-3 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {colonias.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{c.nombre}</p>
                          <p className="text-xs text-gray-400">/zonas/{c.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.municipio}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{c.lat.toFixed(4)}, {c.lng.toFixed(4)}</td>
                        <td className="px-4 py-3">
                          {c.destacada && <Star size={14} className="text-amber-500 fill-amber-500" />}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => abrirEditar(c)}>
                              <Pencil size={12} /> Editar
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => setABorrar(c)}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={modalAbierto} onClose={() => setModalAbierto(false)} title={form.id ? 'Editar ficha' : 'Nueva ficha'}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre de la colonia</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className={inputClasses}
              placeholder="Tabasco 2000"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Municipio</label>
            <select
              value={form.municipio}
              onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))}
              className={inputClasses}
            >
              <option value="">Selecciona un municipio</option>
              {MUNICIPIO_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Latitud</label>
              <input
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                className={inputClasses}
                placeholder="17.9995"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Longitud</label>
              <input
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                className={inputClasses}
                placeholder="-92.9282"
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Foto</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
            {form.foto ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL de Cloudinary, mismo patrón que PropertyGallery.tsx */}
                <img src={form.foto} alt="Foto de la colonia" className="w-full h-32 object-cover rounded-xl" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={procesandoImagen}>
                  Cambiar foto
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={procesandoImagen}
                className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 hover:border-brand hover:bg-brand-pale rounded-xl text-gray-500 hover:text-brand transition-colors disabled:opacity-50"
              >
                {procesandoImagen ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
                <span className="text-xs font-semibold">{procesandoImagen ? 'Subiendo…' : 'Subir foto'}</span>
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.destacada}
              onChange={(e) => setForm((f) => ({ ...f, destacada: e.target.checked }))}
            />
            Destacada (prioridad más alta en sitemap.xml)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalAbierto(false)}>Cancelar</Button>
            <Button onClick={guardar} isLoading={guardando}>
              {form.id ? 'Guardar cambios' : 'Crear ficha'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!aBorrar} onClose={() => setABorrar(null)} title="Eliminar ficha">
        {aBorrar && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Vas a eliminar la ficha de <strong className="text-gray-800">{aBorrar.nombre}</strong>. Deja de tener página propia (/zonas/{aBorrar.slug}) — sus propiedades siguen viéndose en resultados de búsqueda.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setABorrar(null)}>Cancelar</Button>
              <Button variant="danger" onClick={eliminar} isLoading={borrando}>Eliminar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
