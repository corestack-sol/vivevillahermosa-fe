import { describe, it, expect } from 'vitest';
import { COLONIAS_COORDS, normalizarNombreColonia } from './colonias';
import { distanciaKm } from './landmarks';
import { estaEnTabasco } from './tabascoBoundary';
import { MUNICIPIO_CENTERS } from './publishSchema';

/**
 * Auditoría del catálogo curado a mano de colonias (src/lib/colonias.ts) — no hay
 * backend ni base de datos verificando su consistencia, así que esto es lo único
 * que la detecta antes de producción. Ver .claude/skills/auditor-catalogos-geograficos.
 * Alcance de esta primera pasada: solo `COLONIAS_COORDS` (lo único que se tocó
 * 2026-09-29 al agregar 'zona-deportiva') — landmarks.ts y zonasDestacadas.ts quedan
 * para cuando se edite alguno de esos dos.
 */
describe('COLONIAS_COORDS — consistencia del catálogo', () => {
  it('sin keys repetidas', () => {
    const keys = COLONIAS_COORDS.map((c) => c.key);
    const repetidas = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(repetidas, `keys repetidas: ${JSON.stringify([...new Set(repetidas)])}`).toEqual([]);
  });

  it('sin coordenadas inválidas (0,0, NaN, o fuera de Tabasco)', () => {
    const invalidas = COLONIAS_COORDS.filter(
      (c) => Number.isNaN(c.lat) || Number.isNaN(c.lng) || (c.lat === 0 && c.lng === 0) || !estaEnTabasco(c.lat, c.lng),
    );
    expect(invalidas.map((c) => c.key), `entradas con coordenada inválida: ${JSON.stringify(invalidas.map((c) => c.key))}`).toEqual([]);
  });

  it('sin municipio huérfano (debe estar en MUNICIPIO_CENTERS)', () => {
    const municipiosValidos = new Set(Object.keys(MUNICIPIO_CENTERS));
    const huerfanas = COLONIAS_COORDS.filter((c) => !municipiosValidos.has(c.municipio));
    expect(huerfanas.map((c) => `${c.key}:${c.municipio}`), `municipio no reconocido: ${JSON.stringify(huerfanas.map((c) => c.municipio))}`).toEqual([]);
  });

  it('radioKm en rango razonable (>0, <=5km)', () => {
    const fueraDeRango = COLONIAS_COORDS.filter((c) => !(c.radioKm > 0 && c.radioKm <= 5));
    expect(fueraDeRango.map((c) => `${c.key}:${c.radioKm}`)).toEqual([]);
  });

  // "Literal repetida" = mismo NOMBRE (normalizado) Y mismo municipio a coordenada
  // casi idéntica bajo dos keys distintas (definición real de la skill, no solo
  // "están cerca" — Tabasco tiene colonias distintas de verdad a 100-150m entre sí,
  // eso no es un bug). Solo el nombre repetido con coordenada calcada sí lo es.
  it('sin entradas literalmente repetidas (mismo nombre normalizado + mismo municipio, a <150m)', () => {
    const UMBRAL_DUPLICADO_KM = 0.15;
    const duplicados: string[] = [];
    for (let i = 0; i < COLONIAS_COORDS.length; i++) {
      for (let j = i + 1; j < COLONIAS_COORDS.length; j++) {
        const a = COLONIAS_COORDS[i], b = COLONIAS_COORDS[j];
        if (a.municipio !== b.municipio) continue;
        if (normalizarNombreColonia(a.label) !== normalizarNombreColonia(b.label)) continue;
        if (distanciaKm(a.lat, a.lng, b.lat, b.lng) < UMBRAL_DUPLICADO_KM) {
          duplicados.push(`${a.key} <-> ${b.key} (${distanciaKm(a.lat, a.lng, b.lat, b.lng).toFixed(3)}km)`);
        }
      }
    }
    expect(duplicados, `posibles duplicados (mismo nombre+municipio, <150m): ${JSON.stringify(duplicados)}`).toEqual([]);
  });

  // Hallazgo real 2026-09-29 (no es un duplicado, no se toca acá): coronel-traconis-
  // 2a/3a/4a/5a (4 lugares reales distintos: El Zapote, Guerrero, San Francisco, San
  // Rafael y San Diego) comparten el único punto real que se tiene para esa zona —
  // el import original de INEGI no traía uno por sección. guadalupe-borja tenía el
  // mismo problema (compartía coordenada con 'guadalupe') y ya se corrigió con un
  // punto propio dado por el usuario. Este test deja la cuenta conocida a la vista
  // para que un cambio inesperado (una nueva colonia agregada sin geocodificar) se note.
  it('coordenadas compartidas entre colonias de nombre distinto — cuenta conocida, no un duplicado', () => {
    const grupos = new Map<string, string[]>();
    for (const c of COLONIAS_COORDS) {
      const clave = `${c.municipio}|${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), c.key]);
    }
    const compartidas = [...grupos.values()].filter((keys) => keys.length > 1);
    expect(compartidas, `grupos de colonias con coordenada idéntica: ${JSON.stringify(compartidas)}`).toEqual([
      ['coronel-traconis-2a', 'coronel-traconis-3a', 'coronel-traconis-4a', 'coronel-traconis-5a'],
    ]);
  });

  // Auditoría puntual 2026-09-29: 'zona-deportiva' se agregó cerca de 3 colonias ya
  // catalogadas (primero-de-mayo, guadalupe, deportiva-residencial) — confirma que es
  // un punto propio verificado por Nominatim (el nodo leisure=sports_centre "Ciudad
  // Deportiva"), no un duplicado accidental de ninguna de las tres.
  it('zona-deportiva es un punto propio, no un duplicado de sus vecinas catalogadas', () => {
    const zonaDeportiva = COLONIAS_COORDS.find((c) => c.key === 'zona-deportiva');
    expect(zonaDeportiva).toBeDefined();
    for (const vecinaKey of ['primero-de-mayo', 'guadalupe', 'deportiva-residencial']) {
      const vecina = COLONIAS_COORDS.find((c) => c.key === vecinaKey);
      expect(vecina, `no se encontró la colonia vecina '${vecinaKey}'`).toBeDefined();
      const d = distanciaKm(zonaDeportiva!.lat, zonaDeportiva!.lng, vecina!.lat, vecina!.lng);
      expect(d, `zona-deportiva está a ${d.toFixed(3)}km de ${vecinaKey} — demasiado cerca para ser un punto distinto`).toBeGreaterThan(0.15);
    }
  });
});
