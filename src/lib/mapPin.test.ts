import { describe, it, expect } from 'vitest';
import { dentroDeRadioPermitido, coordsAutoDesdeColonia, RADIO_MAXIMO_PIN_KM } from './mapPin';

// Villahermosa, Centro — punto de referencia real usado en varios tests
// de este repo (colonias.test.ts, landmarks.test.ts).
const ORIGINAL = { lat: 17.9869, lng: -92.9303 };

describe('dentroDeRadioPermitido', () => {
  it('sin original (propiedad nueva) siempre es válido', () => {
    expect(dentroDeRadioPermitido(null, { lat: 18.5, lng: -93.5 })).toBe(true);
  });

  it('el mismo punto exacto siempre es válido', () => {
    expect(dentroDeRadioPermitido(ORIGINAL, ORIGINAL)).toBe(true);
  });

  it('un desplazamiento pequeño (~200m) dentro del radio de 1km es válido', () => {
    const cerca = { lat: ORIGINAL.lat + 0.0018, lng: ORIGINAL.lng };
    expect(dentroDeRadioPermitido(ORIGINAL, cerca)).toBe(true);
  });

  it('un desplazamiento grande (~5km) fuera del radio de 1km se rechaza', () => {
    const lejos = { lat: ORIGINAL.lat + 0.045, lng: ORIGINAL.lng };
    expect(dentroDeRadioPermitido(ORIGINAL, lejos)).toBe(false);
  });

  it('respeta un radioKm distinto al default cuando se pasa explícito', () => {
    const a3km = { lat: ORIGINAL.lat + 0.027, lng: ORIGINAL.lng };
    expect(dentroDeRadioPermitido(ORIGINAL, a3km, RADIO_MAXIMO_PIN_KM)).toBe(false);
    expect(dentroDeRadioPermitido(ORIGINAL, a3km, 5)).toBe(true);
  });
});

describe('coordsAutoDesdeColonia', () => {
  const COLONIA = { lat: 17.99, lng: -92.93 };

  it('sin colonia verificada, no hace nada', () => {
    expect(coordsAutoDesdeColonia({ coordsActual: null, pinEsAutoColonia: false, coloniaVerificada: undefined })).toBeNull();
  });

  it('sin ningún pin todavía, coloca el pin en el centroide de la colonia', () => {
    const resultado = coordsAutoDesdeColonia({ coordsActual: null, pinEsAutoColonia: false, coloniaVerificada: COLONIA });
    expect(resultado).toEqual({ lat: COLONIA.lat, lng: COLONIA.lng });
  });

  it('nunca pisa un pin puesto a mano (o por GPS de foto)', () => {
    const manual = { lat: 18.1, lng: -93.1 };
    const resultado = coordsAutoDesdeColonia({ coordsActual: manual, pinEsAutoColonia: false, coloniaVerificada: COLONIA });
    expect(resultado).toBeNull();
  });

  it('si el pin actual YA era una sugerencia por colonia, sí lo re-coloca al cambiar de colonia', () => {
    const otraColonia = { lat: 18.2, lng: -93.2 };
    const resultado = coordsAutoDesdeColonia({ coordsActual: COLONIA, pinEsAutoColonia: true, coloniaVerificada: otraColonia });
    expect(resultado).toEqual({ lat: otraColonia.lat, lng: otraColonia.lng });
  });

  it('no dispara un cambio si la sugerencia por colonia ya es exactamente el pin actual', () => {
    const resultado = coordsAutoDesdeColonia({ coordsActual: COLONIA, pinEsAutoColonia: true, coloniaVerificada: COLONIA });
    expect(resultado).toBeNull();
  });

  it('nunca coloca un pin fuera de Tabasco, aunque el catálogo diera coordenadas malas', () => {
    const fueraDeTabasco = { lat: 19.4326, lng: -99.1332 }; // Ciudad de México
    const resultado = coordsAutoDesdeColonia({ coordsActual: null, pinEsAutoColonia: false, coloniaVerificada: fueraDeTabasco });
    expect(resultado).toBeNull();
  });
});
