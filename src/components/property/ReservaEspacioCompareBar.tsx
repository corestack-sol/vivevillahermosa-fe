'use client';

import { useEffect } from 'react';

/**
 * Sin contenido propio — solo avisa, mientras está montado, que
 * CompareBar.tsx (global, en cualquier página) debe dejar espacio libre
 * abajo para no taparse con la barra fija de "Contactar" de esta ficha
 * (mobile/tablet). Reporte real 2026-09-02: CompareBar tenía un
 * `bottom-20` fijo pensado solo para esta página — en cualquier OTRA
 * página (sin esta barra) quedaba innecesariamente lejos del borde
 * inferior. Con la variable CSS, solo se reserva espacio cuando de
 * verdad hay algo abajo que evitar.
 */
export function ReservaEspacioCompareBar() {
  useEffect(() => {
    document.documentElement.style.setProperty('--compare-bar-bottom-offset', '4.5rem');
    return () => {
      document.documentElement.style.removeProperty('--compare-bar-bottom-offset');
    };
  }, []);
  return null;
}
