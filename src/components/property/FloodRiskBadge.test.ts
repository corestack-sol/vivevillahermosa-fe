import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FloodRiskBadge } from './FloodRiskBadge';
import { FLOOD_COLOR, FLOOD_LABEL } from '@/lib/floodColors';
import type { FloodRisk } from '@/types/property';

const NIVELES: FloodRisk[] = ['alto', 'medio', 'bajo', 'sin_dato'];
const badge = (props: Parameters<typeof FloodRiskBadge>[0]) => renderToStaticMarkup(createElement(FloodRiskBadge, props));

describe('FloodRiskBadge', () => {
  // Bug real visto en producción 2026-09-23: el backend ya devuelve
  // `sin_dato` y el badge solo conocía 3 niveles — `config[nivel]` quedaba
  // undefined y TODA la ficha de esa propiedad mostraba "No pudimos cargar
  // esta página".
  it.each(NIVELES)('renderiza el nivel %s sin lanzar, en versión completa y compacta', (nivel) => {
    expect(() => badge({ nivel, fuente: 'propietario', municipio: 'Centro' })).not.toThrow();
    expect(() => badge({ nivel, compact: true })).not.toThrow();
  });

  it('sin_dato dice que no hay información y no afirma seguridad ni inundación', () => {
    const html = badge({ nivel: 'sin_dato', fuente: 'propietario', municipio: 'Cárdenas' });
    expect(html).toContain('Sin información de riesgo de inundación');
    expect(html).toContain('no significa que sea segura ni que se inunde');
    expect(html).not.toMatch(/Atlas de Riesgos del Municipio de Centro, 2023/);
  });

  it('las clases de color existen para cada nivel (los tokens --color-flood-* no se pierden)', () => {
    for (const nivel of ['alto', 'medio', 'bajo'] as const) {
      const html = badge({ nivel });
      expect(html).toContain(`bg-flood-${nivel}-bg`);
      expect(html).toContain(`text-flood-${nivel}-title`);
    }
  });
});

describe('floodColors', () => {
  it('cubre los cuatro niveles (Record<FloodRisk,…> sin huecos)', () => {
    for (const nivel of NIVELES) {
      expect(FLOOD_COLOR[nivel]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(FLOOD_LABEL[nivel].length).toBeGreaterThan(5);
    }
  });
});
