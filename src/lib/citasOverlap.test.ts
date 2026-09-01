import { describe, it, expect } from 'vitest';
import { citaSolapada, type CitaExistente } from './citasOverlap';

const mk = (over: Partial<CitaExistente> = {}): CitaExistente => ({
  id: 'c1',
  titulo: 'Visita',
  nombreCliente: 'Juan Pérez',
  fecha: '2026-09-10T11:00:00.000Z',
  duracionMin: 30,
  estado: 'confirmada',
  ...over,
});

describe('citaSolapada', () => {
  it('sin citas: no hay traslape', () => {
    expect(citaSolapada({ fecha: '2026-09-10T11:00:00.000Z', duracionMin: 30 }, [])).toBeNull();
  });

  it('mismo horario exacto: traslape', () => {
    const existente = mk();
    expect(citaSolapada({ fecha: '2026-09-10T11:00:00.000Z', duracionMin: 30 }, [existente])).toBe(existente);
  });

  it('nueva cita empieza dentro de una existente: traslape', () => {
    const existente = mk({ fecha: '2026-09-10T11:00:00.000Z', duracionMin: 60 }); // 11:00-12:00
    const r = citaSolapada({ fecha: '2026-09-10T11:30:00.000Z', duracionMin: 30 }, [existente]); // 11:30-12:00
    expect(r).toBe(existente);
  });

  it('nueva cita termina justo cuando empieza la existente: NO hay traslape (back-to-back)', () => {
    const existente = mk({ fecha: '2026-09-10T11:00:00.000Z', duracionMin: 30 }); // 11:00-11:30
    const r = citaSolapada({ fecha: '2026-09-10T10:30:00.000Z', duracionMin: 30 }, [existente]); // 10:30-11:00
    expect(r).toBeNull();
  });

  it('citas en horas completamente distintas: sin traslape', () => {
    const existente = mk({ fecha: '2026-09-10T09:00:00.000Z', duracionMin: 30 });
    const r = citaSolapada({ fecha: '2026-09-10T15:00:00.000Z', duracionMin: 30 }, [existente]);
    expect(r).toBeNull();
  });

  it('una cita cancelada nunca cuenta como traslape', () => {
    const existente = mk({ estado: 'cancelada' });
    const r = citaSolapada({ fecha: '2026-09-10T11:00:00.000Z', duracionMin: 30 }, [existente]);
    expect(r).toBeNull();
  });

  it('excluirId ignora la propia cita al editar', () => {
    const existente = mk({ id: 'self' });
    const r = citaSolapada({ fecha: '2026-09-10T11:00:00.000Z', duracionMin: 30 }, [existente], 'self');
    expect(r).toBeNull();
  });

  it('fecha del candidato inválida: no truena, regresa null', () => {
    const existente = mk();
    expect(citaSolapada({ fecha: 'no-es-fecha', duracionMin: 30 }, [existente])).toBeNull();
  });

  it('devuelve la PRIMERA cita traslapada entre varias', () => {
    const a = mk({ id: 'a', fecha: '2026-09-10T11:00:00.000Z', duracionMin: 30 });
    const b = mk({ id: 'b', fecha: '2026-09-10T11:15:00.000Z', duracionMin: 30 });
    const r = citaSolapada({ fecha: '2026-09-10T11:20:00.000Z', duracionMin: 10 }, [a, b]);
    expect(r).toBe(a);
  });
});
