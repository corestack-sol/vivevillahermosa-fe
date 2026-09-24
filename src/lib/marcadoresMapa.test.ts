import { describe, it, expect, vi } from 'vitest';
import { reunirMarcadores } from './marcadoresMapa';

const props = (desde: number, cuantos: number) => Array.from({ length: cuantos }, (_, i) => ({ id: `p${desde + i}` }));

describe('reunirMarcadores', () => {
  // El reporte: 31 propiedades y el mapa solo mostraba las 12 de la primera página.
  it('con más propiedades que la página visible, el mapa trae TODAS las que cumplen (31, no 12)', async () => {
    const pedir = vi.fn(async () => props(1, 31));
    const r = await reunirMarcadores({ total: 31, primeraPagina: props(1, 12), pedirPagina: pedir });
    expect(r).toHaveLength(31);
    expect(pedir).toHaveBeenCalledTimes(1); // una sola petición de 100
  });

  it('si el listado ya tiene todo, no pide nada más', async () => {
    const pedir = vi.fn();
    const primera = props(1, 8);
    expect(await reunirMarcadores({ total: 8, primeraPagina: primera, pedirPagina: pedir })).toBe(primera);
    expect(pedir).not.toHaveBeenCalled();
  });

  it('con más de 100 pide por páginas de 100 y no repite propiedades', async () => {
    const pedir = vi.fn(async (pagina: number) => props((pagina - 1) * 100 + 1, pagina === 3 ? 20 : 100));
    const r = await reunirMarcadores({ total: 220, primeraPagina: props(1, 12), pedirPagina: pedir });
    expect(r).toHaveLength(220);
    expect(new Set(r.map((p) => p.id)).size).toBe(220);
    expect(pedir.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
  });

  it('respeta el tope de páginas (no descarga el catálogo entero a gran escala)', async () => {
    const pedir = vi.fn(async (pagina: number) => props((pagina - 1) * 100 + 1, 100));
    const r = await reunirMarcadores({ total: 5000, primeraPagina: props(1, 12), pedirPagina: pedir, maxPaginas: 5 });
    expect(pedir).toHaveBeenCalledTimes(5);
    expect(r).toHaveLength(500);
  });

  it('deja de pedir cuando una página viene incompleta', async () => {
    const pedir = vi.fn(async () => props(1, 40));
    await reunirMarcadores({ total: 500, primeraPagina: props(1, 12), pedirPagina: pedir });
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('si la petición falla, el error se propaga (quien llama conserva lo que ya tiene)', async () => {
    await expect(reunirMarcadores({ total: 31, primeraPagina: props(1, 12), pedirPagina: async () => { throw new Error('429'); } })).rejects.toThrow('429');
  });
});
