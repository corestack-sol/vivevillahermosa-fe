import { describe, it, expect } from 'vitest';
import {
  clasificarGPSFoto, esPublicacionBloqueada, debeReevaluarFraude, contarContactoReutilizado,
} from './publishFraudGuard';

describe('clasificarGPSFoto', () => {
  // Tabasco 2000 real, catalogada en colonias.ts.
  const tabasco2000 = { lat: 17.9994, lng: -92.9316 };
  // Centro (Villahermosa), MUNICIPIO_CENTERS real.
  const centroMunicipio = [17.9869, -92.9303] as const;

  it('con colonia verificada y GPS cerca (≤3km): sugiere el pin, sin coloniaSugerida', () => {
    const gps = { latitude: 17.9990, longitude: -92.9310 }; // a metros de tabasco2000
    const r = clasificarGPSFoto(gps, { coloniaVerificada: tabasco2000, municipio: 'Centro' });
    expect(r).toEqual({ tipo: 'sugerencia', coords: { lat: gps.latitude, lng: gps.longitude } });
  });

  it('con colonia verificada y GPS lejos (>3km): marca contradicción con la distancia real', () => {
    // ~40km al norte de Tabasco 2000 — claramente fuera del radio de 3km.
    const gps = { latitude: 18.35, longitude: -92.93 };
    const r = clasificarGPSFoto(gps, { coloniaVerificada: tabasco2000, municipio: 'Centro' });
    expect(r?.tipo).toBe('contradiccion');
    if (r?.tipo === 'contradiccion') {
      expect(r.distanciaKm).toBeGreaterThan(3);
      expect(r.distanciaKm).toBeGreaterThan(30); // confirma que es la distancia real, no un valor arbitrario
    }
  });

  it('sin colonia verificada, GPS cerca del centro del municipio (≤20km): sugiere el pin', () => {
    const gps = { latitude: 17.99, longitude: -92.93 }; // a ~1km del centro
    const r = clasificarGPSFoto(gps, { coloniaVerificada: null, municipio: 'Centro', municipioCenter: centroMunicipio });
    expect(r?.tipo).toBe('sugerencia');
  });

  it('sin colonia verificada, GPS lejos del centro del municipio (>20km): marca contradicción', () => {
    const gps = { latitude: 18.35, longitude: -92.93 }; // ~40km del centro
    const r = clasificarGPSFoto(gps, { coloniaVerificada: null, municipio: 'Centro', municipioCenter: centroMunicipio });
    expect(r?.tipo).toBe('contradiccion');
  });

  it('sin colonia verificada, GPS cerca de una colonia catalogada distinta: sugiere Y ofrece coloniaSugerida', () => {
    // El GPS cae dentro de Tabasco 2000 (catalogada), aunque la persona no
    // haya escrito una colonia que resolviera contra el catálogo.
    const gps = { latitude: 17.9990, longitude: -92.9310 };
    const r = clasificarGPSFoto(gps, { coloniaVerificada: null, municipio: 'Centro', municipioCenter: centroMunicipio });
    expect(r?.tipo).toBe('sugerencia');
    if (r?.tipo === 'sugerencia') {
      expect(r.coloniaSugerida?.key).toBe('tabasco-2000');
    }
  });

  it('sin colonia verificada NI centro de municipio conocido: no sugiere ni marca contradicción (null)', () => {
    const gps = { latitude: 17.99, longitude: -92.93 };
    const r = clasificarGPSFoto(gps, { coloniaVerificada: null, municipio: undefined, municipioCenter: undefined });
    expect(r).toBeNull();
  });
});

describe('esPublicacionBloqueada', () => {
  it('null: no bloquea', () => {
    expect(esPublicacionBloqueada(null)).toBe(false);
  });

  it('sin riesgo ni bloqueado: no bloquea', () => {
    expect(esPublicacionBloqueada({})).toBe(false);
  });

  it('bloqueado=true: bloquea sin importar el riesgo', () => {
    expect(esPublicacionBloqueada({ bloqueado: true, riesgo: 'bajo' })).toBe(true);
  });

  it('riesgo alto: bloquea (nivel 3 del sistema)', () => {
    expect(esPublicacionBloqueada({ riesgo: 'alto' })).toBe(true);
  });

  it('riesgo medio: NO bloquea (nivel 2, solo se marca)', () => {
    expect(esPublicacionBloqueada({ riesgo: 'medio' })).toBe(false);
  });

  it('riesgo bajo: no bloquea (nivel 1)', () => {
    expect(esPublicacionBloqueada({ riesgo: 'bajo' })).toBe(false);
  });

  it('bloqueado=false explícito con riesgo alto: igual bloquea por el riesgo', () => {
    expect(esPublicacionBloqueada({ bloqueado: false, riesgo: 'alto' })).toBe(true);
  });
});

describe('debeReevaluarFraude', () => {
  it('undefined (primera suscripción de watch()): sí reevalúa', () => {
    expect(debeReevaluarFraude(undefined)).toBe(true);
  });

  it('titulo: sí reevalúa', () => {
    expect(debeReevaluarFraude('titulo')).toBe(true);
  });

  it('descripcion: sí reevalúa', () => {
    expect(debeReevaluarFraude('descripcion')).toBe(true);
  });

  it('telefonoContacto: NO reevalúa — este es el bug real que se corrigió', () => {
    expect(debeReevaluarFraude('telefonoContacto')).toBe(false);
  });

  it('nombreContacto: no reevalúa', () => {
    expect(debeReevaluarFraude('nombreContacto')).toBe(false);
  });

  it('emailContacto: no reevalúa', () => {
    expect(debeReevaluarFraude('emailContacto')).toBe(false);
  });

  it('metodoContacto: no reevalúa', () => {
    expect(debeReevaluarFraude('metodoContacto')).toBe(false);
  });

  it('municipio/colonia (otros pasos): no reevalúan', () => {
    expect(debeReevaluarFraude('municipio')).toBe(false);
    expect(debeReevaluarFraude('colonia')).toBe(false);
  });
});

describe('contarContactoReutilizado', () => {
  const mk = (tel?: string, whatsapp?: string) => ({ agente: { tel, whatsapp } });

  it('catálogo vacío: 0', () => {
    expect(contarContactoReutilizado([], '9931234567')).toBe(0);
  });

  it('tel de búsqueda vacío: 0 sin importar el catálogo', () => {
    expect(contarContactoReutilizado([mk('9931234567')], '')).toBe(0);
  });

  it('tel de búsqueda solo espacios: 0', () => {
    expect(contarContactoReutilizado([mk('9931234567')], '   ')).toBe(0);
  });

  it('cuenta coincidencias por tel', () => {
    const props = [mk('9931234567'), mk('9931234567'), mk('9939999999')];
    expect(contarContactoReutilizado(props, '9931234567')).toBe(2);
  });

  it('cuenta coincidencias por whatsapp (aunque tel esté vacío, ej. "Solo WhatsApp")', () => {
    const props = [mk(undefined, '9931234567')];
    expect(contarContactoReutilizado(props, '9931234567')).toBe(1);
  });

  it('cuenta una sola vez por propiedad aunque tel Y whatsapp coincidan (mismo número en ambos)', () => {
    const props = [mk('9931234567', '9931234567')];
    expect(contarContactoReutilizado(props, '9931234567')).toBe(1);
  });

  it('suma coincidencias mixtas de tel y whatsapp entre varias propiedades', () => {
    const props = [mk('9931234567'), mk(undefined, '9931234567'), mk('9930000000')];
    expect(contarContactoReutilizado(props, '9931234567')).toBe(2);
  });

  it('sin coincidencias: 0', () => {
    const props = [mk('9930000000'), mk(undefined, '9938888888')];
    expect(contarContactoReutilizado(props, '9931234567')).toBe(0);
  });

  it('recorta espacios del número buscado antes de comparar', () => {
    const props = [mk('9931234567')];
    expect(contarContactoReutilizado(props, '  9931234567  ')).toBe(1);
  });
});
