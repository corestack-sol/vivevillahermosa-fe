import { describe, it, expect } from 'vitest';
import { calidadDeRender, FRAGMENT_SHADER } from './rayosDeLuz';

describe('calidadDeRender', () => {
  it('en escritorio usa la densidad del dispositivo con tope de 1.5', () => {
    expect(calidadDeRender(1280, 1)).toBe(1);
    expect(calidadDeRender(1280, 2)).toBe(1.5);
    expect(calidadDeRender(1280, 3)).toBe(1.5);
  });
  it('en pantallas chicas renderiza a menor resolución (batería y fluidez)', () => {
    expect(calidadDeRender(390, 3)).toBe(0.75);
    expect(calidadDeRender(390, 1)).toBe(0.75);
  });
  it('en pantallas muy anchas también baja la resolución', () => {
    expect(calidadDeRender(2560, 1)).toBeCloseTo(0.75);
  });
  it('nunca devuelve 0 ni negativos', () => {
    expect(calidadDeRender(1280, 0)).toBeGreaterThan(0);
  });
});

describe('shader', () => {
  it('declara los uniforms que el código le manda', () => {
    expect(FRAGMENT_SHADER).toContain('uniform vec2 u_res');
    expect(FRAGMENT_SHADER).toContain('uniform float u_t');
  });
});
