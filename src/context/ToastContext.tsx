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

// Rediseño 2026-09-09 — pedido explícito: "se pierden con lo demás del UI
// en blanco". Antes era borde de 1px casi del mismo blanco que el fondo
// (border-emerald-100/etc) — imperceptible. Ahora franja de color sólida a
// la izquierda + ícono en chip de color + sombra más fuerte, con los
// tokens de marca reales (success/danger/sky), no colores Tailwind
// genéricos sin relación con la paleta de la app.
const VARIANT_STYLES: Record<ToastVariant, { icon: typeof CheckCircle2; iconCls: string; chipCls: string; borderCls: string }> = {
  success: { icon: CheckCircle2, iconCls: 'text-success', chipCls: 'bg-success/10', borderCls: 'border-success' },
  error:   { icon: AlertCircle,  iconCls: 'text-danger',  chipCls: 'bg-danger/10',  borderCls: 'border-danger' },
  info:    { icon: Info,         iconCls: 'text-sky-600', chipCls: 'bg-sky/15',     borderCls: 'border-sky' },
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
          const { icon: Icon, iconCls, chipCls, borderCls } = VARIANT_STYLES[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 w-full bg-white border-l-4 ${borderCls} rounded-2xl shadow-2xl ring-1 ring-black/5 px-4 py-3.5 animate-toast-in`}
            >
              <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${chipCls}`}>
                <Icon size={16} className={iconCls} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 leading-snug">{t.message}</p>
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
