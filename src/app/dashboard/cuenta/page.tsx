'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserCog, KeyRound, ChevronRight, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Rectificar nombre/correo — derecho ARCO que promete /privacidad, pedido
 * explícito 2026-09-09 tras una auditoría real que encontró que no existía
 * ningún camino de autoservicio para esto (solo Cancelar — eliminar cuenta
 * — y cambiar contraseña eran reales).
 *
 * `PATCH /auth/me` confirmado real en vivo 2026-09-09 (cuenta de prueba
 * desechable): body `{ nombre?, email? }`, responde `{ user: {...} }` con
 * la misma forma que trae `AuthContext` (salvo `id` en vez de `userId`).
 * Rechaza con 400 si NINGÚN campo enviado difiere del valor actual
 * ("Envía un nombre o correo distinto al actual") — por eso solo se manda
 * lo que de verdad cambió, nunca el valor sin tocar, así nunca se golpea
 * ese caso por accidente.
 *
 * Correo VERIFICADO = bloqueado para siempre — decisión explícita
 * 2026-09-09: dejarlo editable libremente con solo la sesión iniciada es
 * una vía real de secuestro de cuenta (sesión robada sin la contraseña
 * podría cambiar el correo y tomar control). Un correo sin verificar
 * todavía SÍ se puede corregir (typo antes de haber confirmado nada) — la
 * restricción es específicamente sobre uno ya probado.
 */
export default function CuentaPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  // Snapshot de lo guardado — compara contra esto para saber qué campos
  // cambiaron de verdad (mismo patrón que dashboard/perfil/page.tsx).
  const [guardado, setGuardado] = useState({ nombre: '', email: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function cargarDatos() {
      if (!loading && !user) { router.push('/auth/login'); return; }
      if (user) {
        setNombre(user.nombre);
        setEmail(user.email);
        setGuardado({ nombre: user.nombre, email: user.email });
      }
    }
    cargarDatos();
  }, [user, loading, router]);

  const emailBloqueado = !!user?.emailVerificado;
  const cambioNombre = nombre.trim() !== guardado.nombre;
  // `!emailBloqueado &&` de más, no solo por defensa — el input queda
  // disabled cuando está bloqueado, así que en teoría `email` nunca se
  // mueve de `guardado.email` en ese caso, pero mejor que el propio botón
  // de guardar no dependa únicamente de que el campo esté deshabilitado.
  const cambioEmail = !emailBloqueado && email.trim() !== guardado.email;
  const hayCambios = cambioNombre || cambioEmail;

  async function handleGuardar() {
    if (!hayCambios || saving) return;
    setSaving(true);
    try {
      const { user: actualizado } = await backendFetch<{
        user: { nombre: string; email: string; emailVerificado: boolean };
      }>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          ...(cambioNombre && { nombre: nombre.trim() }),
          ...(cambioEmail && { email: email.trim() }),
        }),
      });
      setGuardado({ nombre: actualizado.nombre, email: actualizado.email });
      await refresh();
      if (cambioEmail && !actualizado.emailVerificado) {
        toast.info('Datos actualizados — revisa tu correo nuevo para confirmarlo.');
      } else {
        toast.success('Datos actualizados.');
      }
    } catch (err) {
      toast.error(err instanceof BackendApiError ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton variant="circle" className="w-6 h-6" />
          <Skeleton className="w-48" />
        </div>
        <Skeleton variant="image" className="w-full h-56 rounded-2xl" />
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
            <UserCog size={20} className="text-brand" /> Mis datos
          </h1>
          <p className="text-sm text-gray-500">Consulta y actualiza el nombre y correo de tu cuenta</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <Input
          label="Nombre completo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <div>
          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={emailBloqueado}
            className={emailBloqueado ? 'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed' : undefined}
            hint={emailBloqueado ? undefined : 'Al cambiarlo, tendrás que confirmarlo de nuevo.'}
          />
          {emailBloqueado && (
            <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-1.5">
              <Lock size={11} className="flex-shrink-0" />
              Ya está confirmado — por seguridad, no se puede cambiar desde aquí. Si perdiste acceso a este correo, contáctanos.
            </p>
          )}
        </div>
        <Button type="button" onClick={handleGuardar} disabled={!hayCambios} isLoading={saving}>
          Guardar cambios
        </Button>
      </div>

      {/* Pre-llena el correo — recuperar-password/page.tsx ya lee
          ?email= de la URL, no hace falta que la persona lo vuelva a
          escribir si ya está en su cuenta. */}
      <Link
        href={`/auth/recuperar-password?email=${encodeURIComponent(user.email)}`}
        className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mt-4 hover:border-brand/30 hover:shadow-md transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-pale flex items-center justify-center flex-shrink-0">
            <KeyRound size={16} className="text-brand" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Cambiar contraseña</p>
            <p className="text-xs text-gray-400">Te mandamos un enlace a tu correo para elegir una nueva</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
      </Link>
    </div>
  );
}
