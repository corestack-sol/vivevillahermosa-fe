'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MOTIVOS_ELIMINAR } from '@/lib/motivosCierre';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propertyTitle: string;
  onConfirm: (motivo: string, motivoDetalle?: string) => void;
}

/**
 * Compartido entre OwnerActionsBar (ficha pública) y /dashboard/propiedades.
 * Pide un motivo antes de eliminar — pedido explícito 2026-08-23: registrar
 * por qué una propiedad se elimina, para medir si la plataforma cumple su
 * propósito.
 */
export function EliminarPropiedadModal({ isOpen, onClose, propertyTitle, onConfirm }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Eliminar propiedad" maxWidth="sm">
      {/* Cuerpo solo montado mientras está abierto — mismo motivo que
          PausarPropiedadModal.tsx: sin esto, cancelar tras elegir un motivo
          lo dejaba pre-seleccionado la próxima vez que se abre. */}
      {isOpen && <EliminarConfirmBody propertyTitle={propertyTitle} onConfirm={onConfirm} onClose={onClose} />}
    </Modal>
  );
}

function EliminarConfirmBody({ propertyTitle, onConfirm, onClose }: Omit<Props, 'isOpen'>) {
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');

  function handleConfirmar() {
    if (!motivo) return;
    onConfirm(motivo, motivo === 'otro' ? detalle.trim() : undefined);
    onClose();
  }

  return (
    <>
      <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
        <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 leading-relaxed">
          <strong>{propertyTitle}</strong> se eliminará de tu panel. Esta acción no se puede deshacer.
        </p>
      </div>
      <p className="text-sm font-medium text-gray-700 mb-2">¿Por qué la eliminas?</p>
      <div className="space-y-2 mb-4">
        {MOTIVOS_ELIMINAR.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-red-300 transition-colors has-[:checked]:border-red-400 has-[:checked]:bg-red-50/60">
            <input type="radio" name="motivo-eliminar" value={opt.value} checked={motivo === opt.value}
              onChange={() => setMotivo(opt.value)} className="w-4 h-4 text-red-500 focus:ring-2 focus:ring-red-400/40" />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
      {motivo === 'otro' && (
        // maxLength: este motivo viaja como query param en el DELETE — sin
        // límite, un texto muy largo arriesga exceder límites reales de
        // longitud de URL en algún punto de la infraestructura.
        <Input placeholder="Cuéntanos brevemente" value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={200} className="mb-4" />
      )}
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button type="button" variant="danger" onClick={handleConfirmar} disabled={!motivo} className="flex-1 justify-center">
          Sí, eliminar
        </Button>
      </div>
    </>
  );
}
