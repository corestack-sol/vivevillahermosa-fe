'use client';

import { useState } from 'react';
import { PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MOTIVOS_PAUSA } from '@/lib/motivosCierre';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propertyTitle: string;
  onConfirm: (motivo: string, motivoDetalle?: string) => void;
}

/**
 * Antes pausar era un clic directo en el ícono, sin ningún paso intermedio
 * — a diferencia de reactivar (que se queda igual de directo, no necesita
 * explicarse). Pedido explícito 2026-08-23: registrar el motivo de la
 * pausa para poder medir después si la plataforma cumple su propósito.
 */
export function PausarPropiedadModal({ isOpen, onClose, propertyTitle, onConfirm }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pausar publicación" maxWidth="sm">
      {/* El cuerpo solo se monta mientras está abierto — así el motivo
          elegido se olvida en cada apertura (mismo patrón que
          EliminarCuentaModal.tsx). Sin esto, cancelar tras elegir un motivo
          y volver a abrir dejaba esa opción pre-seleccionada, invisible al
          usuario (que asume que empieza desde cero) hasta que confirma. */}
      {isOpen && <PausarConfirmBody propertyTitle={propertyTitle} onConfirm={onConfirm} onClose={onClose} />}
    </Modal>
  );
}

function PausarConfirmBody({ propertyTitle, onConfirm, onClose }: Omit<Props, 'isOpen'>) {
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');

  function handleConfirmar() {
    if (!motivo) return;
    onConfirm(motivo, motivo === 'otro' ? detalle.trim() : undefined);
    onClose();
  }

  return (
    <>
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
        <PauseCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-relaxed">
          <strong>{propertyTitle}</strong> dejará de recibir mensajes de contacto. Puedes reactivarla cuando quieras.
        </p>
      </div>
      <p className="text-sm font-medium text-gray-700 mb-2">¿Por qué pausas la publicación?</p>
      <div className="space-y-2 mb-4">
        {MOTIVOS_PAUSA.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-brand/40 transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-pale/40">
            <input type="radio" name="motivo-pausa" value={opt.value} checked={motivo === opt.value}
              onChange={() => setMotivo(opt.value)} className="w-4 h-4 text-brand focus:ring-2 focus:ring-brand/40" />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
      {motivo === 'otro' && (
        // maxLength: este motivo viaja como query param en el PATCH (ver
        // OwnerActionsBar.tsx/dashboard/propiedades/page.tsx) — sin límite,
        // un texto muy largo pegado aquí arriesga exceder límites reales de
        // longitud de URL en algún punto de la infraestructura.
        <Input placeholder="Cuéntanos brevemente" value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={200} className="mb-4" />
      )}
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button type="button" variant="primary" onClick={handleConfirmar} disabled={!motivo} className="flex-1 justify-center">
          Pausar publicación
        </Button>
      </div>
    </>
  );
}
