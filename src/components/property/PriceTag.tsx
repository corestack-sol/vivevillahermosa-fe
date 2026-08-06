import type { OperationType } from '@/types/property';

interface PriceTagProps {
  precio: number;
  operacion: OperationType;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
};

export function PriceTag({ precio, operacion, size = 'md' }: PriceTagProps) {
  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(precio);

  return (
    <span className={`font-heading font-bold text-brand-dark ${sizeClasses[size]}`}>
      {formatted}
      {operacion === 'renta' && (
        <span className="text-sm font-normal text-gray-500 ml-1">/mes</span>
      )}
    </span>
  );
}
