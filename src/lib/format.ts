import type { OperationType } from '@/types/property';

export function formatPrice(price: number, operacion: OperationType): string {
  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  return operacion === 'renta' ? `${formatted}/mes` : formatted;
}

export function formatPriceShort(price: number): string {
  if (price >= 1_000_000) {
    return `$${(price / 1_000_000).toFixed(1)}M`;
  }
  if (price >= 1_000) {
    return `$${(price / 1_000).toFixed(0)}K`;
  }
  return `$${price}`;
}

/**
 * Contador del Hero ("Más de N propiedades") — antes mostraba el número
 * exacto siempre (`${n}+`), sin ningún tope; con miles de propiedades
 * activas esa cifra deja de ser legible de un vistazo. Mismo criterio que
 * ya usa `formatPriceShort` para precios (K/M), aplicado a un conteo:
 * exacto hasta 49, de 50 en 50 hasta 999, en "k" (décimas exactas, 1.1k,
 * 3k...) hasta 999,999, en "m" desde 1,000,000. Redondea siempre HACIA
 * ABAJO — el "+" nunca exagera el conteo real, solo lo hace legible.
 */
export function formatPropertyCount(n: number): string {
  if (n < 50) return `${n}+`;
  if (n < 1_000) return `${Math.floor(n / 50) * 50}+`;
  if (n < 1_000_000) {
    const miles = Math.floor(n / 100) / 10; // décimas de millar (100 en 100)
    return `${Number.isInteger(miles) ? miles : miles.toFixed(1)}k+`;
  }
  const millones = Math.floor(n / 100_000) / 10; // décimas de millón
  return `${Number.isInteger(millones) ? millones : millones.toFixed(1)}m+`;
}

export function formatArea(m2: number): string {
  return `${m2.toLocaleString('es-MX')} m²`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
  return formatDate(dateStr);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
