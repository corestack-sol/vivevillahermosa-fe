import { describe, it, expect, vi } from 'vitest';
import { pedirSesion } from './sesion';

const sinEspera = { dormir: async () => {} };

describe('pedirSesion', () => {
  it('devuelve el usuario cuando el backend lo entrega', async () => {
    const r = await pedirSesion(async () => ({ user: { id: 'u1' } }), sinEspera);
    expect(r).toEqual({ tipo: 'usuario', user: { id: 'u1' } });
  });

  it('user: null es "sin sesión" definitivo y no reintenta', async () => {
    const pedir = vi.fn(async () => ({ user: null }));
    const r = await pedirSesion(pedir, sinEspera);
    expect(r).toEqual({ tipo: 'sin-sesion' });
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('un 401/403 es "sin sesión" definitivo y no reintenta', async () => {
    const pedir = vi.fn(async () => { throw Object.assign(new Error('x'), { status: 401 }); });
    const r = await pedirSesion(pedir, { ...sinEspera, esSinSesion: (e) => (e as { status?: number }).status === 401 });
    expect(r).toEqual({ tipo: 'sin-sesion' });
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('un fallo transitorio se reintenta y, si la segunda vez responde, se usa', async () => {
    let llamadas = 0;
    const r = await pedirSesion(async () => {
      llamadas++;
      if (llamadas === 1) throw new TypeError('Failed to fetch');
      return { user: { id: 'u1' } };
    }, sinEspera);
    expect(r).toEqual({ tipo: 'usuario', user: { id: 'u1' } });
    expect(llamadas).toBe(2);
  });

  it('si falla también el reintento devuelve "error" (NO "sin sesión")', async () => {
    const pedir = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const r = await pedirSesion(pedir, sinEspera);
    expect(r).toEqual({ tipo: 'error' });
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it('espera entre intentos con el tiempo indicado', async () => {
    const dormir = vi.fn(async () => {});
    await pedirSesion(async () => { throw new Error('x'); }, { dormir, esperarMs: 1234 });
    expect(dormir).toHaveBeenCalledWith(1234);
  });

  it('reintentos: 0 no reintenta', async () => {
    const pedir = vi.fn(async () => { throw new Error('x'); });
    const r = await pedirSesion(pedir, { ...sinEspera, reintentos: 0 });
    expect(r).toEqual({ tipo: 'error' });
    expect(pedir).toHaveBeenCalledTimes(1);
  });
});
