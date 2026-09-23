import { describe, it, expect, vi } from 'vitest';
import { memoConTtl } from './memoConTtl';

describe('memoConTtl', () => {
  it('varias llamadas dentro del TTL hacen UNA sola petición', async () => {
    const red = vi.fn(async () => 'catalogo');
    const get = memoConTtl(red, 60_000, () => 0);
    expect(await Promise.all([get(), get(), get()])).toEqual(['catalogo', 'catalogo', 'catalogo']);
    expect(red).toHaveBeenCalledTimes(1);
  });
  it('pasado el TTL vuelve a pedir', async () => {
    let t = 0;
    const red = vi.fn(async () => 'x');
    const get = memoConTtl(red, 1000, () => t);
    await get(); t = 1001; await get();
    expect(red).toHaveBeenCalledTimes(2);
  });
  it('un fallo no se memoriza', async () => {
    const red = vi.fn().mockRejectedValueOnce(new Error('429')).mockResolvedValueOnce('ok');
    const get = memoConTtl(red, 60_000, () => 0);
    await expect(get()).rejects.toThrow('429');
    expect(await get()).toBe('ok');
    expect(red).toHaveBeenCalledTimes(2);
  });
});
