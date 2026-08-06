type BadgeVariant =
  | 'venta'
  | 'renta'
  | 'featured'
  | 'flood-alto'
  | 'flood-medio'
  | 'flood-bajo'
  | 'eco'
  | 'dosabocas'
  | 'verificado'
  | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  venta: 'bg-brand text-white',
  renta: 'bg-accent text-white',
  featured: 'bg-accent-pale text-accent-dark border border-accent',
  'flood-alto': 'bg-red-100 text-red-700 border border-red-200',
  'flood-medio': 'bg-amber-100 text-amber-700 border border-amber-200',
  'flood-bajo': 'bg-green-100 text-green-700 border border-green-200',
  eco: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  dosabocas: 'bg-sky-100 text-sky-700 border border-sky-200',
  verificado: 'bg-brand-pale text-brand border border-brand',
  default: 'bg-gray-100 text-gray-600',
};

export function Badge({ variant = 'default', label, icon, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${variantClasses[variant]} ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}
