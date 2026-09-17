import { describe, it, expect } from 'vitest';
import { createRequestGuard } from './requestGuard';

describe('createRequestGuard', () => {
  it('a lone request is current when it resolves', () => {
    const guard = createRequestGuard();
    const id = guard.start();
    expect(guard.isCurrent(id)).toBe(true);
  });

  it('an older request is NOT current once a newer one has started, regardless of resolution order', () => {
    const guard = createRequestGuard();
    const older = guard.start(); // ej. bounds de zoom-in
    const newer = guard.start(); // ej. bounds de zoom-out, disparado después

    // El caso real del bug: la llamada MÁS VIEJA resuelve DESPUÉS (red más
    // lenta) — no debe poder pisar el resultado de la más nueva.
    expect(guard.isCurrent(older)).toBe(false);
    expect(guard.isCurrent(newer)).toBe(true);
  });

  it('stays consistent across more than two overlapping requests', () => {
    const guard = createRequestGuard();
    const a = guard.start();
    const b = guard.start();
    const c = guard.start();

    expect(guard.isCurrent(a)).toBe(false);
    expect(guard.isCurrent(b)).toBe(false);
    expect(guard.isCurrent(c)).toBe(true);
  });

  it('a fully sequential request/response cycle (no overlap) always stays current', () => {
    const guard = createRequestGuard();
    const first = guard.start();
    expect(guard.isCurrent(first)).toBe(true); // resuelve antes de que empiece la siguiente

    const second = guard.start();
    expect(guard.isCurrent(second)).toBe(true);
  });
});
