'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserCog, KeyRound, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Rectificar nombre/correo — derecho ARCO que promete /privacidad, pedido
 * explícito 2026-09-09 tras una auditoría real que encontró que no existía
 * ningún camino de autoservicio para esto (solo Cancelar — eliminar cuenta
 * — y cambiar contraseña eran reales).
 *
 * El backend TODAVÍA NO tiene el endpoint (`PATCH /auth/me`, confirmado en
 * vivo con cuenta de prueba desechable: 4 variantes probadas, las 4 dan 404
 * de ruta inexistente — ver docs/BACKEND-RECTIFICAR-DATOS-09092026.md).
 * Por eso "Guardar cambios" todavía no llama a ningún backendFetch — solo
 * avisa que falta conectarse, mismo patrón que `pendiente()` en
 * OwnerActionsBar.tsx. El día que el endpoint exista, reemplazar
 * `handleGuardar` por la llamada real y actualizar `AuthContext` (refresh())
 * para reflejar el cambio sin recargar la página — el resto de la pantalla
 * (inputs, validación básica) ya queda listo.
 */
export default function CuentaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    function cargarDatos() {
      if (!loading && !user) { router.push('/auth/login'); return; }
      if (user) {
        setNombre(user.nombre);
        setEmail(user.email);
      }
    }
    cargarDatos();
  }, [user, loading, router]);

  function handleGuardar() {
    toast.info('Guardar cambios estará disponible en cuanto el backend tenga el endpoint real para actualizar tu cuenta.');
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
        <Input
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="Al cambiarlo probablemente necesites confirmarlo de nuevo."
        />
        <Button type="button" onClick={handleGuardar}>
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
