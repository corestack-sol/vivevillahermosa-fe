interface SkeletonProps {
  variant?: 'card' | 'text' | 'image' | 'circle';
  lines?: number;
  className?: string;
}

export function Skeleton({ variant = 'text', lines = 1, className = '' }: SkeletonProps) {
  if (variant === 'card') {
    // Mismo silueta que PropertyCard (tarjeta-retrato tipo card2.png) —
    // antes era una forma distinta (imagen corta + cuerpo blanco) y el
    // remplazo por la tarjeta real se sentía como un salto de layout.
    return (
      <div className={`rounded-3xl overflow-hidden aspect-[20/21] animate-shimmer ${className}`} />
    );
  }

  if (variant === 'image') {
    return <div className={`animate-shimmer rounded-xl ${className}`} />;
  }

  if (variant === 'circle') {
    return <div className={`animate-shimmer rounded-full ${className}`} />;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded animate-shimmer"
          style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}
