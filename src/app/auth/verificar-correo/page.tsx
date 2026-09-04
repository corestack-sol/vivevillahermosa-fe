'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, MailCheck } from 'lucide-react';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { useAuth } from '@/context/AuthContext';

type Estado = 'verificando' | 'exito' | 'error';

function VerificarCorreoContent() {
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const token = searchParams.get('token');
  const [estado, setEstado] = useState<Estado>('verificando');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      function marcarSinToken() {
        setEstado('error');
        setError('Este enlace no trae un token válido.');
      }
      marcarSinToken();
      return;
    }
    let cancelado = false;
    backendFetch('/auth/verificar-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(() => {
        if (cancelado) return;
        setEstado('exito');
        // Refresca el AuthUser en memoria — si la persona ya tenía sesión
        // iniciada, el banner de "correo sin verificar" desaparece sin
        // necesidad de recargar la página.
        refresh();
      })
      .catch((err) => {
        if (cancelado) return;
        setEstado('error');
        setError(err instanceof BackendApiError ? err.message : 'No se pudo verificar tu correo. El enlace puede haber expirado.');
      });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (estado === 'verificando') {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-brand-pale rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Loader2 size={26} className="text-brand animate-spin" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900 mb-2">Verificando tu correo...</h1>
      </div>
    );
  }

  if (estado === 'exito') {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-brand-pale rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={26} className="text-brand" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900 mb-2">Correo verificado</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">Ya puedes usar tu cuenta con normalidad.</p>
        <Link href="/dashboard" className={buttonLinkClass}>Ir a mi panel</Link>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <XCircle size={26} className="text-red-500" />
      </div>
      <h1 className="text-xl font-heading font-bold text-gray-900 mb-2">No pudimos verificar tu correo</h1>
      <p className="text-sm text-gray-500 leading-relaxed mb-6">{error}</p>
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <MailCheck size={14} />
        Pide un enlace nuevo desde <Link href="/dashboard" className="text-brand font-semibold hover:underline">tu panel</Link>.
      </div>
    </div>
  );
}

const buttonLinkClass = 'inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm';

export default function VerificarCorreoPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <Suspense fallback={null}>
          <VerificarCorreoContent />
        </Suspense>
      </div>
    </div>
  );
}
