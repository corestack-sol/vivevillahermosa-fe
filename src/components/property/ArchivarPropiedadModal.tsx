'use client';

import { useState } from 'react';
import { Archive, Check, X as XIcon, MessageCircle } from 'lucide-react';
import type { OperationType } from '@/types/property';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MEDIOS_ALTERNOS } from '@/lib/motivosCierre';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propertyTitle: string;
  operacion: OperationType;
  onConfirm: (encontradoEnPlataforma: boolean, medioAlterno?: string, medioAlternoDetalle?: string) => void;
  // Conteo real de GET /propiedades/:id/contacto para esta propiedad —
  // opcional a propósito: el backend todavía no lo manda (ver
  // docs/BACKEND-MOTIVOS-CIERRE-23082026.md §5), así que hoy siempre es
  // undefined y el hint de abajo simplemente no aparece. Cuando exista,
  // se muestra ANTES de la pregunta para anclar la respuesta a un dato
  // real en vez de solo la memoria del dueño (el hueco más grande de esta
  // pregunta: confundir "dónde encontró al interesado" con "dónde
  // terminaron hablando", casi siempre WhatsApp).
  contactosReales?: number;
}

/**
 * Compartido entre OwnerActionsBar (ficha pública) y /dashboard/propiedades
 * — ambos disparan la misma acción de archivar. A diferencia de
 * pausar/reactivar (reversible con un clic), archivar deja un registro de
 * una operación cerrada, así que pide confirmación explícita en vez de
 * cambiar de estado directo con el ícono.
 *
 * La pregunta de atribución ("¿la encontraste a través de la plataforma?")
 * es la más importante de las tres (pausar/eliminar/archivar) para medir
 * si Vive Villahermosa cumple su propósito — pedido explícito 2026-08-23.
 */
export function ArchivarPropiedadModal({ isOpen, onClose, propertyTitle, operacion, onConfirm, contactosReales }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Marcar como ${operacion === 'venta' ? 'vendida' : 'rentada'}`} maxWidth="sm">
      {/* Cuerpo solo montado mientras está abierto — mismo motivo que
          PausarPropiedadModal.tsx: sin esto, cancelar tras contestar
          Sí/No + medio lo dejaba pre-seleccionado la próxima vez. */}
      {isOpen && (
        <ArchivarConfirmBody propertyTitle={propertyTitle} operacion={operacion} onConfirm={onConfirm} onClose={onClose} contactosReales={contactosReales} />
      )}
    </Modal>
  );
}

function ArchivarConfirmBody({ propertyTitle, operacion, onConfirm, onClose, contactosReales }: Omit<Props, 'isOpen'>) {
  const etiqueta = operacion === 'venta' ? 'vendida' : 'rentada';
  const [encontrado, setEncontrado] = useState<boolean | null>(null);
  const [medio, setMedio] = useState('');
  const [detalle, setDetalle] = useState('');

  function handleConfirmar() {
    if (encontrado === null) return;
    if (encontrado) {
      onConfirm(true);
    } else {
      if (!medio) return;
      onConfirm(false, medio, medio === 'otro' ? detalle.trim() : undefined);
    }
    onClose();
  }

  const puedeConfirmar = encontrado === true || (encontrado === false && !!medio);

  return (
    <>
      <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-4">
        <Archive size={16} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-sm text-brand-dark leading-relaxed">
          <strong>{propertyTitle}</strong> se marcará como <strong>{etiqueta}</strong>. Dejará de recibir mensajes de
          contacto, pero se conserva en tu panel como registro de la operación.
        </p>
      </div>

      {/* Se muestra solo cuando el backend manda el dato real (todavía no
          lo hace) — ancla la respuesta a un hecho concreto en vez de dejar
          que el dueño adivine solo con la memoria. */}
      {typeof contactosReales === 'number' && contactosReales > 0 && (
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
          <MessageCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 leading-relaxed">
            Esta propiedad recibió <strong>{contactosReales} contacto{contactosReales !== 1 ? 's' : ''} real{contactosReales !== 1 ? 'es' : ''}</strong> a través de Vive Villahermosa antes de cerrarse.
          </p>
        </div>
      )}

      <p className="text-sm font-medium text-gray-700 mb-1">¿La persona te escribió o llamó por primera vez después de ver tu publicación en Vive Villahermosa?</p>
      <p className="text-xs text-gray-400 mb-2">Cuenta como &quot;sí&quot; aunque después hayan seguido hablando por WhatsApp — nos referimos a dónde te encontró, no a dónde cerraron el trato.</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          onClick={() => { setEncontrado(true); setMedio(''); }}
          className={`flex items-center justify-center gap-1.5 border-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            encontrado === true ? 'border-brand bg-brand text-white' : 'border-gray-200 text-gray-500 hover:border-brand/40'
          }`}
        >
          <Check size={15} /> Sí
        </button>
        <button
          type="button"
          onClick={() => setEncontrado(false)}
          className={`flex items-center justify-center gap-1.5 border-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            encontrado === false ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          <XIcon size={15} /> No
        </button>
      </div>

      {encontrado === false && (
        <>
          <p className="text-sm font-medium text-gray-700 mb-2">¿Dónde la encontraron?</p>
          <div className="space-y-2 mb-4">
            {MEDIOS_ALTERNOS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-brand/40 transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-pale/40">
                <input type="radio" name="medio-alterno" value={opt.value} checked={medio === opt.value}
                  onChange={() => setMedio(opt.value)} className="w-4 h-4 text-brand focus:ring-2 focus:ring-brand/40" />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
          {medio === 'otro' && (
            // maxLength: este dato viaja como query param en el PATCH — sin
            // límite, un texto muy largo arriesga exceder límites reales de
            // longitud de URL en algún punto de la infraestructura.
            <Input placeholder="Cuéntanos brevemente" value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={200} className="mb-4" />
          )}
        </>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button type="button" variant="primary" onClick={handleConfirmar} disabled={!puedeConfirmar} className="flex-1 justify-center">
          Marcar como {etiqueta}
        </Button>
      </div>
    </>
  );
}
