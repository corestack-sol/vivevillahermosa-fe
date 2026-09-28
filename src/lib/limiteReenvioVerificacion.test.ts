import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  puedeReenviar, registrarIntentoReenvio, segundosHastaProximoReenvio,
  LIMITE_REENVIOS_POR_HORA, VENTANA_REENVIO_MS,
} from './limiteReenvioVerificacion';

function storageEnMemoria() {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v); },
    removeItem: (k: string) => { datos.delete(k); },
  };
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: storageEnMemoria() });
});
afterEach(() => vi.unstubAllGlobals());

describe('límite de reenviar verificación (3 por hora, real del backend)', () => {
  const T0 = 1_700_000_000_000;

  it('con cero intentos previos, hay cupo y no hay que esperar', () => {
    expect(puedeReenviar(T0)).toBe(true);
    expect(segundosHastaProximoReenvio(T0)).toBe(0);
  });

  it('tras 3 intentos dentro de la hora, ya no hay cupo', () => {
    registrarIntentoReenvio(T0);
    registrarIntentoReenvio(T0 + 1000);
    registrarIntentoReenvio(T0 + 2000);
    expect(puedeReenviar(T0 + 3000)).toBe(false);
  });

  it('el 4º intento no se deja pasar aunque hayan pasado los 60s de espera corta entre clics', () => {
    registrarIntentoReenvio(T0);
    registrarIntentoReenvio(T0 + 60_000);
    registrarIntentoReenvio(T0 + 120_000);
    // Antes (candado de 60s entre clics) esto se hubiera dejado pasar a los 180s.
    expect(puedeReenviar(T0 + 180_000)).toBe(false);
  });

  it('el tiempo de espera es hasta que el intento MÁS VIEJO de los 3 sale de la ventana de 1h', () => {
    registrarIntentoReenvio(T0);
    registrarIntentoReenvio(T0 + 1000);
    registrarIntentoReenvio(T0 + 2000);
    const restante = segundosHastaProximoReenvio(T0 + 3000);
    const esperado = Math.ceil((VENTANA_REENVIO_MS - 3000) / 1000);
    expect(restante).toBe(esperado);
  });

  it('pasada la hora completa desde el primer intento, vuelve a haber cupo', () => {
    registrarIntentoReenvio(T0);
    registrarIntentoReenvio(T0 + 1000);
    registrarIntentoReenvio(T0 + 2000);
    expect(puedeReenviar(T0 + VENTANA_REENVIO_MS + 1)).toBe(true);
    expect(segundosHastaProximoReenvio(T0 + VENTANA_REENVIO_MS + 1)).toBe(0);
  });

  it('el límite es exactamente el confirmado por el backend (3/hora)', () => {
    expect(LIMITE_REENVIOS_POR_HORA).toBe(3);
    expect(VENTANA_REENVIO_MS).toBe(60 * 60 * 1000);
  });

  it('sin `window` (SSR): siempre deja pasar, nunca revienta', () => {
    vi.unstubAllGlobals();
    expect(puedeReenviar(T0)).toBe(true);
    expect(segundosHastaProximoReenvio(T0)).toBe(0);
    expect(() => registrarIntentoReenvio(T0)).not.toThrow();
  });
});
