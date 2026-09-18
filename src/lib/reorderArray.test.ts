import { describe, it, expect } from 'vitest';
import { moverElemento } from './reorderArray';

describe('moverElemento', () => {
  it('mueve un elemento hacia adelante, "antes de" un objetivo posterior', () => {
    expect(moverElemento(['A', 'B', 'C', 'D'], 0, 2, 'before')).toEqual(['B', 'A', 'C', 'D']);
  });

  it('mueve un elemento hacia adelante, "después de" un objetivo posterior', () => {
    expect(moverElemento(['A', 'B', 'C', 'D'], 0, 2, 'after')).toEqual(['B', 'C', 'A', 'D']);
  });

  it('mueve un elemento hacia atrás, "antes de" un objetivo anterior', () => {
    expect(moverElemento(['A', 'B', 'C', 'D'], 3, 0, 'before')).toEqual(['D', 'A', 'B', 'C']);
  });

  it('mueve un elemento hacia atrás, "después de" un objetivo anterior', () => {
    expect(moverElemento(['A', 'B', 'C', 'D'], 3, 0, 'after')).toEqual(['A', 'D', 'B', 'C']);
  });

  it('soltar "antes de" el mismo elemento no cambia nada', () => {
    expect(moverElemento(['A', 'B', 'C', 'D'], 1, 1, 'before')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('soltar "después de" el mismo elemento no cambia nada', () => {
    expect(moverElemento(['A', 'B', 'C', 'D'], 1, 1, 'after')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('soltar "después de" el elemento inmediatamente anterior no cambia nada (ya está ahí)', () => {
    // Arrastrar B y soltarlo "después de" A — B ya está justo después de A.
    expect(moverElemento(['A', 'B', 'C', 'D'], 1, 0, 'after')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('mueve el último elemento al frente', () => {
    expect(moverElemento(['A', 'B', 'C', 'D'], 3, 0, 'before')).toEqual(['D', 'A', 'B', 'C']);
  });

  it('mueve el primer elemento al final', () => {
    expect(moverElemento(['A', 'B', 'C', 'D'], 0, 3, 'after')).toEqual(['B', 'C', 'D', 'A']);
  });

  it('ignora índices fuera de rango, devuelve el arreglo sin cambios', () => {
    const arr = ['A', 'B', 'C'];
    expect(moverElemento(arr, -1, 1, 'before')).toBe(arr);
    expect(moverElemento(arr, 0, 5, 'before')).toBe(arr);
  });

  it('no muta el arreglo original', () => {
    const original = ['A', 'B', 'C'];
    moverElemento(original, 0, 2, 'after');
    expect(original).toEqual(['A', 'B', 'C']);
  });
});
