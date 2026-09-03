'use client';

import { useEffect, useState } from 'react';

// El navegador no expone un tipo real para este evento — es una API
// de Chrome/Android, no un estándar con tipos en el DOM lib de TS.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Detecta si la app se puede instalar y expone la acción de instalar —
 * pedido explícito 2026-09-02: ícono propio junto al menú hamburguesa
 * (Navbar.tsx), en vez de esperar el prompt automático del navegador
 * (que en Chrome/Android aparece solo, sin control sobre cuándo ni a
 * quién se le muestra — con esto se puede limitar a cuentas con sesión).
 *
 * `beforeinstallprompt` es Chrome/Android únicamente — Safari/iOS NUNCA
 * lo dispara (no tiene API de instalación programática, solo "Compartir
 * → Agregar a inicio" manual). `puedeInstalar` se queda en `false` ahí
 * sin importar qué se haga — es una limitación real de la plataforma, no
 * un bug de este hook.
 */
export function useInstallPwa() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalada, setInstalada] = useState(false);

  useEffect(() => {
    function detectarInstalada() {
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        // iOS Safari no tiene display-mode: standalone confiable en todas
        // las versiones — navigator.standalone es su propia señal, no
        // estándar (de ahí el cast).
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setInstalada(standalone);
    }
    detectarInstalada();

    function onBeforeInstallPrompt(e: Event) {
      // Sin esto, Chrome muestra su propio mini-banner automático —
      // preventDefault() lo detiene para poder mostrar el ícono propio
      // en su lugar y decidir cuándo/a quién ofrecerlo.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstalada(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  async function instalar() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // 'appinstalled' ya cubre el caso aceptado (se dispara aparte,
    // async) — aquí solo se limpia el prompt guardado en cualquier caso,
    // uno usado no se puede volver a llamar.
    if (outcome === 'accepted') setInstalada(true);
    setDeferredPrompt(null);
  }

  return { puedeInstalar: !!deferredPrompt && !instalada, instalada, instalar };
}
