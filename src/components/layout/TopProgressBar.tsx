'use client';

import { useEffect, useRef, useState } from 'react';
import { onTopProgressStart } from '@/lib/topProgress';

// Nada de usePathname/useSearchParams como señal de "terminó" — se probó y
// descartó (2026-09-13): en una navegación con Link ya prefetcheado, el
// pathname cambia casi en el mismo instante que dispara el evento de
// inicio, así que "terminó" competía con "empezó" y la barra nunca
// llegaba a pintarse (confirmado con logs: el efecto de pathname corría
// con el nuevo pathname ya puesto antes de que la barra alcanzara a
// mostrarse). Autocontenido: temporizador propio de principio a fin,
// siempre visible el mismo tiempo sin importar qué tan rápida sea la
// navegación real — eso es lo que pidió el usuario ("indicar que se está
// procesando"), no una medición exacta del tiempo de carga real.
const RAMP_MS = 650;
const FADE_MS = 220;

type Phase = 'idle' | 'loading' | 'finishing';

export function TopProgressBar() {
  const [phase, setPhase] = useState<Phase>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return onTopProgressStart(() => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setPhase('loading');
      timers.current.push(setTimeout(() => setPhase('finishing'), RAMP_MS));
      timers.current.push(setTimeout(() => setPhase('idle'), RAMP_MS + FADE_MS));
    });
  }, []);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  if (phase === 'idle') return null;

  const width = phase === 'loading' ? 85 : 100;
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] pointer-events-none" aria-hidden="true">
      <div
        className="h-full bg-coral"
        style={{
          width: `${width}%`,
          opacity: phase === 'finishing' ? 0 : 1,
          transition: phase === 'loading'
            ? `width ${RAMP_MS}ms cubic-bezier(0.15,0.8,0.4,1)`
            : `width 200ms ease-out, opacity ${FADE_MS}ms ease-out 100ms`,
        }}
      />
    </div>
  );
}
