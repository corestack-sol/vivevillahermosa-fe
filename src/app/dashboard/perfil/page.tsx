'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Image as ImageIcon, Trash2, ShieldCheck, FileUp, Clock, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { backendFetch } from '@/lib/backendApi';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { resizeImageToDataUrl } from '@/lib/imageResize';
import { getEstadoVerificacion, solicitarVerificacion, type EstadoVerificacion } from '@/lib/verificacionDemo';

export default function PerfilInmobiliariaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fetching, setFetching] = useState(true);
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  // Snapshot de lo cargado/guardado del servidor — compara contra esto para
  // saber si hay cambios sin guardar. Estado, no ref: se lee durante el
  // render para calcular hayCambiosSinGuardar.
  const [guardado, setGuardado] = useState({ nombreEmpresa: '', logoDataUrl: null as string | null });
  const [saving, setSaving] = useState(false);
  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const [estadoVerificacion, setEstadoVerificacion] = useState<EstadoVerificacion>('sin_solicitar');
  const [documentoElegido, setDocumentoElegido] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) { router.push('/auth/login'); return; }
    if (!user) return;
    backendFetch<{ perfil: { nombreEmpresa: string | null; logoDataUrl: string | null } | null }>('/perfil-inmobiliaria')
      .then((d) => {
        const nombre = d.perfil?.nombreEmpresa ?? '';
        const logo = d.perfil?.logoDataUrl ?? null;
        setNombreEmpresa(nombre);
        setLogoDataUrl(logo);
        setGuardado({ nombreEmpresa: nombre, logoDataUrl: logo });
      })
      .finally(() => setFetching(false));
  }, [user, loading, router]);

  const hayCambiosSinGuardar = nombreEmpresa !== guardado.nombreEmpresa || logoDataUrl !== guardado.logoDataUrl;

  // Sin esto, subir un logo nuevo o editar el nombre y luego cerrar la
  // pestaña/recargar descartaba los cambios en silencio, sin ningún aviso
  // — a diferencia de PublishForm, este formulario no tenía ninguna
  // protección.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!hayCambiosSinGuardar) return;
      e.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hayCambiosSinGuardar]);

  // El estado de verificación solo existe en localStorage — se resuelve en
  // un efecto para que el primer render coincida con el del servidor.
  useEffect(() => {
    function aplicar() {
      setEstadoVerificacion(getEstadoVerificacion());
    }
    aplicar();
  }, []);

  function handleSolicitarVerificacion() {
    solicitarVerificacion();
    setEstadoVerificacion('en_revision');
    toast.success('Solicitud registrada.');
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Elige un archivo de imagen (PNG, JPG o WebP).');
      return;
    }
    setProcesandoImagen(true);
    try {
      const resized = await resizeImageToDataUrl(file, 320);
      setLogoDataUrl(resized);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo procesar la imagen. Intenta con otro archivo.';
      toast.error(mensaje);
    } finally {
      setProcesandoImagen(false);
    }
  }

  async function handleGuardar() {
    setSaving(true);
    try {
      await backendFetch('/perfil-inmobiliaria', {
        method: 'PUT',
        body: JSON.stringify({ nombreEmpresa: nombreEmpresa.trim() || null, logoDataUrl }),
      });
      setGuardado({ nombreEmpresa, logoDataUrl });
      toast.success('Perfil de la inmobiliaria actualizado.');
    } catch {
      toast.error('No se pudo guardar el perfil. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || fetching) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton variant="circle" className="w-6 h-6" />
          <Skeleton className="w-48" />
        </div>
        <Skeleton variant="image" className="w-full h-72 rounded-2xl" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-brand transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={20} className="text-brand" /> Perfil de la inmobiliaria
          </h1>
          <p className="text-sm text-gray-500">Tu nombre comercial y logo aparecen en tus reportes descargables</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <Input
          label="Nombre comercial"
          placeholder="Ej. Inmobiliaria Tabasco Premium"
          value={nombreEmpresa}
          onChange={(e) => setNombreEmpresa(e.target.value)}
          hint="Si lo dejas vacío, tus reportes usan tu nombre de cuenta."
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URI local, no aplica optimización de next/image
                <img src={logoDataUrl} alt="Logo de la inmobiliaria" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon size={24} className="text-gray-300" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} isLoading={procesandoImagen}>
                {logoDataUrl ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              {logoDataUrl && (
                <button
                  type="button"
                  onClick={() => setLogoDataUrl(null)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={12} /> Quitar logo
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">PNG, JPG o WebP. Se ajusta automáticamente a 320×320px.</p>
        </div>

        <div className="pt-2 border-t border-gray-100 flex items-center gap-3">
          <Button type="button" onClick={handleGuardar} isLoading={saving}>
            Guardar cambios
          </Button>
          {hayCambiosSinGuardar && !saving && (
            <span className="text-xs text-amber-600">Tienes cambios sin guardar</span>
          )}
        </div>
      </div>

      {/* Verificación de agencia — vista previa, ver src/lib/verificacionDemo.ts */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-6">
        <h2 className="flex items-center gap-2 text-base font-heading font-bold text-gray-900 mb-1">
          <ShieldCheck size={18} className="text-brand" /> Verificación de agencia
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Un perfil verificado le da más confianza a quien busca contactarte.
        </p>

        {estadoVerificacion === 'en_revision' ? (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Clock size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              <strong>Tu solicitud quedó registrada.</strong> Vista previa: la revisión real de documentos
              (RFC, constancia de situación fiscal) se activará junto con el backend — por ahora este estado
              solo se guarda en este navegador.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <input
                ref={docInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => setDocumentoElegido(e.target.files?.[0]?.name ?? null)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()}>
                <FileUp size={14} /> {documentoElegido ? 'Cambiar documento' : 'Subir documento'}
              </Button>
              {documentoElegido && <span className="text-xs text-gray-500 truncate">{documentoElegido}</span>}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              RFC o constancia de situación fiscal de tu inmobiliaria. En esta vista previa el archivo no se
              envía a ningún lado real — solo se valida que hayas elegido uno.
            </p>
            <Button type="button" onClick={handleSolicitarVerificacion} disabled={!documentoElegido}>
              Solicitar verificación
            </Button>
          </>
        )}
      </div>

      {/* Equipo — vista previa, ver src/lib/equipoDemo.ts */}
      <Link href="/dashboard/equipo"
        className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 mt-6 hover:border-brand/30 hover:shadow-sm transition-all">
        <div className="w-10 h-10 bg-brand-pale rounded-xl flex items-center justify-center flex-shrink-0">
          <Users size={18} className="text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Gestionar equipo</p>
          <p className="text-xs text-gray-500">Invita a los agentes de tu inmobiliaria</p>
        </div>
        <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
      </Link>
    </div>
  );
}
