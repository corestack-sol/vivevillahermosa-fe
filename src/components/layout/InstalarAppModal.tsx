'use client';

import { Download, Zap, BellRing, Maximize2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface InstalarAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAceptar: () => void;
}

const BENEFICIOS = [
  { Icon: Zap, texto: 'Acceso directo desde tu pantalla de inicio, sin buscar el navegador cada vez' },
  { Icon: Maximize2, texto: 'Pantalla completa, sin la barra de direcciones ni pestañas de por medio' },
  { Icon: BellRing, texto: 'Recibe notificaciones cuando haya una propiedad nueva que coincida con tus alertas' },
];

/**
 * Pedido explícito 2026-09-02: antes de disparar el prompt nativo del
 * navegador (que solo se puede llamar una vez por evento capturado, ver
 * useInstallPwa.ts), explicar qué va a pasar y qué gana la persona
 * instalando — el prompt del sistema operativo no tiene espacio para
 * explicar nada de esto, solo pregunta "¿instalar?".
 */
export function InstalarAppModal({ isOpen, onClose, onAceptar }: InstalarAppModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Instalar Vive Villahermosa" maxWidth="sm">
      <div className="space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-brand-pale flex items-center justify-center">
          <Download size={24} className="text-brand" />
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Vive Villahermosa se instala como cualquier app — se agrega un ícono a tu pantalla de inicio, sin ocupar el espacio de una app descargada de una tienda.
        </p>
        <ul className="space-y-3">
          {BENEFICIOS.map(({ Icon, texto }) => (
            <li key={texto} className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-pale flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon size={13} className="text-brand" />
              </div>
              <p className="text-sm text-gray-700 leading-snug">{texto}</p>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Ahora no
          </Button>
          <Button variant="primary" className="flex-1" onClick={onAceptar}>
            Instalar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
