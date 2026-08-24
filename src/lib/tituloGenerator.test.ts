import { describe, it, expect } from 'vitest';
import { generarTituloAutomatico } from './tituloGenerator';

describe('generarTituloAutomatico', () => {
  it('builds a full title with tipo, operacion, colonia+municipio, recamaras, and m2', () => {
    const titulo = generarTituloAutomatico({
      tipo: 'casa', operacion: 'venta', colonia: 'Reforma', municipio: 'Centro', recamaras: 3, m2Construidos: 180,
    });
    expect(titulo).toBe('Casa en venta en Reforma, Villahermosa — 3 rec, 180 m²');
  });

  it('maps municipio "Centro" to the more recognizable "Villahermosa"', () => {
    const titulo = generarTituloAutomatico({ tipo: 'casa', operacion: 'renta', municipio: 'Centro' });
    expect(titulo).toContain('Villahermosa');
    expect(titulo).not.toContain('en Centro');
  });

  it('keeps other municipios as-is (no renaming)', () => {
    const titulo = generarTituloAutomatico({ tipo: 'casa', operacion: 'venta', municipio: 'Cárdenas' });
    expect(titulo).toContain('Cárdenas');
  });

  it('falls back to m2Terreno when m2Construidos is absent (terreno case)', () => {
    const titulo = generarTituloAutomatico({ tipo: 'terreno', operacion: 'venta', m2Terreno: 500 });
    expect(titulo).toContain('500 m²');
  });

  it('prefers m2Construidos over m2Terreno when both are present', () => {
    const titulo = generarTituloAutomatico({ tipo: 'casa', operacion: 'venta', m2Construidos: 150, m2Terreno: 300 });
    expect(titulo).toContain('150 m²');
    expect(titulo).not.toContain('300 m²');
  });

  it('omits the recamaras/m2 detail segment entirely when neither is provided', () => {
    const titulo = generarTituloAutomatico({ tipo: 'local', operacion: 'renta' });
    expect(titulo).not.toContain('—');
  });

  it('omits recamaras specifically when zero (falsy) — 0 recamaras never renders as "0 rec"', () => {
    const titulo = generarTituloAutomatico({ tipo: 'casa', operacion: 'venta', recamaras: 0, m2Construidos: 100 });
    expect(titulo).not.toContain('0 rec');
  });

  it('falls back to "Propiedad" for an unrecognized tipo value instead of showing nothing', () => {
    const titulo = generarTituloAutomatico({ tipo: 'algo-invalido', operacion: 'venta' });
    expect(titulo).toContain('Propiedad');
  });

  it('omits the "en <lugar>" segment when neither colonia nor municipio is provided', () => {
    const titulo = generarTituloAutomatico({ tipo: 'casa', operacion: 'venta' });
    expect(titulo).toBe('Casa en venta');
  });

  it('always produces a title of at least 10 characters (the publishSchema minimum) for every real tipo/operacion combo', () => {
    const tipos = ['casa', 'departamento', 'terreno', 'local', 'oficina', 'bodega', 'habitacion'];
    for (const tipo of tipos) {
      for (const operacion of ['venta', 'renta']) {
        const titulo = generarTituloAutomatico({ tipo, operacion });
        expect(titulo.length).toBeGreaterThanOrEqual(10);
      }
    }
  });
});
