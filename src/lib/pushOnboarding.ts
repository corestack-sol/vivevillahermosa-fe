/**
 * Aviso de bienvenida para pedir permiso de notificaciones push — pedido
 * explícito 2026-09-25: al abrir por primera vez la app ya instalada en el
 * celular, mostrar un modal que explique para qué se piden y a qué funciones
 * pertenecen, en vez de soltar el permiso nativo del navegador sin contexto
 * (que la gente rechaza casi siempre porque no sabe qué recibirá).
 *
 * Aquí vive la parte pura (cuándo mostrarlo y qué recordar); la UI está en
 * components/push/PushOnboarding.tsx.
 */

/** El modal ya se mostró (o la persona ya decidió): no se vuelve a mostrar solo. */
export const CLAVE_PUSH_VISTO = 'push_onboarding_visto';
/**
 * La persona aceptó ANTES de iniciar sesión: el navegador ya dio el permiso,
 * pero la suscripción se guarda en el backend con la cuenta — se completa en
 * cuanto haya sesión, sin volver a preguntar.
 */
export const CLAVE_PUSH_PENDIENTE_LOGIN = 'push_pendiente_login';

export interface CondicionesPushOnboarding {
  /** Pantalla táctil (celular/tableta), no una PC con la app instalada. */
  movil: boolean;
  /** Abierta como app instalada (pantalla completa), no en una pestaña del navegador. */
  instalada: boolean;
  /** El navegador soporta service worker + PushManager. */
  soportado: boolean;
  /** Estado del permiso nativo. Solo tiene sentido preguntar si aún no se ha decidido. */
  permiso: NotificationPermission | 'sin-api';
  /** Ya se mostró antes (o la persona ya eligió). */
  yaVisto: boolean;
}

export function debeMostrarPushOnboarding(c: CondicionesPushOnboarding): boolean {
  return c.movil && c.instalada && c.soportado && c.permiso === 'default' && !c.yaVisto;
}

/** Celular o tableta: puntero táctil. Una PC con la app instalada tiene puntero fino y no cuenta. */
export function esDispositivoMovil(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints ?? 0) > 0;
}

/** La app se abrió instalada (ícono de inicio), no en el navegador. */
export function esAppInstalada(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    // iOS Safari: su propia señal, no estándar (de ahí el cast).
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function leer(clave: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(clave) === '1';
  } catch {
    return false;
  }
}

function escribir(clave: string, valor: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (valor) window.localStorage.setItem(clave, '1');
    else window.localStorage.removeItem(clave);
  } catch {
    // localStorage bloqueado (modo privado): no es crítico, solo podría volver a preguntar.
  }
}

export const yaSeMostroPushOnboarding = () => leer(CLAVE_PUSH_VISTO);
export const marcarPushOnboardingVisto = () => escribir(CLAVE_PUSH_VISTO, true);
export const hayPushPendienteDeLogin = () => leer(CLAVE_PUSH_PENDIENTE_LOGIN);
export const marcarPushPendienteDeLogin = (valor: boolean) => escribir(CLAVE_PUSH_PENDIENTE_LOGIN, valor);
