'use client';

import { useEffect, useRef, useState } from 'react';
import type { Oclusor } from '@/lib/rayosDeLuz';

/**
 * Fondo de rayos de luz con polvo, animado en tiempo real. Debajo del canvas
 * va un degradado azul estático: se ve mientras arranca WebGL y es el
 * respaldo si el navegador no lo soporta. Con "reducir movimiento" activo se
 * dibuja un solo cuadro fijo.
 *
 * - `className` debe darle posición y tamaño (por ejemplo `fixed inset-0` o `relative h-screen`).
 * - `oclusor`: elemento (selector + imagen de silueta) con el que interactúa la luz.
 * - `modo='sobre'`: capa con solo los rayos, para ponerla ENCIMA del logo
 *   (con `mix-blend-mode: screen`); el fondo dibuja el resto.
 */
export function RayosDeLuz({ className = 'relative h-full w-full', oclusor, modo = 'fondo' }: { className?: string; oclusor?: Oclusor; modo?: 'fondo' | 'sobre' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // El efecto es lo más pesado de la página: se carga (código aparte) y arranca
    // cuando el navegador está libre, después del primer pintado. Así el logo y
    // el título aparecen antes y el degradado azul de abajo cubre la espera.
    let cancelado = false;
    let detener: () => void = () => {};
    const arrancar = async () => {
      const { iniciarRayosDeLuz } = await import('@/lib/rayosDeLuz');
      if (cancelado) return;
      const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      detener = iniciarRayosDeLuz(canvas, {
        estatico: reducir,
        oclusor,
        modo,
        alPrimerCuadro: () => setListo(true),
        alFallar: () => setFallo(true),
      });
    };
    // requestIdleCallback no existe en Safari: cae a un temporizador corto.
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idle = w.requestIdleCallback
      ? w.requestIdleCallback(() => { void arrancar(); }, { timeout: 800 })
      : window.setTimeout(() => { void arrancar(); }, 250);
    return () => {
      cancelado = true;
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      detener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- oclusor y modo son fijos durante la vida del efecto
  }, []);

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={modo === 'sobre' ? undefined : { background: 'radial-gradient(ellipse at 0% 0%, #0a2a66 0%, #030a1c 45%, #000 80%)' }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${listo && !fallo ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
