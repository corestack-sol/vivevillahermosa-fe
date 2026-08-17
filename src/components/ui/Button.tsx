import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'light' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-cta text-white hover:bg-cta-dark shadow-sm active:scale-95',
  secondary:
    'bg-brand text-white hover:bg-brand-dark shadow-sm active:scale-95',
  light:
    'bg-white text-brand-dark hover:bg-white/90 shadow-sm active:scale-95',
  ghost:
    'bg-transparent text-brand hover:bg-brand-pale active:scale-95',
  outline:
    'border border-brand text-brand hover:bg-brand-pale active:scale-95',
  danger:
    'bg-danger text-white hover:opacity-90 active:scale-95',
};

// `md` (el tamaño default) sube de py-2.5 a py-3 para alcanzar el touch
// target mínimo de 44px (12px×2 padding + 20px de line-height de text-sm =
// 44px) — antes quedaba en ~40px. Ver docs/PLAN-AUDITORIA-FASE1-MVP.md
// hallazgo #6. `sm` se deja igual a propósito: se usa en UI densa
// (tablas/admin) donde forzar 44px tendría un efecto visual más amplio que
// revisar en esta pasada — queda pendiente si se decide aplicar ahí también.
const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5 rounded-lg',
  md: 'text-sm px-4 py-3 rounded-xl',
  lg: 'text-base px-6 py-3 rounded-xl',
  xl: 'text-sm px-7 py-3.5 rounded-2xl',
};

/**
 * Clases de botón reutilizables fuera de <Button> — para CTAs que deben
 * ser <Link> (Home, Navbar) pero necesitan verse idénticos a los botones reales.
 */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className = ''): string {
  return `inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  );
}
