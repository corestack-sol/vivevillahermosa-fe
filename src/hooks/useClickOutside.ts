'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Cierra un menú/dropdown al hacer clic fuera de `ref`. Reemplaza el patrón
 * de "backdrop" (un <div> fixed inset-0 transparente con onClick) que se
 * usaba antes — ese patrón intercepta el clic completo, así que un clic en
 * OTRO elemento interactivo de la página (un link del header, otro botón)
 * solo cerraba el menú sin activar ese otro elemento, obligando a un
 * segundo clic. Este hook detecta el clic fuera sin bloquear nada más.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!active) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [active, ref, onOutside]);
}
