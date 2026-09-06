import { describe, it, expect } from 'vitest';
import { combinarBandejaMensajes, type ConversacionResumen, type MensajeLegado } from './mensajeria';

const propiedad = { id: 'p1', titulo: 'Casa en Centro', slug: 'casa-en-centro', foto: null };

describe('combinarBandejaMensajes', () => {
  it('junta conversaciones y mensajes legado en una sola lista', () => {
    const conversaciones: ConversacionResumen[] = [
      { id: 'c1', propiedad, otraPersona: { id: 'u1', nombre: 'Ana' }, ultimoMensaje: { texto: 'Hola', createdAt: '2026-09-01T10:00:00Z', remitenteId: 'u1' }, noLeidos: 1 },
    ];
    const legados = [
      { propiedad, mensaje: { id: 'm1', nombre: 'Beto', telefono: '9930000000', email: 'beto@x.com', mensaje: 'Interesado', leido: false, createdAt: '2026-09-02T10:00:00Z' } as MensajeLegado },
    ];
    const resultado = combinarBandejaMensajes(conversaciones, legados);
    expect(resultado).toHaveLength(2);
    expect(resultado.map((r) => r.tipo)).toEqual(['legado', 'conversacion']); // legado es mas reciente
  });

  it('ordena por fecha, mas reciente primero, sin importar el tipo', () => {
    const conversaciones: ConversacionResumen[] = [
      { id: 'c1', propiedad, otraPersona: { id: 'u1', nombre: 'Ana' }, ultimoMensaje: { texto: 'viejo', createdAt: '2026-01-01T00:00:00Z', remitenteId: 'u1' }, noLeidos: 0 },
      { id: 'c2', propiedad, otraPersona: { id: 'u2', nombre: 'Carla' }, ultimoMensaje: { texto: 'nuevo', createdAt: '2026-09-05T00:00:00Z', remitenteId: 'u2' }, noLeidos: 0 },
    ];
    const resultado = combinarBandejaMensajes(conversaciones, []);
    expect(resultado.map((r) => r.id)).toEqual(['c2', 'c1']);
  });

  it('un item legado trae propiedadId/mensajeId para poder navegar a el', () => {
    const legados = [
      { propiedad, mensaje: { id: 'm1', nombre: 'Beto', telefono: '993', email: 'b@x.com', mensaje: 'hola', leido: true, createdAt: '2026-09-02T10:00:00Z' } as MensajeLegado },
    ];
    const resultado = combinarBandejaMensajes([], legados);
    expect(resultado[0]).toMatchObject({ tipo: 'legado', propiedadId: 'p1', mensajeId: 'm1', noLeidos: 0 });
  });

  it('lista vacia de ambos da lista vacia', () => {
    expect(combinarBandejaMensajes([], [])).toEqual([]);
  });
});
