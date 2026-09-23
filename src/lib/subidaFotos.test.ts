import { describe, it, expect, vi } from 'vitest';
import { subirFotos, type OpcionesSubida } from './subidaFotos';

const LIMITE = new Error('429');
const base: OpcionesSubida = { concurrencia: 2, reintentosPorLimite: 2, esperaMs: () => 0, esLimite: (e) => e === LIMITE, dormir: async () => {} };
const fotos = () => [{ n: 1 }, { n: 2 }, { n: 3 }];

describe('subirFotos', () => {
  it('sube todas y devuelve las URLs en el orden original', async () => {
    const items = fotos();
    const r = await subirFotos(items, new Map(), (f) => f, async (f) => `url-${f.n}`, base);
    expect(r.urls).toEqual(['url-1', 'url-2', 'url-3']);
    expect(r.fallos).toEqual([]);
  });

  // El reporte: reintentar volvía a subir TODO. Ahora solo lo que falta.
  it('un reintento NO vuelve a enviar lo ya subido', async () => {
    const items = fotos();
    const cache = new Map<{ n: number }, string>();
    const subir = vi.fn(async (f: { n: number }) => { if (f.n === 3) throw new Error('falla la 3'); return `url-${f.n}`; });
    const r1 = await subirFotos(items, cache, (f) => f, subir, base);
    expect(r1.urls).toEqual(['url-1', 'url-2', null]);
    expect(subir).toHaveBeenCalledTimes(3);

    const subir2 = vi.fn(async (f: { n: number }) => `url-${f.n}`);
    const r2 = await subirFotos(items, cache, (f) => f, subir2, base);
    expect(r2.urls).toEqual(['url-1', 'url-2', 'url-3']);
    expect(subir2).toHaveBeenCalledTimes(1); // solo la que faltaba
    expect(r2.reutilizadas).toBe(2);
  });

  it('nunca hay más de `concurrencia` subidas a la vez', async () => {
    let activas = 0, pico = 0;
    const items = [1, 2, 3, 4, 5].map((n) => ({ n }));
    await subirFotos(items, new Map(), (f) => f, async (f) => {
      activas++; pico = Math.max(pico, activas);
      await new Promise((r) => setTimeout(r, 5));
      activas--; return `u${f.n}`;
    }, { ...base, concurrencia: 2 });
    expect(pico).toBe(2);
  });

  it('un 429 se reintenta con espera y luego pasa', async () => {
    const dormir = vi.fn(async () => {});
    let veces = 0;
    const r = await subirFotos([{ n: 1 }], new Map(), (f) => f, async () => { if (veces++ < 2) throw LIMITE; return 'ok'; }, { ...base, dormir });
    expect(r.urls).toEqual(['ok']);
    expect(dormir).toHaveBeenCalledTimes(2);
  });

  it('si el 429 persiste tras los reintentos, marca el fallo como límite (no como foto mala)', async () => {
    const subir = vi.fn(async () => { throw LIMITE; });
    const r = await subirFotos([{ n: 1 }], new Map(), (f) => f, subir, base);
    expect(r.urls).toEqual([null]);
    expect(r.fallos[0]).toMatchObject({ indice: 0, limite: true });
    expect(subir).toHaveBeenCalledTimes(3); // 1 + 2 reintentos, no más
  });

  it('un fallo que no es de límite no se reintenta', async () => {
    const subir = vi.fn(async () => { throw new Error('foto inválida'); });
    const r = await subirFotos([{ n: 1 }], new Map(), (f) => f, subir, base);
    expect(r.fallos[0].limite).toBe(false);
    expect(subir).toHaveBeenCalledTimes(1);
  });
});
