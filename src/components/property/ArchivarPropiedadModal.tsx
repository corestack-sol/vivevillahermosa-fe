'use client';

import { Archive } from 'lucide-react';
import type { OperationType } from '@/types/property';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propertyTitle: string;
  operacion: OperationType;
  onConfirm: () => void;
}

/**
 * Compartido entre OwnerActionsBar (ficha pública) y /dashboard/propiedades
 * — ambos disparan la misma acción de archivar. A diferencia de
 * pausar/reactivar (reversible con un clic), archivar deja un registro de
 * una operación cerrada, así que pide confirmación explícita en vez de
 * cambiar de estado directo con el ícono.
 */
export function ArchivarPropiedadModal({ isOpen, onClose, propertyTitle, operacion, onConfirm }: Props) {
  const etiqueta = operacion === 'venta' ? 'vendida' : 'rentada';

  function handleConfirmar() {
    onConfirm();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Marcar como ${etiqueta}`} maxWidth="sm">
      <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-5">
        <Archive size={16} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-sm text-brand-dark leading-relaxed">
          <strong>{propertyTitle}</strong> se marcará como <strong>{etiqueta}</strong>. Dejará de recibir mensajes de
          contacto y se ocultará su información de contacto, pero se conserva en tu panel como registro de la
          operación. Puedes reactivarla después si fue un error.
        </p>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button type="button" variant="primary" onClick={handleConfirmar} className="flex-1 justify-center">
          Marcar como {etiqueta}
        </Button>
      </div>
    </Modal>
  );
}
