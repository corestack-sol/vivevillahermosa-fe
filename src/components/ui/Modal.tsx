'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const maxWidthClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, children, maxWidth = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Subir el z-index no alcanzaba: este modal se renderizaba inline, donde
  // sea que <Modal> apareciera en el árbol de JSX (ej. dentro del panel de
  // acciones de PropertyDetailView.tsx) — si CUALQUIER ancestro entre ahí
  // y <body> crea su propio contexto de apilamiento (una tarjeta con
  // rounded-2xl+overflow-hidden combinado con position, una animación de
  // transform/opacity, etc.), el z-index del modal solo gana DENTRO de ese
  // contexto — nunca contra un mapa de Leaflet que vive en otra rama del
  // árbol. Mismo tipo de bug que ya se corrigió en el dropdown de
  // SearchBar.tsx esta sesión, pero ahí alcanzaba con promover al padre
  // correcto porque los dos elementos compartían el mismo contexto; aquí
  // el modal y el mapa NO comparten un ancestro común útil, así que la
  // única forma robusta es no depender de la cascada en absoluto:
  // createPortal saca el modal del árbol de React y lo monta como hijo
  // directo de <body>, al margen de cualquier contexto de apilamiento de
  // sus ancestros originales.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    function marcarMontado() { setMounted(true); }
    marcarMontado();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }

      // Focus trap: mantiene el Tab dentro del modal en vez de escapar
      // hacia la página de fondo (accesibilidad para navegación por teclado).
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      closeBtnRef.current?.focus();
    } else {
      previouslyFocused.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    // z-[1400]: valor de sobra por encima de cualquier mapa (Leaflet usa
    // hasta z-index 1300 en esta app, ver MapaClient.tsx/MapView.tsx) —
    // ya no depende de la cascada de contextos de apilamiento gracias al
    // portal de arriba, pero se deja alto de todas formas para no tener
    // que pensarlo de nuevo si algún día se agrega algo con z-index aún
    // más alto en el propio <body>.
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className={`relative w-full ${maxWidthClasses[maxWidth]} max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          {title && <h2 id="modal-title" className="text-lg font-bold text-gray-800">{title}</h2>}
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
