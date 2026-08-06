export interface PuntoSerie {
  fecha: string;
  vistas: number;
  contactos: number;
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

// PRNG determinístico (mulberry32) — la serie de una propiedad debe verse
// igual cada vez que se visita la página, no aleatoria de verdad en cada
// render. La semilla es el id de la propiedad, así que dos propiedades
// distintas siempre tienen curvas distintas pero estables.
function mulberry32(seed: number) {
  let s = seed;
  return function random() {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ⚠️ DATOS DE MUESTRA — no hay tabla de eventos real (vista/contacto/
 * favorito con fecha) todavía, ver docs/BACKEND.md §12 y §15. Genera
 * `dias` puntos terminando hoy, determinísticos por `propertyId` para que
 * no "parpadeen" entre renders.
 */
export function getSerieDemo(propertyId: string, dias = 60): PuntoSerie[] {
  const rand = mulberry32(hashSeed(propertyId));
  const hoy = new Date();
  const serie: PuntoSerie[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    const base = 1.5 + rand() * 5;
    const pico = rand() > 0.88 ? rand() * 9 : 0;
    const vistas = Math.max(0, Math.round(base + pico));
    const contactos = rand() > 0.75 ? Math.round(rand() * 2) : 0;
    serie.push({ fecha: fecha.toISOString().slice(0, 10), vistas, contactos });
  }
  return serie;
}

export function sumar(serie: PuntoSerie[], campo: 'vistas' | 'contactos'): number {
  return serie.reduce((acc, p) => acc + p[campo], 0);
}

/** % de cambio del último tercio de `serie` contra el tercio anterior (redondeado). null si no hay base para comparar. */
export function cambioPorcentual(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual > 0 ? 100 : null;
  return Math.round(((actual - anterior) / anterior) * 100);
}
