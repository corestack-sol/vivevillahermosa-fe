import { describe, it, expect, vi } from 'vitest';
import { crearEjecutorConEnfriamiento } from './ejecutorConEnfriamiento';

const LIMITE = new Error('429');
const esLimite = (e: unknown) => e === LIMITE;

describe('crearEjecutorConEnfriamiento', () => {
  it('ejecuta las tareas de una en una, en orden', async () => {
    const { ejecutar } = crearEjecutorConEnfriamiento({ cooldownMs: 1000, esLimite });
    const orden: string[] = [];
    const t = (n: string, ms: number) => async () => { orden.push(`ini-${n}`); await new Promise((r) => setTimeout(r, ms)); orden.push(`fin-${n}`); return n; };
    await Promise.all([ejecutar(t('a', 20), () => 'x'), ejecutar(t('b', 1), () => 'x'), ejecutar(t('c', 1), () => 'x')]);
    expect(orden).toEqual(['ini-a', 'fin-a', 'ini-b', 'fin-b', 'ini-c', 'fin-c']);
  });

  // El caso del reporte: cinco fotos a la vez y el servidor responde 429.
  it('tras el primer 429 NO vuelve a llamar al servidor durante el enfriamiento', async () => {
    const t = 0;
    const { ejecutar } = crearEjecutorConEnfriamiento({ cooldownMs: 60_000, esLimite, ahora: () => t });
    const red = vi.fn().mockRejectedValue(LIMITE);
    const resultados = await Promise.all([1, 2, 3, 4, 5].map(() => ejecutar(red, () => 'respaldo')));
    expect(resultados).toEqual(['respaldo', 'respaldo', 'respaldo', 'respaldo', 'respaldo']);
    expect(red).toHaveBeenCalledTimes(1); // una sola petición, no cinco
  });

  it('pasado el enfriamiento vuelve a intentar', async () => {
    let t = 0;
    const { ejecutar, estaBloqueado } = crearEjecutorConEnfriamiento({ cooldownMs: 60_000, esLimite, ahora: () => t });
    await ejecutar(() => Promise.reject(LIMITE), () => 'respaldo');
    expect(estaBloqueado()).toBe(true);
    t = 60_001;
    expect(estaBloqueado()).toBe(false);
    expect(await ejecutar(async () => 'ok', () => 'respaldo')).toBe('ok');
  });

  it('un error que no es de límite se propaga y no bloquea', async () => {
    const { ejecutar, estaBloqueado } = crearEjecutorConEnfriamiento({ cooldownMs: 1000, esLimite });
    await expect(ejecutar(() => Promise.reject(new Error('otro')), () => 'r')).rejects.toThrow('otro');
    expect(estaBloqueado()).toBe(false);
    expect(await ejecutar(async () => 'ok', () => 'r')).toBe('ok');
  });
});
