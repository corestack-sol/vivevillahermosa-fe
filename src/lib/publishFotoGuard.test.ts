import { describe, it, expect } from 'vitest';
import { evaluarFotos, type ResultadoImagenIA } from './publishFotoGuard';

const APTA_RELACIONADA: ResultadoImagenIA = { apta: true, relacionada: true, señalesFraude: [], notas: '' };
const APTA_NO_RELACIONADA: ResultadoImagenIA = { apta: true, relacionada: false, señalesFraude: [], notas: 'no parece un inmueble' };
const APTA_CON_FRAUDE: ResultadoImagenIA = { apta: true, relacionada: true, señalesFraude: ['posible foto de stock'], notas: '' };
const NO_APTA: ResultadoImagenIA = { apta: false, relacionada: true, señalesFraude: [], notas: 'contenido inapropiado' };

describe('evaluarFotos', () => {
  it('sin fotos: bloquea por sinFotos, no por las otras banderas', () => {
    const r = evaluarFotos([]);
    expect(r.sinFotos).toBe(true);
    expect(r.fotoNoApta).toBe(false);
    expect(r.unicaFotoConAdvertencia).toBe(false);
    expect(r.bloqueaPublicar).toBe(false); // sinFotos se maneja aparte en el llamador
  });

  it('1 foto pendiente de analizar: no bloquea todavía (ni apta ni advertencia se puede afirmar aún)', () => {
    const r = evaluarFotos([{ analisis: 'pendiente' }]);
    expect(r.bloqueaPublicar).toBe(false);
    expect(r.porFoto[0]).toEqual({ pendiente: true, noApta: false, advertencia: false });
  });

  it('1 foto apta y relacionada: no bloquea (caso normal)', () => {
    const r = evaluarFotos([{ analisis: APTA_RELACIONADA }]);
    expect(r.bloqueaPublicar).toBe(false);
    expect(r.unicaFotoConAdvertencia).toBe(false);
  });

  // Caso real del reporte 2026-09-23 ("subo 1 foto y no puedo publicar"):
  // verificado en vivo que esto SÍ pasa con fotos reales (museo/cueva/playa/
  // negra), no es un caso de laboratorio.
  it('1 foto apta pero NO relacionada: bloquea (es la única, sin respaldo)', () => {
    const r = evaluarFotos([{ analisis: APTA_NO_RELACIONADA }]);
    expect(r.unicaFotoConAdvertencia).toBe(true);
    expect(r.fotoNoApta).toBe(false);
    expect(r.bloqueaPublicar).toBe(true);
  });

  it('1 foto apta y relacionada pero con señal de fraude: bloquea (es la única, sin respaldo)', () => {
    const r = evaluarFotos([{ analisis: APTA_CON_FRAUDE }]);
    expect(r.unicaFotoConAdvertencia).toBe(true);
    expect(r.bloqueaPublicar).toBe(true);
  });

  it('1 foto no apta: bloquea por fotoNoApta, no por unicaFotoConAdvertencia', () => {
    const r = evaluarFotos([{ analisis: NO_APTA }]);
    expect(r.fotoNoApta).toBe(true);
    expect(r.unicaFotoConAdvertencia).toBe(false); // NO_APTA no cuenta como "advertencia", es otra categoría
    expect(r.bloqueaPublicar).toBe(true);
  });

  it('2 fotos, ambas aptas y relacionadas: no bloquea', () => {
    const r = evaluarFotos([{ analisis: APTA_RELACIONADA }, { analisis: APTA_RELACIONADA }]);
    expect(r.bloqueaPublicar).toBe(false);
  });

  // Pedido explícito 2026-09-17 (comentario original en PublishForm.tsx):
  // con 2+ fotos, una sola con advertencia NO debe bloquear — hay otra foto
  // real de respaldo. Este es el caso que el reporte de 2026-09-23 esperaba
  // que arreglara su problema ("subo 2 fotos") y, según el código actual,
  // si el problema real fuera SOLO `relacionada: false` en una de las dos,
  // esto ya lo permite.
  it('2 fotos: una apta+relacionada y la otra apta pero no relacionada — NO bloquea', () => {
    const r = evaluarFotos([{ analisis: APTA_RELACIONADA }, { analisis: APTA_NO_RELACIONADA }]);
    expect(r.fotoNoApta).toBe(false);
    expect(r.unicaFotoConAdvertencia).toBe(false); // ya no hay 1 sola foto
    expect(r.bloqueaPublicar).toBe(false);
  });

  // Caso real del reporte 2026-09-23 ("subo 2, una carga bien, y aun así no
  // puedo publicar"): esto SOLO reproduce ese reporte si la segunda foto
  // vino NO APTA (no simplemente "no relacionada") — verificado que
  // `fotoNoApta` bloquea sin importar cuántas fotos buenas haya al lado.
  it('2 fotos: una apta+relacionada y la otra NO apta — SÍ bloquea, sin importar la buena', () => {
    const r = evaluarFotos([{ analisis: APTA_RELACIONADA }, { analisis: NO_APTA }]);
    expect(r.fotoNoApta).toBe(true);
    expect(r.bloqueaPublicar).toBe(true);
  });

  it('2 fotos, ambas no relacionadas: no bloquea (unicaFotoConAdvertencia exige length === 1)', () => {
    const r = evaluarFotos([{ analisis: APTA_NO_RELACIONADA }, { analisis: APTA_NO_RELACIONADA }]);
    expect(r.unicaFotoConAdvertencia).toBe(false);
    expect(r.bloqueaPublicar).toBe(false);
  });

  it('2 fotos, una pendiente y la otra no apta: bloquea igual (la pendiente no lo evita)', () => {
    const r = evaluarFotos([{ analisis: 'pendiente' }, { analisis: NO_APTA }]);
    expect(r.fotoNoApta).toBe(true);
    expect(r.bloqueaPublicar).toBe(true);
  });

  it('orden de porFoto coincide con el orden de entrada (para pintar las miniaturas)', () => {
    const r = evaluarFotos([{ analisis: NO_APTA }, { analisis: APTA_RELACIONADA }, { analisis: 'pendiente' }]);
    expect(r.porFoto.map((e) => e.noApta)).toEqual([true, false, false]);
    expect(r.porFoto.map((e) => e.pendiente)).toEqual([false, false, true]);
  });
});
