'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { loginRedirectUrl } from '@/lib/authRedirect';
import { backendFetch } from '@/lib/backendApi';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export function EliminarCuentaSection() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmar() {
    setDeleting(true);
    try {
      await backendFetch('/auth/cuenta', { method: 'DELETE' });
      await logout();
      setShowModal(false);
      toast.success('Tu cuenta fue eliminada. Lamentamos verte ir.');
      router.push('/');
    } catch {
      toast.error('No se pudo eliminar tu cuenta. Intenta de nuevo.');
    } finally {
      setDeleting(false);
    }
  }

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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Eliminar tu cuenta" maxWidth="sm">
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            Esta acción es <strong>inmediata y no se puede deshacer</strong>. Se eliminan tu cuenta, tus favoritos, tus alertas y tus notificaciones.
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={() => setShowModal(false)} className="flex-1 justify-center">
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirmar} isLoading={deleting} className="flex-1 justify-center">
            Sí, eliminar mi cuenta
          </Button>
        </div>
      </Modal>
    </div>
  );
}
