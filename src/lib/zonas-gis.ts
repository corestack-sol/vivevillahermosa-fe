import type { RiesgoInundacion } from './zonas-inundacion';

export interface ResultadoGIS {
  riesgo: RiesgoInundacion;
  zona: string;
}

// Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONAS GIS — círculos de riesgo con centro y radio
//
// Fuente: Atlas de Riesgos del Municipio de Centro, 2023. Ayuntamiento de Centro. P 377
// Centros estimados sobre INEGI AGEB + OpenStreetMap + texto del Atlas (caps. 8–9).
//
// PRINCIPIO: radios muy conservadores. Preferible devolver null (sin datos GIS)
// y caer al detector de texto, que dar un falso positivo. NO hay círculo
// general de "toda la ciudad" porque produce clasificaciones incorrectas.
//
// Sin shapefiles oficiales de IMPLAN, cada kilómetro extra de radio
// introduce riesgo de falso positivo — como se observó con El Cedro / Las Gaviotas.
// ─────────────────────────────────────────────────────────────────────────────

const ZONAS: Array<{ nombre: string; lat: number; lng: number; radioKm: number; riesgo: RiesgoInundacion }> = [

  // ── BAJO — zonas documentadas como seguras ───────────────────────────────

  // Loma de Caballo / Altamira (Dist. XII)
  // Atlas 2023: "inundaciones prácticamente nulas" post-El Macayo.
  { nombre: 'Loma de Caballo / Altamira',         lat: 17.9440, lng: -92.9310, radioKm: 1.4, riesgo: 'bajo' },

  // Tabasco 2000 (Dist. V) — bien drenado, diseño reciente.
  { nombre: 'Tabasco 2000',                        lat: 17.9930, lng: -92.9640, radioKm: 1.0, riesgo: 'bajo' },

  // Ciudad Deportiva / Primero de Mayo (Dist. III)
  // Atlas 2023: "una de las zonas más altas de la ciudad".
  { nombre: 'Ciudad Deportiva / Primero de Mayo',  lat: 17.9870, lng: -92.9360, radioKm: 0.7, riesgo: 'bajo' },

  // Prados / Kehoe / Nueva Villahermosa (norponiente)
  // Atlas 2013: 99 % Peligro Muy Bajo.
  { nombre: 'Prados / Kehoe / Nueva Villahermosa', lat: 18.0050, lng: -92.9480, radioKm: 0.7, riesgo: 'bajo' },


  // ── ALTO — zonas de riesgo confirmado ────────────────────────────────────

  // Las Gaviotas / El Monal (Dist. X, norte del Periférico)
  // Bordos con historial de falla: 1999, 2007, 2020.
  { nombre: 'Las Gaviotas / El Monal',             lat: 18.0380, lng: -92.9400, radioKm: 1.0, riesgo: 'alto' },

  // Valle Marino (Dist. VI, noroeste del Periférico)
  // >1 m de agua en 2007; sobre zona de retención natural del río Negro.
  { nombre: 'Valle Marino',                        lat: 18.0200, lng: -92.9700, radioKm: 0.7, riesgo: 'alto' },

  // Centro Histórico / La Venta (Dist. I–II)
  // Muro del Malecón protege; falla = catástrofe (2020: tirante récord).
  { nombre: 'Centro Histórico / La Venta',         lat: 17.9880, lng: -92.9260, radioKm: 0.8, riesgo: 'alto' },

  // Casa Blanca / Laguna El Negro (Dist. VII)
  // Anegamiento severo; laguna puede desbordar sin bombeo.
  { nombre: 'Casa Blanca / Laguna El Negro',       lat: 17.9910, lng: -92.9870, radioKm: 0.9, riesgo: 'alto' },

  // Ixtacomitán / Torno Largo (sureste, río de la Sierra sin control suficiente)
  { nombre: 'Ixtacomitán / Torno Largo',           lat: 17.9580, lng: -92.8880, radioKm: 1.0, riesgo: 'alto' },

  // La Manga / Río Viejo (Carretera del Golfo, bordos del río Viejo Mezcalapa)
  { nombre: 'La Manga / Río Viejo',                lat: 17.9650, lng: -92.8660, radioKm: 1.0, riesgo: 'alto' },


  // ── MEDIO — zonas específicas con anegamiento documentado ────────────────

  // Atasta / Tamulté (Dist. IV — vaso regulador afectado con frecuencia)
  { nombre: 'Atasta / Tamulté',                    lat: 17.9830, lng: -92.9020, radioKm: 1.2, riesgo: 'medio' },

  // Reserva Sur (Dist. XI — cuenca río Viejo Mezcalapa, impacto alto en zona norte)
  { nombre: 'Reserva Sur',                         lat: 17.9600, lng: -92.9530, radioKm: 1.5, riesgo: 'medio' },
];

export function detectarRiesgoGIS(lat: number, lng: number): ResultadoGIS | null {
  for (const z of ZONAS) {
    if (haversineKm(lat, lng, z.lat, z.lng) <= z.radioKm) {
      return { riesgo: z.riesgo, zona: z.nombre };
    }
  }
  return null; // fuera del área metropolitana de Villahermosa
}
