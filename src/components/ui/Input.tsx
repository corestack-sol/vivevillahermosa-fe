import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { calcularScrollPorRueda } from '@/lib/wheelScroll';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  hint?: string;
  labelClassName?: string;
  dark?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, hint, className = '', id, labelClassName, dark = false, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={`block text-sm font-medium mb-1 ${labelClassName ?? (dark ? 'text-white/80' : 'text-gray-700')}`}>
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-white/70' : 'text-gray-400'}`}>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-xl border text-base sm:text-sm transition-colors duration-150 focus:outline-none focus:ring-2 ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 ${
              dark
                ? `bg-white/10 text-white placeholder-white/30 focus:ring-yellow-400/30 ${error ? 'border-red-400 focus:border-red-400' : 'border-white/15 focus:border-yellow-400/50'}`
                : `bg-white text-gray-800 placeholder-gray-400 focus:ring-brand/40 ${error ? 'border-danger focus:border-danger' : 'border-gray-200 focus:border-brand'}`
            } ${className}`}
            onFocus={(e) => {
              if (props.type === 'number' && (e.target.value === '0' || e.target.value === '')) {
                e.target.select();
              }
              props.onFocus?.(e);
            }}
            // Un <input> de una sola línea NUNCA responde a la rueda del
            // mouse/trackpad de forma nativa — solo mover el cursor
            // (flechas, Home/End, clic) lo desplaza. Verificado en vivo
            // 2026-08-31 (reporte real sobre "Título del anuncio"): con
            // teclado sí se ve el final del texto, con rueda del mouse no
            // se movía nada — no es un bug de este componente, es el
            // límite real de cualquier input de texto en cualquier
            // navegador. Se agrega este soporte manual (solo cuando el
            // texto de verdad desborda) para que la rueda también funcione,
            // en vez de dejar que solo el teclado pueda revisar un valor
            // largo. Sin preventDefault a propósito: React marca los
            // listeners de wheel como passive por defecto (desde React 17),
            // llamar preventDefault ahí no funciona y solo genera un
            // warning en consola — el pequeño scroll de página de sobra al
            // usar la rueda encima del input es un costo aceptable frente a
            // eso.
            onWheel={(e) => {
              const el = e.currentTarget;
              el.scrollLeft = calcularScrollPorRueda(el, e.deltaY, e.deltaX);
              props.onWheel?.(e);
            }}
            {...props}
          />
        </div>
        {hint && !error && <p className={`mt-1 text-xs ${dark ? 'text-white/70' : 'text-gray-500'}`}>{hint}</p>}
        {error && <p className={`mt-1 text-xs ${dark ? 'text-red-300' : 'text-danger'}`}>{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
