import { backendFetch } from '@/lib/backendApi';

// VAPID key pública viaja en base64url — PushManager.subscribe() pide un
// Uint8Array, conversión estándar (no hay helper nativo del navegador
// para esto). Función pura, sin dependencias — exportada para poder
// probarla directo (push.test.ts), sin necesitar PushManager real.
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

export type EstadoPush = 'no-soportado' | 'denegado' | 'inactivo' | 'activo';

/**
 * Estado real del navegador respecto a push — no asume nada, pregunta
 * directo a las APIs (Notification.permission, PushManager). `denegado`
 * es un estado sin salida real: una vez que la persona bloquea permisos
 * de notificación para el sitio, solo se puede revertir desde la
 * configuración del navegador, no con ningún botón de la página.
 */
export async function obtenerEstadoPush(): Promise<EstadoPush> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'no-soportado';
  }
  if (Notification.permission === 'denied') return 'denegado';
  const registro = await navigator.serviceWorker.ready;
  const suscripcion = await registro.pushManager.getSubscription();
  return suscripcion ? 'activo' : 'inactivo';
}

/**
 * Pide permiso (si hace falta) y suscribe al navegador a push — pedido
 * explícito 2026-09-02, ver docs/BACKEND-PUSH-NOTIFICACIONES-02092026.md
 * para el contrato completo con el backend. Lanza si el usuario rechaza
 * el permiso o si el backend rechaza guardar la suscripción — quien
 * llama decide cómo avisar (toast, etc.), esta función no asume UI.
 */
export async function suscribirPush(): Promise<void> {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('Permiso de notificaciones denegado');

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY ausente');

  const registro = await navigator.serviceWorker.ready;
  const suscripcion = await registro.pushManager.subscribe({
    userVisibleOnly: true, // obligatorio en Chrome — cada push debe mostrar una notificación visible, nada de "silenciosos"
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  const json = suscripcion.toJSON();
  await backendFetch('/push/suscripciones', {
    method: 'POST',
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
}

/** Cancela la suscripción, en el navegador Y en el backend — dejar solo una de las dos mitades hechas deja el estado inconsistente (el backend le seguiría mandando push a un endpoint que el navegador ya no escucha, o viceversa). */
export async function desuscribirPush(): Promise<void> {
  const registro = await navigator.serviceWorker.ready;
  const suscripcion = await registro.pushManager.getSubscription();
  if (!suscripcion) return;
  const endpoint = suscripcion.endpoint;
  await suscripcion.unsubscribe();
  await backendFetch('/push/suscripciones', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}
