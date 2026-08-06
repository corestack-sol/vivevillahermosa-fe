'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Compartido entre el menú del header y la sección de planes del home —
 * ambos disparan la misma acción, así que la lógica de activación vive en
 * un solo lugar. Ver docs/BACKEND.md sobre
 * por qué esto no cobra nada de verdad todavía.
 */
export function ActivarInmobiliariaModal({ isOpen, onClose }: Props) {
  const { refresh } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [activating, setActivating] = useState(false);

  async function handleConfirmar() {
    setActivating(true);
    try {
      const res = await fetch('/api/auth/activar-inmobiliaria', { method: 'POST' });
      if (!res.ok) throw new Error();
      await refresh();
      onClose();
      toast.success('Modo Inmobiliaria activado — bienvenido a tu panel profesional');
      router.push('/dashboard/propiedades');
    } catch {
      toast.error('No se pudo activar el modo Inmobiliaria. Intenta de nuevo.');
    } finally {
      setActivating(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Activar modo Inmobiliaria" maxWidth="sm">
      <p className="text-sm text-gray-600 leading-relaxed mb-5">
        Vive Villahermosa todavía no tiene cobro de pagos real — la plataforma está en desarrollo.
        Al confirmar, activamos el modo Inmobiliaria en tu cuenta sin ningún cargo, para que explores
        el panel profesional (Mis propiedades, estadísticas por anuncio, anuncios destacados).
      </p>
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button type="button" variant="primary" onClick={handleConfirmar} isLoading={activating} className="flex-1 justify-center">
          Confirmar activación
        </Button>
      </div>
    </Modal>
  );
}
