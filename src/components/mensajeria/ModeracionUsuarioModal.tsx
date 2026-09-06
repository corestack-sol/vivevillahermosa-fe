'use client';

import { useState } from 'react';
import { Ban, Flag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MOTIVOS_BLOQUEO, MOTIVOS_REPORTE_USUARIO } from '@/lib/motivosModeracionUsuario';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accion: 'bloquear' | 'reportar';
  nombrePersona: string;
  onConfirm: (motivo: string, motivoDetalle: string | undefined, tambienBloquear: boolean) => void;
}

/**
 * Modal de motivo compartido entre "bloquear" y "reportar" — pedido
 * explícito 2026-09-07: opciones predefinidas + campo libre cuando el
 * motivo es "otro". Mismo patrón que PausarPropiedadModal.tsx
 * (radio + Input condicional), pero para moderar a una PERSONA en un
 * chat, no a una propiedad. Ver docs/BACKEND-BLOQUEO-REPORTE-USUARIOS-
 * 07092026.md — el backend para esto todavía no existe.
 */
export function ModeracionUsuarioModal({ isOpen, onClose, accion, nombrePersona, onConfirm }: Props) {
  const titulo = accion === 'bloquear' ? `Bloquear a ${nombrePersona}` : `Reportar a ${nombrePersona}`;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titulo} maxWidth="sm">
      {/* Solo se monta mientras está abierto, mismo motivo que
          PausarPropiedadModal.tsx: que no quede un motivo pre-seleccionado
          de una apertura anterior. */}
      {isOpen && <ModeracionBody accion={accion} nombrePersona={nombrePersona} onConfirm={onConfirm} onClose={onClose} />}
    </Modal>
  );
}

function ModeracionBody({ accion, nombrePersona, onConfirm, onClose }: Omit<Props, 'isOpen'>) {
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [tambienBloquear, setTambienBloquear] = useState(false);
  const opciones = accion === 'bloquear' ? MOTIVOS_BLOQUEO : MOTIVOS_REPORTE_USUARIO;

  function handleConfirmar() {
    if (!motivo) return;
    onConfirm(motivo, motivo === 'otro' ? detalle.trim() : undefined, tambienBloquear);
    onClose();
  }

  return (
    <>
      <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
        {accion === 'bloquear' ? <Ban size={16} className="text-red-600 flex-shrink-0 mt-0.5" /> : <Flag size={16} className="text-red-600 flex-shrink-0 mt-0.5" />}
        <p className="text-sm text-red-800 leading-relaxed">
          {accion === 'bloquear' ? (
            <><strong>{nombrePersona}</strong> ya no podrá mandarte mensajes. Puedes desbloquear cuando quieras.</>
          ) : (
            <>Un administrador va a revisar tu reporte sobre <strong>{nombrePersona}</strong>.</>
          )}
        </p>
      </div>

      <p className="text-sm font-medium text-gray-700 mb-2">¿Cuál es el motivo?</p>
      <div className="space-y-2 mb-4">
        {opciones.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-brand/40 transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-pale/40">
            <input
              type="radio"
              name="motivo-moderacion"
              value={opt.value}
              checked={motivo === opt.value}
              onChange={() => setMotivo(opt.value)}
              className="w-4 h-4 text-brand focus:ring-2 focus:ring-brand/40"
            />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>

      {motivo === 'otro' && (
        <Input placeholder="Cuéntanos brevemente" value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={200} className="mb-4" />
      )}

      {accion === 'reportar' && (
        <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={tambienBloquear}
            onChange={(e) => setTambienBloquear(e.target.checked)}
            className="w-4 h-4 text-brand rounded focus:ring-2 focus:ring-brand/40"
          />
          <span className="text-sm text-gray-700">También bloquear a esta persona</span>
        </label>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button type="button" variant="primary" onClick={handleConfirmar} disabled={!motivo} className="flex-1 justify-center">
          {accion === 'bloquear' ? 'Bloquear' : 'Enviar reporte'}
        </Button>
      </div>
    </>
  );
}
