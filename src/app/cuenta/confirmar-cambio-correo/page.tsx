'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { backendFetch, BackendApiError } from '@/lib/backendApi';

const schema = z.object({
  password: z.string().min(10, 'Mínimo 10 caracteres'),
  confirmarPassword: z.string(),
}).refine((d) => d.password === d.confirmarPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmarPassword'],
});
type FormData = z.infer<typeof schema>;

const buttonLinkClass = 'inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm';

// Destino del enlace que el backend manda al correo NUEVO cuando un
// administrador aprueba una solicitud de recuperar-acceso (contrato en
// docs/BACKEND-RECUPERACION-CUENTA-18092026.md). Llega con un token de un
// solo uso en la URL — se lee UNA vez y se borra de la barra de direcciones
// de inmediato, para que no quede en el historial ni acompañe a ningún
// evento de analítica (PostHog adjunta la URL a cada clic; ver también
// lib/redactarUrl.ts, que lo censura por si algo se le escapa).
function ConfirmarCambioCorreoContent() {
  const searchParams = useSearchParams();
  const leido = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState('');
  const [enlaceInvalido, setEnlaceInvalido] = useState(false);

  useEffect(() => {
    function leerTokenUnaVez() {
      if (leido.current) return;
      leido.current = true;
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      setToken(searchParams.get('token') || hash.get('token') || null);
      setListo(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
    leerTokenUnaVez();
  }, [searchParams]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError('');
    try {
      await backendFetch('/cuenta/confirmar-cambio-correo', {
        method: 'POST',
        body: JSON.stringify({ token, password: data.password }),
      });
      setConfirmado(true);
    } catch (err) {
      if (err instanceof BackendApiError) {
        if (err.status === 400) { setEnlaceInvalido(true); return; }
        if (err.status === 409) {
          setError('Ese correo ya quedó asociado a otra cuenta. Escríbenos para revisarlo.');
          return;
        }
        if (err.status === 429) {
          setError('Demasiados intentos. Espera un momento e intenta de nuevo.');
          return;
        }
        setError(err.message);
        return;
      }
      setError('No se pudo confirmar el cambio. Revisa tu conexión e intenta de nuevo.');
    }
  }

  if (!listo) return null;

  if (confirmado) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-brand-pale rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={26} className="text-brand" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900 mb-2">Tu correo fue actualizado</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Por seguridad cerramos todas las sesiones abiertas. Inicia sesión con tu correo nuevo y la contraseña que acabas de crear.
        </p>
        <Link href="/auth/login" className={buttonLinkClass}>Iniciar sesión</Link>
      </div>
    );
  }

  if (!token || enlaceInvalido) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={26} className="text-amber-500" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900 mb-2">
          {token ? 'El enlace no es válido o ya venció' : 'Falta el enlace de confirmación'}
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Los enlaces de confirmación duran 24 horas y se pueden usar una sola vez. Abre el enlace directamente desde el correo que te mandamos, o solicita la recuperación de nuevo.
        </p>
        <Link href="/cuenta/recuperar-acceso" className={buttonLinkClass}>Solicitar de nuevo</Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="w-11 h-11 bg-brand-pale rounded-xl flex items-center justify-center mb-3">
          <MailCheck size={20} className="text-brand" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900">Confirma tu correo nuevo</h1>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          Aprobamos tu solicitud. Crea una contraseña nueva para terminar el cambio — la anterior ya no servirá.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Contraseña nueva"
          type="password"
          placeholder="Mínimo 10 caracteres"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirma tu contraseña nueva"
          type="password"
          placeholder="Repite tu contraseña"
          autoComplete="new-password"
          error={errors.confirmarPassword?.message}
          {...register('confirmarPassword')}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <Button type="submit" isLoading={isSubmitting} className="w-full justify-center">
          Confirmar cambio de correo
        </Button>
      </form>

      <Link href="/auth/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-brand mt-6">
        <ArrowLeft size={14} /> Ir a iniciar sesión
      </Link>
    </>
  );
}

export default function ConfirmarCambioCorreoPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <Suspense fallback={null}>
          <ConfirmarCambioCorreoContent />
        </Suspense>
      </div>
    </div>
  );
}
