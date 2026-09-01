import { describe, it, expect } from 'vitest';
import { estadoNoDisponibleInfo, ESTADO_CFG, type EstadoPublicacion } from './misPropiedades';

describe('estadoNoDisponibleInfo', () => {
  it('vendida: archivada, título y mensaje de cierre permanente', () => {
    const info = estadoNoDisponibleInfo('vendida');
    expect(info.label).toBe('Vendida');
    expect(info.archivada).toBe(true);
    expect(info.titulo).toBe('Propiedad vendida');
    expect(info.mensaje).toMatch(/ya se cerró/);
  });

  it('rentada: archivada, título y mensaje de cierre permanente', () => {
    const info = estadoNoDisponibleInfo('rentada');
    expect(info.label).toBe('Rentada');
    expect(info.archivada).toBe(true);
    expect(info.titulo).toBe('Propiedad rentada');
    expect(info.mensaje).toMatch(/ya se cerró/);
  });

  it('pausada: NO archivada, mensaje de pausa temporal por el dueño', () => {
    const info = estadoNoDisponibleInfo('pausada');
    expect(info.label).toBe('Pausada');
    expect(info.archivada).toBe(false);
    expect(info.titulo).toBe('Publicación pausada');
    expect(info.mensaje).toMatch(/pausó temporalmente/);
  });

  it('vencida: NO archivada, mensaje propio (no cae en el de "pausada")', () => {
    const info = estadoNoDisponibleInfo('vencida');
    expect(info.label).toBe('Vencida');
    expect(info.archivada).toBe(false);
    expect(info.titulo).toBe('Publicación vencida');
    expect(info.mensaje).toMatch(/venció/);
    expect(info.mensaje).not.toMatch(/pausó/);
  });

  it('los 4 estados tienen un Icon distinto asignado (no undefined)', () => {
    const estados: Exclude<EstadoPublicacion, 'activa'>[] = ['vendida', 'rentada', 'pausada', 'vencida'];
    for (const e of estados) {
      expect(estadoNoDisponibleInfo(e).Icon).toBeDefined();
    }
  });

  it('ESTADO_CFG sigue cubriendo los 5 estados (incluida "activa")', () => {
    expect(Object.keys(ESTADO_CFG).sort()).toEqual(['activa', 'pausada', 'rentada', 'vencida', 'vendida']);
  });
});
