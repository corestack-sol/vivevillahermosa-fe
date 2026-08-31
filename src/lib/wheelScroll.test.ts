import { describe, it, expect } from 'vitest';
import { calcularScrollPorRueda } from './wheelScroll';

describe('calcularScrollPorRueda', () => {
  it('sin desborde (scrollWidth <= clientWidth): no mueve scrollLeft', () => {
    const el = { scrollWidth: 100, clientWidth: 100, scrollLeft: 0 };
    expect(calcularScrollPorRueda(el, 50, 0)).toBe(0);
  });

  it('scrollWidth igual a clientWidth exacto: cuenta como sin desborde (<=)', () => {
    const el = { scrollWidth: 200, clientWidth: 200, scrollLeft: 10 };
    expect(calcularScrollPorRueda(el, 50, 0)).toBe(10);
  });

  it('con desborde y deltaY distinto de 0: usa deltaY', () => {
    const el = { scrollWidth: 300, clientWidth: 100, scrollLeft: 10 };
    expect(calcularScrollPorRueda(el, 25, 0)).toBe(35);
  });

  it('con desborde y deltaY negativo (rueda hacia arriba/izquierda): resta', () => {
    const el = { scrollWidth: 300, clientWidth: 100, scrollLeft: 50 };
    expect(calcularScrollPorRueda(el, -20, 0)).toBe(30);
  });

  it('con desborde y deltaY=0 pero deltaX distinto de 0 (swipe horizontal de trackpad): usa deltaX', () => {
    const el = { scrollWidth: 300, clientWidth: 100, scrollLeft: 10 };
    expect(calcularScrollPorRueda(el, 0, 15)).toBe(25);
  });

  it('con desborde y ambos deltas en 0: no mueve scrollLeft', () => {
    const el = { scrollWidth: 300, clientWidth: 100, scrollLeft: 40 };
    expect(calcularScrollPorRueda(el, 0, 0)).toBe(40);
  });

  it('deltaY tiene prioridad sobre deltaX cuando ambos son distintos de 0', () => {
    const el = { scrollWidth: 300, clientWidth: 100, scrollLeft: 0 };
    expect(calcularScrollPorRueda(el, 5, 100)).toBe(5);
  });
});
