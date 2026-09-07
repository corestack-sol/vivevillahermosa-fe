import { describe, it, expect } from 'vitest';
import { pinHtml, pinInnerHtml } from './MapView';

// Únicas dos funciones puras de MapView.tsx (todo lo demás depende de un
// mapa MapLibre real montado en el DOM) — pedido explícito 2026-09-07:
// pinInnerHtml se separó de pinHtml el mismo día (optimización de
// fluidez, ver actualizarSeleccion en MapView.tsx) para poder actualizar
// el halo de un pin sin recrear el marcador completo. Estas pruebas
// verifican que ambas sigan generando exactamente el HTML esperado.

describe('pinInnerHtml', () => {
  it('pin inactivo: sombra simple, sin halo blanco/verde', () => {
    const html = pinInnerHtml('#10B981', '#059669', '$6k/mo', false);
    expect(html).toContain('background:#10B981');
    expect(html).toContain('$6k/mo');
    expect(html).toContain('0 2px 8px rgba(0,0,0,.22), 0 0 0 2.5px #059669');
    expect(html).not.toContain('0 0 0 5px white');
  });

  it('pin activo (seleccionado): agrega el halo blanco + color por fuera', () => {
    const html = pinInnerHtml('#10B981', '#059669', '$6k/mo', true);
    expect(html).toContain('0 0 0 5px white, 0 0 0 7px #10B981');
  });

  it('no envuelve en el contenedor exterior — eso es trabajo de pinHtml', () => {
    const html = pinInnerHtml('#10B981', '#059669', '$6k/mo', false);
    expect(html).not.toContain('display:inline-flex');
  });
});

describe('pinHtml', () => {
  it('envuelve pinInnerHtml en el contenedor con cursor:pointer', () => {
    const html = pinHtml('#EF4444', '#B91C1C', '$1.2M', true);
    expect(html).toContain('display:inline-flex');
    expect(html).toContain('cursor:pointer');
    expect(html).toContain('$1.2M');
    expect(html).toContain('0 0 0 7px #EF4444');
  });

  it('el contenido interior es exactamente el de pinInnerHtml con los mismos parámetros', () => {
    const inner = pinInnerHtml('#F59E0B', '#D97706', '$800k', false);
    const full = pinHtml('#F59E0B', '#D97706', '$800k', false);
    expect(full).toContain(inner);
  });
});
