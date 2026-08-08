import type { SelectHTMLAttributes } from 'react';
import { forwardRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  labelClassName?: string;
  dark?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder = 'Seleccionar...', className = '', id, labelClassName, dark = false, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className={`block text-sm font-medium mb-1 ${labelClassName ?? (dark ? 'text-white/80' : 'text-gray-700')}`}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full rounded-xl border text-base sm:text-sm transition-colors duration-150 focus:outline-none focus:ring-2 px-4 py-2.5 appearance-none ${
            dark
              ? `bg-white/10 text-white focus:ring-yellow-400/30 ${error ? 'border-red-400' : 'border-white/15 focus:border-yellow-400/50'}`
              : `bg-white text-gray-800 focus:ring-brand/40 ${error ? 'border-danger' : 'border-gray-200 focus:border-brand'}`
          } ${className}`}
          {...props}
        >
          <option value="" className={dark ? 'bg-brand-dark text-white' : ''}>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className={dark ? 'bg-brand-dark text-white' : ''}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className={`mt-1 text-xs ${dark ? 'text-red-300' : 'text-danger'}`}>{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
