'use client';

import { Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propertyTitle: string;
  onConfirm: () => void;
}

/**
 * Compartido entre OwnerActionsBar (ficha pública) y /dashboard/propiedades.
 * Antes tenía un selector de 7/15/30 días que nunca se enviaba al backend
 * (el DTO de PATCH /propiedades/:id no acepta ningún campo de expiración —
 * ver docs/BACKEND-DESTACAR-EXPIRACION-16092026.md). Se quitó el selector
 * falso: hoy "destacar" es un simple on/off sin vencimiento automático,
 * el usuario lo quita manualmente cuando quiera con "Quitar destacado".
 */
export function DestacarPropiedadModal({ isOpen, onClose, propertyTitle, onConfirm }: Props) {
  function handleConfirmar() {
    onConfirm();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Destacar propiedad" maxWidth="sm">
      <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-6">
        <Star size={16} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-sm text-brand-dark leading-relaxed">
          <strong>{propertyTitle}</strong> aparecerá marcada como destacada y se posicionará primero en
          los resultados de búsqueda. No tiene fecha de vencimiento automática todavía — se queda
          destacada hasta que tú mismo la quites desde el mismo botón.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button type="button" variant="primary" onClick={handleConfirmar} className="flex-1 justify-center">
          <Star size={15} /> Destacar
        </Button>
      </div>
    </Modal>
  );
}
