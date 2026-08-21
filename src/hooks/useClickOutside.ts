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
    // Escape también cierra — antes solo un clic fuera lo hacía, dejando
    // a alguien navegando por teclado sin forma de cerrar el menú/dropdown
    // sin tocar el mouse (hallazgo de accesibilidad, WCAG 2.1.2). Todos los
    // usos actuales de este hook (menú de usuario y notificaciones del
    // Navbar, NotificationBell) son overlays donde Escape-para-cerrar es el
    // comportamiento esperado.
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOutside();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [active, ref, onOutside]);
}
