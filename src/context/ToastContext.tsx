'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string, action?: ToastAction) => void;
  info: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof CheckCircle2; iconCls: string; borderCls: string }> = {
  success: { icon: CheckCircle2, iconCls: 'text-emerald-500', borderCls: 'border-emerald-100' },
  error:   { icon: AlertCircle,  iconCls: 'text-red-500',     borderCls: 'border-red-100' },
  info:    { icon: Info,         iconCls: 'text-blue-500',    borderCls: 'border-blue-100' },
};

const DURATION_MS = 4000;
// Los toasts con una acción (ej. "Deshacer") se quedan más tiempo — 4s no
// alcanza para leer, decidir y hacer clic.
const DURATION_WITH_ACTION_MS = 7000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((variant: ToastVariant, message: string, action?: ToastAction) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, variant, message, action }]);
    setTimeout(() => remove(id), action ? DURATION_WITH_ACTION_MS : DURATION_MS);
  }, [remove]);

  const value: ToastContextValue = {
    success: (m, a) => push('success', m, a),
    error:   (m, a) => push('error', m, a),
    info:    (m, a) => push('info', m, a),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* aria-live: anuncia cada toast a lectores de pantalla sin robar el foco.
          z-[100] -> z-[1500] junto con el z-[1400] de Modal.tsx — un toast
          debe seguir viéndose por encima de un modal abierto (ej. "reporte
          enviado" mientras el modal todavía cierra), mismo orden relativo
          que ya existía (100 > 50), solo corrido para ganarle a los mapas. */}
      <div
        className="fixed inset-x-0 bottom-0 z-[1500] flex flex-col items-stretch sm:items-end gap-2 p-4 sm:right-4 sm:left-auto sm:bottom-4 sm:max-w-sm pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => {
          const { icon: Icon, iconCls, borderCls } = VARIANT_STYLES[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 w-full bg-white border ${borderCls} rounded-2xl shadow-xl px-4 py-3 animate-toast-in`}
            >
              <Icon size={18} className={`flex-shrink-0 mt-0.5 ${iconCls}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 leading-snug">{t.message}</p>
                {t.action && (
                  <button
                    onClick={() => { t.action!.onClick(); remove(t.id); }}
                    className="mt-1 text-sm font-bold text-brand hover:text-brand-dark transition-colors"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => remove(t.id)}
                aria-label="Cerrar notificación"
                className="flex-shrink-0 p-1.5 -m-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
