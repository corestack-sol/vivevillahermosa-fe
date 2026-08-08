import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

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
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
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
            {...props}
          />
        </div>
        {hint && !error && <p className={`mt-1 text-xs ${dark ? 'text-white/40' : 'text-gray-500'}`}>{hint}</p>}
        {error && <p className={`mt-1 text-xs ${dark ? 'text-red-300' : 'text-danger'}`}>{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
