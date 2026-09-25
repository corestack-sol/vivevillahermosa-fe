import { describe, it, expect, afterEach } from 'vitest';
import {
  debeMostrarPushOnboarding, marcarPushOnboardingVisto, yaSeMostroPushOnboarding,
  marcarPushPendienteDeLogin, hayPushPendienteDeLogin, CLAVE_PUSH_VISTO, type CondicionesPushOnboarding,
} from './pushOnboarding';

const base: CondicionesPushOnboarding = { movil: true, instalada: true, soportado: true, permiso: 'default', yaVisto: false };

describe('debeMostrarPushOnboarding', () => {
  it('se muestra en el celular, con la app instalada, si aún no se decidió nada', () => {
    expect(debeMostrarPushOnboarding(base)).toBe(true);
  });
  it('no se muestra en una PC (aunque tenga la app instalada)', () => {
    expect(debeMostrarPushOnboarding({ ...base, movil: false })).toBe(false);
  });
  it('no se muestra si se abre en una pestaña del navegador (no instalada)', () => {
    expect(debeMostrarPushOnboarding({ ...base, instalada: false })).toBe(false);
  });
  it('no se muestra si el navegador no soporta push', () => {
    expect(debeMostrarPushOnboarding({ ...base, soportado: false })).toBe(false);
  });
  it('no se muestra si el permiso ya se concedió o se bloqueó (no hay nada que preguntar)', () => {
    expect(debeMostrarPushOnboarding({ ...base, permiso: 'granted' })).toBe(false);
    expect(debeMostrarPushOnboarding({ ...base, permiso: 'denied' })).toBe(false);
    expect(debeMostrarPushOnboarding({ ...base, permiso: 'sin-api' })).toBe(false);
  });
  it('no se vuelve a mostrar una vez visto', () => {
    expect(debeMostrarPushOnboarding({ ...base, yaVisto: true })).toBe(false);
  });
});

describe('memoria del aviso', () => {
  // Entorno node (ver vitest.config): se arma un window mínimo con un localStorage de mentira.
  function montarStorage() {
    const datos = new Map<string, string>();
    // window mínimo de prueba, solo lo que las funciones tocan
    globalThis.window = {
      localStorage: {
        getItem: (k: string) => datos.get(k) ?? null,
        setItem: (k: string, v: string) => { datos.set(k, v); },
        removeItem: (k: string) => { datos.delete(k); },
      },
    } as unknown as Window & typeof globalThis;
    return datos;
  }
  afterEach(() => {
    // @ts-expect-error -- limpiar el window de prueba entre tests
    delete globalThis.window;
  });

  it('recuerda que ya se mostró', () => {
    const datos = montarStorage();
    expect(yaSeMostroPushOnboarding()).toBe(false);
    marcarPushOnboardingVisto();
    expect(yaSeMostroPushOnboarding()).toBe(true);
    expect(datos.get(CLAVE_PUSH_VISTO)).toBe('1');
  });
  it('recuerda el permiso pendiente de completar al iniciar sesión, y lo puede limpiar', () => {
    montarStorage();
    expect(hayPushPendienteDeLogin()).toBe(false);
    marcarPushPendienteDeLogin(true);
    expect(hayPushPendienteDeLogin()).toBe(true);
    marcarPushPendienteDeLogin(false);
    expect(hayPushPendienteDeLogin()).toBe(false);
  });
  it('sin window (SSR) no explota y nada está marcado', () => {
    expect(yaSeMostroPushOnboarding()).toBe(false);
    expect(() => marcarPushOnboardingVisto()).not.toThrow();
    expect(hayPushPendienteDeLogin()).toBe(false);
  });
  it('localStorage bloqueado (modo privado) no explota', () => {
    // @ts-expect-error -- localStorage que lanza
    globalThis.window = { localStorage: { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); }, removeItem: () => {} } };
    expect(yaSeMostroPushOnboarding()).toBe(false);
    expect(() => marcarPushOnboardingVisto()).not.toThrow();
  });
});
