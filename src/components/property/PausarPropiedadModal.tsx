'use client';

import { useState } from 'react';
import { PauseCircle, Archive, Check, X as XIcon, MessageCircle } from 'lucide-react';
import type { OperationType } from '@/types/property';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MOTIVOS_PAUSA, MEDIOS_ALTERNOS } from '@/lib/motivosCierre';
import { MOTIVO_OPERACION_CERRADA, type ResultadoPausa } from '@/lib/cierrePublicacion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propertyTitle: string;
  operacion: OperationType;
  onConfirm: (resultado: ResultadoPausa) => void;
  // Conteo real de contactos de esta propiedad — opcional a propósito: si el
  // backend no lo manda, el aviso simplemente no aparece.
  contactosReales?: number;
}

/**
 * Único botón para sacar una publicación de circulación, por la razón que
 * sea (pedido 2026-09-23: menos botones). Antes había dos — "Pausar" y
 * "Marcar como vendida/rentada" (Archivar) — con dos modales. Ahora "ya se
 * vendió/rentó" es un motivo más de esta lista: si se elige, pregunta si la
 * persona llegó por la plataforma (la métrica que más importa, pedido
 * 2026-08-23) y la propiedad queda vendida/rentada por dentro — no como
 * "pausada", que cuenta para el límite gratuito y en público diría que el
 * propietario la pausó (ver cierrePublicacion.ts).
 */
export function PausarPropiedadModal({ isOpen, onClose, propertyTitle, operacion, onConfirm, contactosReales }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pausar publicación" maxWidth="sm">
      {/* El cuerpo solo se monta mientras está abierto — así lo elegido se
          olvida en cada apertura (mismo patrón que EliminarCuentaModal.tsx).
          Sin esto, cancelar y volver a abrir dejaba una opción
          pre-seleccionada, invisible al usuario, hasta que confirma. */}
      {isOpen && <PausarConfirmBody propertyTitle={propertyTitle} operacion={operacion} onConfirm={onConfirm} onClose={onClose} contactosReales={contactosReales} />}
    </Modal>
  );
}

function PausarConfirmBody({ propertyTitle, operacion, onConfirm, onClose, contactosReales }: Omit<Props, 'isOpen'>) {
  const etiquetaCierre = operacion === 'venta' ? 'vendida' : 'rentada';
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [encontrado, setEncontrado] = useState<boolean | null>(null);
  const [medio, setMedio] = useState('');
  const [medioDetalle, setMedioDetalle] = useState('');

  const esCierre = motivo === MOTIVO_OPERACION_CERRADA;
  // De la razón más probable a la menos probable: "ya se vendió/rentó" es la
  // causa principal de que una publicación salga de circulación; el resto
  // sigue el orden de MOTIVOS_PAUSA y "Otro motivo" siempre queda al final.
  const opciones = [
    { value: MOTIVO_OPERACION_CERRADA, label: operacion === 'venta' ? 'Ya se vendió' : 'Ya se rentó' },
    ...MOTIVOS_PAUSA,
  ];

  const puedeConfirmar = esCierre
    ? encontrado === true || (encontrado === false && !!medio)
    : !!motivo;

  function handleConfirmar() {
    if (!puedeConfirmar) return;
    if (esCierre) {
      onConfirm(encontrado
        ? { tipo: 'cerrada', encontradoEnPlataforma: true }
        : { tipo: 'cerrada', encontradoEnPlataforma: false, medioAlterno: medio, medioAlternoDetalle: medio === 'otro' ? medioDetalle.trim() || undefined : undefined });
    } else {
      onConfirm({ tipo: 'pausa', motivo, motivoDetalle: motivo === 'otro' ? detalle.trim() || undefined : undefined });
    }
    onClose();
  }

  return (
    <>
      {esCierre ? (
        <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-4">
          <Archive size={16} className="text-brand flex-shrink-0 mt-0.5" />
          <p className="text-sm text-brand-dark leading-relaxed">
            <strong>{propertyTitle}</strong> se marcará como <strong>{etiquetaCierre}</strong>. Dejará de recibir mensajes de
            contacto, pero se conserva en tu panel como registro de la operación. Puedes reactivarla si fue un error.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <PauseCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            <strong>{propertyTitle}</strong> dejará de recibir mensajes de contacto. Puedes reactivarla cuando quieras.
          </p>
        </div>
      )}

      <p className="text-sm font-medium text-gray-700 mb-2">¿Por qué la pausas?</p>
      <div className="space-y-2 mb-4">
        {opciones.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-brand/40 transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-pale/40">
            <input type="radio" name="motivo-pausa" value={opt.value} checked={motivo === opt.value}
              onChange={() => { setMotivo(opt.value); setEncontrado(null); setMedio(''); }} className="w-4 h-4 text-brand focus:ring-2 focus:ring-brand/40" />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>

      {motivo === 'otro' && (
        // maxLength: este motivo viaja como query param en el PATCH — sin
        // límite, un texto muy largo arriesga exceder límites reales de
        // longitud de URL en algún punto de la infraestructura.
        <Input placeholder="Cuéntanos brevemente" value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={200} className="mb-4" />
      )}

      {esCierre && (
        <>
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
                <Input placeholder="Cuéntanos brevemente" value={medioDetalle} onChange={(e) => setMedioDetalle(e.target.value)} maxLength={200} className="mb-4" />
              )}
            </>
          )}
        </>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button type="button" variant="primary" onClick={handleConfirmar} disabled={!puedeConfirmar} className="flex-1 justify-center">
          {esCierre ? `Marcar como ${etiquetaCierre}` : 'Pausar publicación'}
        </Button>
      </div>
    </>
  );
}
