/**
 * Límite real de POST /auth/reenviar-verificacion: 3 por hora por cuenta
 * (confirmado 2026-09-27, docs/BACKEND-CONTACTO-DE-CUENTA-Y-VERIFICACION-23092026.md).
 * El aviso (AvisoVerificarCorreo.tsx) solo esperaba 60 s entre clics — alguien podía
 * gastar los 3 intentos en menos de 3 minutos y el cuarto clic recién se enteraba al
 * chocar con el 429 real del servidor. Esto cuenta los intentos de verdad (guardados en
 * localStorage, sobrevive a un recargo de página) y avisa ANTES de llamar al servidor
 * cuando ya no quedan, con cuánto falta para que vuelva a haber cupo.
 */

export const LIMITE_REENVIOS_POR_HORA = 3;
export const VENTANA_REENVIO_MS = 60 * 60 * 1000;

const CLAVE = 'reenvios_verificacion_correo';

function leerIntentos(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const arr: unknown = JSON.parse(crudo);
    return Array.isArray(arr) ? arr.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

function escribirIntentos(intentos: number[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(intentos));
  } catch {
    // localStorage bloqueado (modo privado): no es crítico — en el peor caso se deja
    // pasar un intento de más y lo frena el 429 real del servidor, igual que antes.
  }
}

/** Intentos dentro de la última hora — los más viejos que eso ya no cuentan. */
function intentosVigentes(ahora: number): number[] {
  return leerIntentos().filter((t) => ahora - t < VENTANA_REENVIO_MS);
}

/** ¿Hay cupo para reenviar ahora mismo, sin necesidad de llamar al servidor? */
export function puedeReenviar(ahora = Date.now()): boolean {
  return intentosVigentes(ahora).length < LIMITE_REENVIOS_POR_HORA;
}

/** Registra un intento real (llamarlo justo después de que la petición se mande con éxito). */
export function registrarIntentoReenvio(ahora = Date.now()): void {
  escribirIntentos([...intentosVigentes(ahora), ahora]);
}

/** Segundos hasta que vuelva a haber cupo (0 si ya hay). */
export function segundosHastaProximoReenvio(ahora = Date.now()): number {
  const vigentes = intentosVigentes(ahora).sort((a, b) => a - b);
  if (vigentes.length < LIMITE_REENVIOS_POR_HORA) return 0;
  return Math.max(0, Math.ceil((vigentes[0] + VENTANA_REENVIO_MS - ahora) / 1000));
}
