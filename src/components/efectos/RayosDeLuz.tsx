'use client';

import { useEffect, useRef, useState } from 'react';
import { iniciarRayosDeLuz, type Oclusor } from '@/lib/rayosDeLuz';

/**
 * Fondo de rayos de luz con polvo, animado en tiempo real. Debajo del canvas
 * va un degradado azul estático: se ve mientras arranca WebGL y es el
 * respaldo si el navegador no lo soporta. Con "reducir movimiento" activo se
 * dibuja un solo cuadro fijo.
 */
/** `oclusor`: elemento (selector + imagen de silueta) con el que interactúa la luz. */
/** `className` debe darle posición y tamaño (por ejemplo `fixed inset-0` o `relative h-screen`). */
export function RayosDeLuz({ className = 'relative h-full w-full', oclusor }: { className?: string; oclusor?: Oclusor }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return iniciarRayosDeLuz(canvas, {
      estatico: reducir,
      oclusor,
      alPrimerCuadro: () => setListo(true),
      alFallar: () => setFallo(true),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el oclusor es fijo durante la vida del efecto
  }, []);

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ background: 'radial-gradient(ellipse at 0% 0%, #0a2a66 0%, #030a1c 45%, #000 80%)' }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${listo && !fallo ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
