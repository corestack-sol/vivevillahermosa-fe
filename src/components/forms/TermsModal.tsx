'use client';

import { Modal } from '@/components/ui/Modal';
import { Scale } from 'lucide-react';
import { TERMS_SECTIONS } from '@/lib/termsSections';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Términos y Condiciones" maxWidth="xl">
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4 pb-4 border-b border-gray-100">
        <Scale size={13} className="flex-shrink-0" />
        Vive Villahermosa · Vigente desde julio de 2026
      </div>
      <div className="space-y-4">
        {TERMS_SECTIONS.map((s) => (
          <div key={s.title}>
            <h3 className="text-sm font-bold text-gray-800 mb-1">{s.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}
