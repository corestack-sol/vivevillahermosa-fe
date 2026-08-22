'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { loginRedirectUrl } from '@/lib/authRedirect';
import { Button } from '@/components/ui/Button';
import { EliminarCuentaModal } from './EliminarCuentaModal';

export function EliminarCuentaSection() {
  const { user, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (loading) return null;

  if (!user) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
        <p className="text-sm text-gray-600 mb-4">Inicia sesión para solicitar la eliminación de tu cuenta.</p>
        <Link href={loginRedirectUrl('/privacidad')}
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
      <p className="text-sm text-gray-700 mb-1">
        Sesión actual: <strong>{user.email}</strong>
      </p>
      <p className="text-sm text-gray-600 mb-4">
        Al eliminar tu cuenta se borran de inmediato tus favoritos, tus alertas guardadas y tus notificaciones. Esta acción no se puede deshacer.
      </p>
      <Button type="button" variant="danger" onClick={() => setShowModal(true)}>
        <Trash2 size={15} /> Solicitar eliminación de mi cuenta
      </Button>

      <EliminarCuentaModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
