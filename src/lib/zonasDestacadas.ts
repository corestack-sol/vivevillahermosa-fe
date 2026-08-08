import { getLandmark, distanciaKm, type Landmark } from './landmarks';
import { getColoniaByKey, type ColoniaCoord } from './colonias';

interface FuenteZona {
  tipo: 'landmark' | 'colonia';
  key: string;
}

/**
 * Vocación principal de la zona — no es solo "cara vs. barata", son
 * necesidades de búsqueda distintas (ver segunda tabla del usuario,
 * 2026-08-08, "Clasificación de Zonas... con vocación, seguridad y perfil
 * inmobiliario"):
 *  - 'plusvalia-alta': exclusiva/segura/prestigio, la que ya cubría la
 *    primera tabla — esta es la única categoría que cuenta para
 *    `ZONA_DESTACADA_CUALQUIERA` (ver más abajo).
 *  - 'comercial-conectividad': nodo comercial/logístico, no necesariamente
 *    residencial de lujo (ej. Cárdenas, "Puerta del Sureste").
 *  - 'residencial-satelite': ciudad dormitorio, vivienda económica/media,
 *    conectada a Villahermosa pero fuera de ella.
 *  - 'industrial-popular': cerca de zona industrial, vivienda a precio
 *    competitivo para trabajadores del sector.
 */
type CategoriaZona = 'plusvalia-alta' | 'comercial-conectividad' | 'residencial-satelite' | 'industrial-popular';

export interface ZonaDestacada {
  key: string;
  label: string;
  categoria: CategoriaZona;
  descripcion: string;
  /** Uno o más puntos ya verificados (landmarks.ts/colonias.ts) — nunca una
   *  coordenada nueva. Una zona con varias fuentes (ej. un corredor) cuenta
   *  como "cerca" si la propiedad está cerca de CUALQUIERA de ellas. */
  fuentes: FuenteZona[];
}

/**
 * Zonas de Tabasco con un perfil de mercado reconocido — curadas a mano
 * (2026-08-08, ampliadas 2026-08-08) a partir de dos tablas que trajo el
 * usuario con fuentes citadas, cruzadas punto por punto contra Nominatim
 * antes de aceptar cualquier lugar nuevo — mismo criterio que el resto de
 * este proyecto, nunca se acepta un dato sin verificar aunque venga con
 * fuente.
 *
 * Por qué existe esto y no solo un campo libre en el prompt: pedirle a la
 * IA que decida por su cuenta "cuál colonia es de alta plusvalía/cuál es
 * zona dormitorio" sería exactamente el tipo de invención que REGLA 1
 * prohíbe en todos lados de este archivo — una opinión de mercado, no un
 * hecho verificable. Esta lista SÍ es segura de ofrecer como opción cerrada
 * porque cada entrada ya es un lugar real y catalogado (landmark o colonia
 * verificados), la IA solo elige de una lista fija, igual que ya hace con
 * "landmark".
 *
 * "Paraíso (Zona Refinería/industrial)" NO se agregó aquí a propósito — ya
 * existe `cercaDosoBocas` para exactamente ese concepto (ver REGLA en
 * ai.ts), agregarlo aquí también hubiera sido una segunda forma de pedir lo
 * mismo. "El Country"/"Jardines del Country" tampoco se agregó — se
 * intentó con 6+ variantes en dos rondas distintas, ningún término dio
 * resultado confiable en Nominatim.
 */
export const ZONAS_DESTACADAS: ZonaDestacada[] = [
  {
    key: 'tabasco-2000',
    label: 'Tabasco 2000',
    categoria: 'plusvalia-alta',
    descripcion: 'Corazón financiero y administrativo de Villahermosa: oficinas de gobierno, bancos, hospitales privados y plazas como Galerías Tabasco.',
    fuentes: [{ tipo: 'colonia', key: 'tabasco-2000' }],
  },
  {
    key: 'altabrisa',
    label: 'Zona Sur (Altabrisa)',
    categoria: 'plusvalia-alta',
    descripcion: 'Plusvalía constante por Plaza Altabrisa, el centro comercial más grande de la región, y vivienda residencial de nivel alto.',
    fuentes: [{ tipo: 'landmark', key: 'altabrisa' }],
  },
  {
    key: 'club-campestre',
    label: 'Club Campestre / El Country',
    categoria: 'plusvalia-alta',
    descripcion: 'Zona exclusiva y segura, con vigilancia y clubes deportivos — preferida por familias de nivel medio-alto y cercana a colegios de prestigio.',
    fuentes: [{ tipo: 'colonia', key: 'club-campestre' }],
  },
  {
    key: 'dos-montes',
    label: 'Corredor Dos Montes',
    categoria: 'plusvalia-alta',
    descripcion: 'Zona de expansión con plusvalía creciente, impulsada por el nuevo Hospital General del ISSSTE y la cercanía al Aeropuerto Internacional — crecimiento con menor riesgo de inundación que el centro histórico.',
    fuentes: [{ tipo: 'landmark', key: 'hospital-issste' }],
  },
  {
    key: 'paseo-tabasco',
    label: 'Paseo Tabasco',
    categoria: 'plusvalia-alta',
    descripcion: 'Eje vial que concentra desarrollo habitacional vertical y edificios corporativos de alto prestigio.',
    fuentes: [{ tipo: 'landmark', key: 'musevi' }, { tipo: 'landmark', key: 'hospital-angeles' }],
  },
  {
    key: 'lindavista',
    label: 'Lindavista',
    categoria: 'plusvalia-alta',
    descripcion: 'Colonia consolidada cerca de Paseo Tabasco, con buena mezcla de vida residencial y cercanía a centros educativos y médicos.',
    fuentes: [{ tipo: 'colonia', key: 'lindavista' }],
  },
  {
    key: 'heroica-cardenas',
    label: 'Heroica Cárdenas',
    categoria: 'comercial-conectividad',
    descripcion: 'Nodo logístico y comercial de la Chontalpa, conocida como la "Puerta del Sureste" — demanda de alquiler ligada a la Universidad Popular de la Chontalpa.',
    fuentes: [{ tipo: 'landmark', key: 'cardenas-centro' }],
  },
  {
    key: 'pomoca',
    label: 'Pomoca (Nacajuca)',
    categoria: 'residencial-satelite',
    descripcion: 'Ciudad dormitorio conectada a Villahermosa, con la mayor absorción de vivienda de interés social de la zona conurbada — vivienda económica y media-baja.',
    fuentes: [{ tipo: 'colonia', key: 'pomoca' }, { tipo: 'colonia', key: 'saloya-segunda-seccion' }],
  },
  {
    key: 'indeco',
    label: 'Indeco',
    categoria: 'industrial-popular',
    descripcion: 'Zona en auge cerca de la Ciudad Industrial y el periférico — vivienda a precios competitivos, mercado atractivo para trabajadores del sector industrial.',
    fuentes: [{ tipo: 'colonia', key: 'indeco' }],
  },
];

/**
 * Valor especial (no es el key de ninguna zona real) para cuando la
 * búsqueda pide una zona de alta plusvalía/exclusividad de forma genérica
 * ("zonas de plusvalía de Tabasco", "las mejores zonas") sin nombrar una en
 * concreto — caso real reportado: esa frase exacta devolvía {} y la
 * búsqueda completa caía al match de texto literal de siempre, que nunca
 * encuentra nada para una oración así. Solo abarca las zonas categoría
 * 'plusvalia-alta' a propósito: alguien que pide "la zona más exclusiva"
 * no espera que le aparezca Indeco o Pomoca en la misma bolsa — son
 * vocaciones de búsqueda distintas (económica/dormitorio vs. exclusiva),
 * no la misma pregunta con otra redacción.
 */
export const ZONA_DESTACADA_CUALQUIERA = 'cualquiera';

export const ZONAS_DESTACADAS_VALIDAS = [...ZONAS_DESTACADAS.map((z) => z.key), ZONA_DESTACADA_CUALQUIERA];

export function getZonaDestacada(key: string): ZonaDestacada | undefined {
  return ZONAS_DESTACADAS.find((z) => z.key === key);
}

/** Resuelve cada fuente a su punto real ya verificado — nunca inventa uno. */
function puntosDeZona(zona: ZonaDestacada): (Landmark | ColoniaCoord)[] {
  return zona.fuentes
    .map((f) => (f.tipo === 'landmark' ? getLandmark(f.key) : getColoniaByKey(f.key)))
    .filter((p): p is Landmark | ColoniaCoord => !!p);
}

/**
 * Municipios reales de la zona, según sus fuentes tipo 'colonia' (las que sí
 * tienen ese dato — `Landmark` no lo trae). Vacío si la zona solo tiene
 * fuentes tipo 'landmark' (ahí no hay forma de comparar municipio sin
 * agregarle ese campo a `Landmark`, que hoy no lo necesita para nada más).
 * Exportado para que ai.ts compare identidad de municipio en vez de
 * distancia — dos municipios conurbados (ej. Centro y Nacajuca) pueden
 * quedar a pocos km entre sí, así que un umbral de distancia no distingue
 * bien "mismo municipio" de "municipio vecino".
 */
export function municipiosDeZona(zonaKey: string): string[] {
  const zona = getZonaDestacada(zonaKey);
  if (!zona) return [];
  const municipios = zona.fuentes
    .filter((f) => f.tipo === 'colonia')
    .map((f) => getColoniaByKey(f.key)?.municipio)
    .filter((m): m is string => !!m);
  return [...new Set(municipios)];
}

/**
 * true si (lat, lng) cae dentro del radio de CUALQUIERA de los puntos que
 * componen la zona — o, con `ZONA_DESTACADA_CUALQUIERA`, dentro del radio
 * de CUALQUIERA de los puntos de CUALQUIERA de las zonas 'plusvalia-alta'.
 */
export function estaEnZonaDestacada(zonaKey: string, lat: number, lng: number): boolean {
  if (zonaKey === ZONA_DESTACADA_CUALQUIERA) {
    return ZONAS_DESTACADAS
      .filter((z) => z.categoria === 'plusvalia-alta')
      .some((z) => puntosDeZona(z).some((p) => distanciaKm(lat, lng, p.lat, p.lng) <= p.radioKm));
  }
  const zona = getZonaDestacada(zonaKey);
  if (!zona) return false;
  return puntosDeZona(zona).some((p) => distanciaKm(lat, lng, p.lat, p.lng) <= p.radioKm);
}

/**
 * Punto de la zona más cercano a (lat, lng) y la distancia real hasta él —
 * null si el key no es válido o es "cualquiera" (no tiene un solo punto de
 * referencia). Exportado para que ai.ts pueda detectar cuándo
 * "zonaDestacada" y otro campo (landmark, municipio) apuntan a lugares
 * demasiado lejos como para ser la misma búsqueda real — mismo criterio que
 * ya usa `resolverConflictoLandmarkColonia`, comparando contra el radio real
 * del punto más cercano en vez de un umbral fijo.
 */
export function puntoMasCercanoDeZona(zonaKey: string, lat: number, lng: number): { distanciaKm: number; radioKm: number } | null {
  const zona = getZonaDestacada(zonaKey);
  if (!zona) return null;
  let mejor: { distanciaKm: number; radioKm: number } | null = null;
  for (const p of puntosDeZona(zona)) {
    const d = distanciaKm(lat, lng, p.lat, p.lng);
    if (!mejor || d < mejor.distanciaKm) mejor = { distanciaKm: d, radioKm: p.radioKm };
  }
  return mejor;
}
