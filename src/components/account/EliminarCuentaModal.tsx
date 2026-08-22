'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { backendFetch } from '@/lib/backendApi';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface EliminarCuentaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Confirmación + borrado real, extraído de EliminarCuentaSection.tsx
 * (/privacidad) para que el menú de usuario (Navbar.tsx) pueda ofrecer el
 * mismo camino sin duplicar la llamada al backend — un solo lugar que de
 * verdad borra la cuenta, dos puntos de entrada a la misma confirmación.
 */
export function EliminarCuentaModal({ isOpen, onClose }: EliminarCuentaModalProps) {
  const { logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmar() {
    setDeleting(true);
    try {
      await backendFetch('/auth/cuenta', { method: 'DELETE' });
      await logout();
      onClose();
      toast.success('Tu cuenta fue eliminada. Lamentamos verte ir.');
      router.push('/');
    } catch {
      toast.error('No se pudo eliminar tu cuenta. Intenta de nuevo.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Eliminar tu cuenta" maxWidth="sm">
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-relaxed">
          Esta acción es <strong>inmediata y no se puede deshacer</strong>. Se eliminan tu cuenta, tus favoritos, tus alertas y tus notificaciones.
        </p>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button type="button" variant="danger" onClick={handleConfirmar} isLoading={deleting} className="flex-1 justify-center">
          Sí, eliminar mi cuenta
        </Button>
      </div>
    </Modal>
  );
}
