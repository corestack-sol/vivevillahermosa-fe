'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propertyTitle: string;
  onConfirm: (dias: number) => void;
}

const OPCIONES_DIAS = [7, 15, 30];

/** Compartido entre OwnerActionsBar (ficha pública) y /dashboard/propiedades. */
export function DestacarPropiedadModal({ isOpen, onClose, propertyTitle, onConfirm }: Props) {
  const [dias, setDias] = useState(15);

  function handleConfirmar() {
    onConfirm(dias);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Destacar propiedad" maxWidth="sm">
      <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-5">
        <Star size={16} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-sm text-brand-dark leading-relaxed">
          <strong>{propertyTitle}</strong> aparecerá marcada como destacada en tu panel por el tiempo que
          elijas. Vista previa: cuando exista el backend real, esto también hará que aparezca primero en
          los resultados de búsqueda para otros usuarios.
        </p>
      </div>

      <p className="text-sm font-medium text-gray-700 mb-2">¿Por cuánto tiempo?</p>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {OPCIONES_DIAS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDias(d)}
            className={`border-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              dias === d ? 'border-brand bg-brand-pale text-brand' : 'border-gray-200 text-gray-500 hover:border-brand/40'
            }`}
          >
            {d} días
          </button>
        ))}
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
