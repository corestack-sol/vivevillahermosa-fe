'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Hoja deslizable desde abajo — pensado para móvil (ej. el resumen de
 * "publicar propiedad", pedido explícito 2026-09-17), donde un modal
 * centrado tapa demasiada pantalla o se siente desconectado del elemento
 * que lo abrió (una barra fija en la parte inferior). Mismo tratamiento de
 * accesibilidad/robustez que Modal.tsx (portal, focus trap, Escape,
 * bloqueo de scroll del body) — no se reutiliza Modal.tsx directo porque
 * su posicionamiento (centrado, ancho fijo) no puede expresar "pegado
 * abajo, ancho completo, con manija de arrastre" sin volverse un
 * condicional confuso dentro del mismo componente.
 */
export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    function marcarMontado() { setMounted(true); }
    marcarMontado();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
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

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[1400] flex items-end justify-center transition-opacity duration-200 ${
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className={`relative w-full max-w-lg max-h-[75vh] flex flex-col bg-white rounded-t-3xl shadow-2xl transition-transform duration-200 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
      >
        {/* Manija de arrastre — puramente visual (no hay gesto de swipe
            implementado), pero es la señal universal de "esto se puede
            cerrar deslizando/tocando fuera", coherente con tocar el fondo
            para cerrar. */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 pt-1 pb-3 flex-shrink-0">
          {title && <h2 id="bottom-sheet-title" className="text-base font-bold text-gray-800">{title}</h2>}
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
