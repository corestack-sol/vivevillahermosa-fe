import { describe, it, expect } from 'vitest';
import { contarPropiedadesVivas, LIMITE_PROPIEDADES, ESTADOS_QUE_CUENTAN_PARA_LIMITE } from './useLimitePropiedades';

describe('contarPropiedadesVivas', () => {
  it('cuenta activas y pausadas juntas — política confirmada en vivo 2026-09-02', () => {
    const propiedades = [
      { estado: 'activa' },
      { estado: 'activa' },
      { estado: 'pausada' },
    ];
    expect(contarPropiedadesVivas(propiedades)).toBe(3);
  });

  it('NO cuenta vendida/rentada/vencida — cerrar una propiedad sí libera espacio', () => {
    const propiedades = [
      { estado: 'activa' },
      { estado: 'vendida' },
      { estado: 'rentada' },
      { estado: 'vencida' },
    ];
    expect(contarPropiedadesVivas(propiedades)).toBe(1);
  });

  it('lista vacía cuenta 0', () => {
    expect(contarPropiedadesVivas([])).toBe(0);
  });

  it('el bug real de 2026-09-02 no se repite: eliminar una propiedad y quedar con menos de 3 vivas ya no bloquea', () => {
    // Reproduce el escenario exacto verificado en vivo (docs/BACKEND-
    // LIMITE-PROPIEDADES-02092026.md): 1 activa + 1 pausada tras eliminar
    // una tercera — debe quedar bajo el límite.
    const propiedades = [{ estado: 'activa' }, { estado: 'pausada' }];
    expect(contarPropiedadesVivas(propiedades)).toBeLessThan(LIMITE_PROPIEDADES);
  });

  it('ESTADOS_QUE_CUENTAN_PARA_LIMITE es exactamente activa+pausada, ni más ni menos', () => {
    // Si alguien agrega un estado nuevo al enum de Property sin decidir a
    // propósito si cuenta contra el límite, esta prueba lo hace visible
    // en vez de quedar en silencio.
    expect([...ESTADOS_QUE_CUENTAN_PARA_LIMITE].sort()).toEqual(['activa', 'pausada']);
  });
});
