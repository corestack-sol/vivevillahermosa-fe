import { describe, it, expect } from 'vitest';
import { notificacionHref } from './useNotificaciones';

describe('notificacionHref', () => {
  it('manda al hilo de chat cuando tipo es mensaje_nuevo y trae conversacionId', () => {
    expect(notificacionHref({ tipo: 'mensaje_nuevo', propiedadId: 'p1', conversacionId: 'c1' }))
      .toBe('/dashboard/mensajes/c1');
  });

  it('ignora conversacionId si tipo NO es mensaje_nuevo, aunque venga presente', () => {
    // Caso defensivo — un backend que algún día mande conversacionId "de
    // más" en un tipo distinto no debe hacer que esto rutee a un chat
    // que no corresponde.
    expect(notificacionHref({ tipo: 'contacto_propiedad', propiedadId: 'p1', conversacionId: 'c1' }))
      .toBe('/dashboard/mensajes');
  });

  it('mensaje_nuevo sin conversacionId cae al destino genérico de propiedadId', () => {
    // No debería pasar en la práctica (el backend siempre lo manda junto),
    // pero si pasara, mandar a un link roto (/dashboard/mensajes/undefined)
    // sería peor que caer al destino de respaldo.
    expect(notificacionHref({ tipo: 'mensaje_nuevo', propiedadId: 'p1' }))
      .toBe('/propiedades/p1');
  });

  it('contacto_propiedad manda a la bandeja unificada de mensajes (pedido explícito 2026-09-06)', () => {
    // Sin remitenteId en el sistema viejo no se puede armar un link a un
    // mensaje específico, así que aterriza en la bandeja general en vez
    // de la pantalla vieja por-propiedad — ahí sale mezclado con las
    // conversaciones reales, ver combinarBandejaMensajes en mensajeria.ts.
    expect(notificacionHref({ tipo: 'contacto_propiedad', propiedadId: 'p1' }))
      .toBe('/dashboard/mensajes');
  });

  it('cualquier otro tipo con propiedadId manda a la ficha pública', () => {
    expect(notificacionHref({ tipo: 'otro_tipo_futuro', propiedadId: 'p1' }))
      .toBe('/propiedades/p1');
  });

  it('sin tipo (undefined) y con propiedadId manda a la ficha pública', () => {
    expect(notificacionHref({ propiedadId: 'p1' })).toBe('/propiedades/p1');
  });

  it('sin propiedadId manda al panel, sin importar el tipo', () => {
    expect(notificacionHref({ tipo: 'mensaje_nuevo', propiedadId: null })).toBe('/dashboard');
    expect(notificacionHref({ propiedadId: null })).toBe('/dashboard');
  });
});
