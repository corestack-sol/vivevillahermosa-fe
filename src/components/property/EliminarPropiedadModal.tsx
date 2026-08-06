'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propertyTitle: string;
  onConfirm: () => void;
}

/** Compartido entre OwnerActionsBar (ficha pública) y /dashboard/propiedades. */
export function EliminarPropiedadModal({ isOpen, onClose, propertyTitle, onConfirm }: Props) {
  function handleConfirmar() {
    onConfirm();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Eliminar propiedad" maxWidth="sm">
      <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
        <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 leading-relaxed">
          <strong>{propertyTitle}</strong> se eliminará de tu panel. Esta acción no se puede deshacer.
        </p>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button type="button" variant="danger" onClick={handleConfirmar} className="flex-1 justify-center">
          Sí, eliminar
        </Button>
      </div>
    </Modal>
  );
}
