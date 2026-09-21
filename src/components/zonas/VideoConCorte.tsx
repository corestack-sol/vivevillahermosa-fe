'use client';

import type { ReactNode } from 'react';

interface VideoConCorteProps {
  src: string;
  /** Segundo en que el reproductor se detiene y vuelve al inicio. */
  finSegundos: number;
  className?: string;
  children?: ReactNode;
}

/**
 * Video que "termina" antes del final real del archivo: al llegar a
 * `finSegundos` se pausa y regresa al inicio, y no se puede saltar más allá
 * de ese punto (la barra se queda en el corte). Evita re-codificar el mp4
 * (no hay ffmpeg en el flujo de trabajo). El archivo sigue durando lo mismo,
 * así que la barra de progreso del navegador muestra la duración completa:
 * el último tramo de la barra existe pero no se puede alcanzar.
 */
export function VideoConCorte({ src, finSegundos, className, children }: VideoConCorteProps) {
  function alAvanzar(video: HTMLVideoElement) {
    if (video.currentTime >= finSegundos) {
      video.pause();
      video.currentTime = 0;
    }
  }

  // Arrastrar la barra más allá del corte lo deja en el corte, no más allá.
  function alBuscar(video: HTMLVideoElement) {
    if (video.currentTime > finSegundos) video.currentTime = finSegundos;
  }

  return (
    <video
      className={className}
      controls
      playsInline
      preload="none"
      src={src}
      onTimeUpdate={(e) => alAvanzar(e.currentTarget)}
      onSeeking={(e) => alBuscar(e.currentTarget)}
    >
      {children}
    </video>
  );
}
