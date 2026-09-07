import { describe, it, expect } from 'vitest';
import { notificacionHref, agruparNotificaciones, type Notificacion } from './useNotificaciones';

function n(overrides: Partial<Notificacion> & { id: string }): Notificacion {
  return {
    titulo: 'x', mensaje: 'x', propiedadId: null, leida: false, createdAt: '2026-09-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('agruparNotificaciones', () => {
  it('colapsa varios mensajes de la misma conversación en un solo grupo', () => {
    const items = [
      n({ id: '3', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: false, mensaje: 'tercero' }),
      n({ id: '2', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: false, mensaje: 'segundo' }),
      n({ id: '1', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: false, mensaje: 'primero' }),
    ];
    const grupos = agruparNotificaciones(items);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].count).toBe(3);
    expect(grupos[0].idsAgrupados).toEqual(['3', '2', '1']);
    // El representante es el primero de la lista (más reciente) — conserva su mensaje.
    expect(grupos[0].mensaje).toBe('tercero');
  });

  it('el grupo queda sin leer si CUALQUIERA de las notificaciones que representa sigue sin leer', () => {
    const items = [
      n({ id: '2', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: true }),
      n({ id: '1', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: false }),
    ];
    expect(agruparNotificaciones(items)[0].leida).toBe(false);
  });

  it('chat viejo ya leído + un mensaje nuevo hoy: sinLeerCount es 1, no el total historico del hilo', () => {
    // Caso real preguntado 2026-09-07: si un hilo tuvo 3 notificaciones ya
    // leídas hace días y hoy llega 1 mensaje nuevo, el badge no debe decir
    // "×4" (asustaría con historial viejo) — debe decir lo que de verdad
    // es nuevo: 1.
    const items = [
      n({ id: '4', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: false, mensaje: 'mensaje de hoy' }),
      n({ id: '3', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: true }),
      n({ id: '2', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: true }),
      n({ id: '1', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: true }),
    ];
    const grupo = agruparNotificaciones(items)[0];
    expect(grupo.count).toBe(4);
    expect(grupo.sinLeerCount).toBe(1);
    expect(grupo.leida).toBe(false);
    expect(grupo.mensaje).toBe('mensaje de hoy');
  });

  it('grupo totalmente leído: sinLeerCount es 0', () => {
    const items = [
      n({ id: '2', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: true }),
      n({ id: '1', tipo: 'mensaje_nuevo', conversacionId: 'c1', leida: true }),
    ];
    const grupo = agruparNotificaciones(items)[0];
    expect(grupo.sinLeerCount).toBe(0);
    expect(grupo.leida).toBe(true);
  });

  it('no agrupa conversaciones distintas', () => {
    const items = [
      n({ id: '1', tipo: 'mensaje_nuevo', conversacionId: 'c1' }),
      n({ id: '2', tipo: 'mensaje_nuevo', conversacionId: 'c2' }),
    ];
    expect(agruparNotificaciones(items)).toHaveLength(2);
  });

  it('no agrupa contacto_propiedad (legado, sin conversacionId) aunque compartan propiedadId', () => {
    const items = [
      n({ id: '1', tipo: 'contacto_propiedad', propiedadId: 'p1' }),
      n({ id: '2', tipo: 'contacto_propiedad', propiedadId: 'p1' }),
    ];
    const grupos = agruparNotificaciones(items);
    expect(grupos).toHaveLength(2);
    expect(grupos.every((g) => g.count === 1)).toBe(true);
  });

  it('lista vacía da lista vacía', () => {
    expect(agruparNotificaciones([])).toEqual([]);
  });
});

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
