import { describe, it, expect } from 'vitest';
import { resolverPausa, MOTIVO_OPERACION_CERRADA } from './cierrePublicacion';

describe('resolverPausa', () => {
  it('un motivo de pausa deja la propiedad pausada con su motivo', () => {
    expect(resolverPausa({ tipo: 'pausa', motivo: 'actualizando' }, 'venta')).toEqual({ estado: 'pausada', extra: { motivo: 'actualizando' } });
  });

  it('"otro" lleva su detalle; sin detalle no manda la clave', () => {
    expect(resolverPausa({ tipo: 'pausa', motivo: 'otro', motivoDetalle: 'viaje' }, 'renta').extra).toEqual({ motivo: 'otro', motivoDetalle: 'viaje' });
    expect(resolverPausa({ tipo: 'pausa', motivo: 'otro' }, 'renta').extra).not.toHaveProperty('motivoDetalle');
  });

  // Lo que evita que "se rentó" ocupe un lugar del límite gratuito y diga en
  // público que el propietario la pausó.
  it('"ya se vendió" en una venta deja la propiedad VENDIDA (no pausada)', () => {
    const r = resolverPausa({ tipo: 'cerrada', encontradoEnPlataforma: true }, 'venta');
    expect(r.estado).toBe('vendida');
    expect(r.extra).toEqual({ encontradoEnPlataforma: 'true' });
  });

  it('"ya se rentó" en una renta deja la propiedad RENTADA', () => {
    expect(resolverPausa({ tipo: 'cerrada', encontradoEnPlataforma: true }, 'renta').estado).toBe('rentada');
  });

  it('si no la encontraron por la plataforma, manda el medio y su detalle', () => {
    const r = resolverPausa({ tipo: 'cerrada', encontradoEnPlataforma: false, medioAlterno: 'otro', medioAlternoDetalle: 'letrero' }, 'renta');
    expect(r.extra).toEqual({ encontradoEnPlataforma: 'false', medioAlterno: 'otro', medioAlternoDetalle: 'letrero' });
  });

  it('los motivos de pausa van de más a menos probable y "otro" queda al final', async () => {
    const { MOTIVOS_PAUSA } = await import('./motivosCierre');
    expect(MOTIVOS_PAUSA.map((m) => m.value)).toEqual(['pausa_temporal', 'actualizando', 'mensajes_no_calificados', 'otro']);
  });

  it('el valor del motivo de cierre no choca con ningún motivo de pausa existente', async () => {
    const { MOTIVOS_PAUSA } = await import('./motivosCierre');
    expect(MOTIVOS_PAUSA.map((m) => m.value)).not.toContain(MOTIVO_OPERACION_CERRADA);
  });
});
