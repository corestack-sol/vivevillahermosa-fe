'use client';

import Link from 'next/link';
import { AlertTriangle, Pencil } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { PropiedadConAtencion } from '@/lib/coach';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pendientes: PropiedadConAtencion[];
}

/**
 * Lista de propiedades que el coach (capa 1, heurística — src/lib/coach.ts)
 * marcó con algo que revisar. Solo sugerencias, nunca bloqueo — cada fila
 * lleva directo a editar, no hay ninguna acción punitiva aquí.
 */
export function CoachModal({ isOpen, onClose, pendientes }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Propiedades que necesitan atención" maxWidth="lg">
      {pendientes.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          Todas tus propiedades activas están completas — nada que revisar por ahora.
        </p>
      ) : (
        <div className="space-y-3">
          {pendientes.map(({ propiedad, razones }) => (
            <div key={propiedad.property.id} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="font-semibold text-gray-800 text-sm">{propiedad.property.titulo}</p>
                <Link
                  href={`/dashboard/propiedades/${propiedad.property.id}/editar`}
                  onClick={onClose}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark whitespace-nowrap"
                >
                  <Pencil size={12} /> Editar
                </Link>
              </div>
              <ul className="space-y-1.5">
                {razones.map((r) => (
                  <li key={r.clave} className="flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
                    <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    {r.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
