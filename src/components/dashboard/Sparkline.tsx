interface SparklineProps {
  valores: number[];
  width?: number;
  height?: number;
  color?: string;
}

/**
 * Gráfica de línea minimalista hecha a mano con SVG — no se instaló una
 * librería de gráficas para una necesidad tan chica (mismo criterio que ya
 * se usó para el marquee del home y el PDF del reporte).
 */
export function Sparkline({ valores, width = 240, height = 56, color = '#0D7065' }: SparklineProps) {
  if (valores.length === 0) return null;
  const max = Math.max(1, ...valores);
  const stepX = valores.length > 1 ? width / (valores.length - 1) : width;

  const puntos = valores.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const areaPath = `M0,${height} L${puntos.join(' L')} L${width},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={areaPath} fill={color} fillOpacity={0.08} />
      <polyline points={puntos.join(' ')} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
