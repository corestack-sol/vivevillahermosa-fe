export type LandmarkCategoria = 'salud' | 'educacion' | 'comercial' | 'transporte' | 'cultura' | 'centro';

export interface Landmark {
  key: string;
  label: string;
  categoria: LandmarkCategoria;
  lat: number;
  lng: number;
  /** Qué tan lejos todavía cuenta como "cerca de" este lugar. */
  radioKm: number;
  /**
   * Formas cortas/coloquiales por las que la gente también nombra el lugar
   * (ej. "Hospital Ángeles" en vez de "Hospital Ángeles Villahermosa") — se
   * revisan además del label completo al hacer coincidencia de texto. Sin
   * esto, alguien que omite la palabra final del nombre oficial (algo muy
   * común) no obtenía ningún match, ni por heurística ni como red de
   * seguridad de la IA.
   */
  aliases?: string[];
}

/**
 * Fecha en que se investigó y verificó (por fuente pública — sitio oficial,
 * directorio comercial vigente, mapa) que cada lugar de abajo sigue
 * operando. No hay verificación en vivo en cada búsqueda: sería una llamada
 * de IA extra por consulta (se acabaría la cuota gratis de 20/día de Gemini
 * en minutos) y varios segundos más de espera por resultado — un costo real
 * para un beneficio que en la práctica casi nunca cambia (un hospital o
 * universidad no cierra de un día para otro). Si algún lugar de esta lista
 * cierra o cambia de dirección, hay que volver a investigar y actualizar
 * aquí a mano.
 */
export const LANDMARKS_VERIFICADO_EN = '2026-08-04';

/**
 * Puntos de interés de Tabasco que la búsqueda con IA puede reconocer
 * ("cerca de la Laguna de las Ilusiones", "cerca de un hospital") — antes de
 * esto, un lugar que no fuera literalmente el nombre de una colonia
 * devolvía cero resultados, porque el texto de la búsqueda nunca coincide
 * con el título/colonia/descripción de ninguna propiedad.
 *
 * Cobertura de salud/educación/comercial: todos los hospitales (públicos y
 * privados) y universidades/institutos con presencia real y verificable en
 * Villahermosa al momento de la investigación (ver LANDMARKS_VERIFICADO_EN),
 * más los centros comerciales principales. No se incluyen consultorios de
 * un solo médico, clínicas de barrio sin presencia pública, ni escuelas de
 * educación básica (kínder/primaria/secundaria) individuales — son
 * literalmente cientos, cambian con frecuencia, y no hay una fuente única
 * confiable para verificar cada una; "cerca de una escuela" sigue
 * funcionando igual vía categoriaLandmark (más abajo), solo que sin apuntar
 * a un plantel específico por nombre.
 *
 * Cobertura geográfica: fuerte en Villahermosa (Centro), donde vive la
 * mayoría del inventario demo; para el resto de los 10 municipios que
 * reconoce la plataforma (ver MUNICIPIO_OPTIONS en publishSchema.ts) se
 * agregó al menos un punto de referencia del centro urbano, más 1-2 lugares
 * específicos donde había datos confiables (zona arqueológica de
 * Comalcalco, puerto Dos Bocas). Municipios fuera de esa lista (ej. Teapa)
 * no se cubrieron — la plataforma tampoco los ofrece como filtro de
 * municipio.
 *
 * ⚠️ Direcciones verificadas por fuente pública; coordenadas exactas SOLO
 * cuando la fuente las dio en decimal (Galerías Tabasco, Altabrisa,
 * Aeropuerto VSA, ITVH, Zona Arqueológica Comalcalco, Plaza Sendero, Plaza
 * Cristal, Plaza Mallorca, Catedral del Señor de Tabasco, Palacio de
 * Gobierno, Congreso del Estado, Museo Carlos Pellicer, Parque Juárez,
 * Estadio Centenario 27 de Febrero, Mercado Pino Suárez, Instituto Juárez,
 * Centro de Convenciones, Casa de los Azulejos, Museo Papagayo, Plaza Las
 * Américas — estas últimas 11 vía Nominatim/OpenStreetMap, auditoría
 * 2026-08-06) — el resto son una ubicación aproximada dentro de
 * la colonia/calle real, situada a mano por geografía conocida de la
 * ciudad, no un geocoder. Suficiente para un radio de "cerca de" de 1-5 km,
 * no para precisión de metros. Si algo se ve mal ubicado, ajustar aquí es el
 * único lugar que hace falta tocar.
 */
export const LANDMARKS: Landmark[] = [
  // Villahermosa (Centro) — naturaleza / cultura
  { key: 'laguna-ilusiones', label: 'Laguna de las Ilusiones', categoria: 'cultura', lat: 17.9928, lng: -92.9310, radioKm: 2, aliases: ['laguna'] },
  // "Parque Tabasco" (construido en 1930) es el nombre histórico del mismo
  // sitio físico que hoy se llama Parque Tomás Garrido Canabal, a la orilla
  // de la laguna — reconstruido por completo en 1983-1985 (confirmado por
  // fuente pública, no un supuesto). Es una entrada propia, NO un alias de
  // 'laguna-ilusiones': aunque comparten coordenadas, mostrarle a alguien
  // que buscó "parque Tabasco" una ficha que dice "Laguna de las Ilusiones"
  // se siente como un resultado ajeno, aunque geográficamente sea el mismo
  // punto — la etiqueta que se muestra debe coincidir con lo que la persona
  // buscó.
  { key: 'parque-tabasco', label: 'Parque Tabasco', categoria: 'cultura', lat: 17.9928, lng: -92.9310, radioKm: 2, aliases: ['parque tomás garrido', 'parque tomas garrido', 'parque tomás garrido canabal'] },
  { key: 'parque-la-venta', label: 'Parque Museo La Venta', categoria: 'cultura', lat: 17.9887, lng: -92.9295, radioKm: 1.5, aliases: ['parque la venta', 'museo la venta'] },
  { key: 'malecon', label: 'Malecón de Villahermosa', categoria: 'cultura', lat: 17.9880, lng: -92.9460, radioKm: 1.5, aliases: ['malecón', 'malecon'] },
  // Coordenada exacta vía Nominatim/OpenStreetMap (verificada 2026-08-06) —
  // agregada después de que una búsqueda real ("cerca de la catedral de
  // tabasco") diera 0 resultados: la IA no puede reconocer un landmark que
  // no está en este catálogo, sin importar qué tan conocido sea en la vida
  // real.
  { key: 'catedral', label: 'Catedral del Señor de Tabasco', categoria: 'cultura', lat: 17.9896, lng: -92.9282, radioKm: 1, aliases: ['catedral', 'catedral de tabasco', 'catedral de villahermosa'] },
  { key: 'cicom', label: 'Zona CICOM', categoria: 'cultura', lat: 17.9800, lng: -92.9280, radioKm: 1.2 },
  { key: 'planetario', label: 'Planetario Tabasco 2000', categoria: 'cultura', lat: 18.0020, lng: -92.9300, radioKm: 1 },
  { key: 'yumka', label: 'Yumká', categoria: 'cultura', lat: 17.9377, lng: -92.8983, radioKm: 2 },
  // Los siguientes 5 se agregaron el mismo día que 'catedral', misma
  // auditoría — coordenadas exactas vía Nominatim/OpenStreetMap, no había
  // ni un solo edificio de gobierno ni un solo espacio deportivo/museo
  // catalogado antes de esto, pese a ser de los lugares más buscados de
  // Villahermosa.
  { key: 'palacio-gobierno', label: 'Palacio de Gobierno del Estado de Tabasco', categoria: 'cultura', lat: 17.9880, lng: -92.9195, radioKm: 1, aliases: ['palacio de gobierno', 'gobierno del estado'] },
  { key: 'congreso-tabasco', label: 'Congreso del Estado de Tabasco', categoria: 'cultura', lat: 17.9871, lng: -92.9201, radioKm: 1, aliases: ['congreso del estado', 'congreso de tabasco'] },
  { key: 'museo-carlos-pellicer', label: 'Museo Regional de Antropología Carlos Pellicer', categoria: 'cultura', lat: 17.9792, lng: -92.9234, radioKm: 1.2, aliases: ['museo carlos pellicer', 'museo de antropología', 'museo de antropologia'] },
  { key: 'parque-juarez', label: 'Parque Juárez', categoria: 'cultura', lat: 17.9911, lng: -92.9176, radioKm: 1, aliases: ['parque juarez'] },
  // Sin alias corto "estadio" — sería ambiguo si algún día se cataloga otro
  // (mismo criterio que universidad-olmeca/sector-carrizal más arriba).
  { key: 'estadio-centenario', label: 'Estadio Centenario 27 de Febrero', categoria: 'cultura', lat: 17.9767, lng: -92.9440, radioKm: 1.2, aliases: ['estadio centenario', 'estadio de los olmecas', 'ciudad deportiva', 'estadio de beisbol', 'estadio de béisbol'] },
  // Segunda ronda de la misma auditoría (2026-08-06) — a partir de una tabla
  // de referencia que compartió el usuario, verificada punto por punto
  // contra Nominatim antes de agregar nada (no se copió tal cual). Un lugar
  // de esa tabla, "Pirámide de Pemex" (Tabasco 2000), NO se agregó: no
  // apareció con ninguna variante de búsqueda razonable en Nominatim, y
  // adivinar su coordenada sería repetir el mismo error que causó el bug
  // original de "Centro Histórico" en colonias.ts.
  { key: 'instituto-juarez', label: 'Instituto Juárez', categoria: 'educacion', lat: 17.9889, lng: -92.9211, radioKm: 1, aliases: ['instituto juárez', 'instituto juarez'] },
  { key: 'centro-convenciones', label: 'Centro de Convenciones Tabasco', categoria: 'cultura', lat: 17.9999, lng: -92.9465, radioKm: 1, aliases: ['centro de convenciones', 'convenciones'] },
  { key: 'casa-azulejos', label: 'Casa de los Azulejos (Museo de Historia de Tabasco)', categoria: 'cultura', lat: 17.9884, lng: -92.9184, radioKm: 1, aliases: ['casa de los azulejos', 'museo de historia de tabasco'] },
  { key: 'museo-papagayo', label: 'Museo Interactivo Papagayo', categoria: 'cultura', lat: 18.0059, lng: -92.9659, radioKm: 1.2, aliases: ['museo papagayo', 'papagayo'] },

  // Villahermosa (Centro) — educación
  { key: 'ujat', label: 'UJAT', categoria: 'educacion', lat: 17.9910, lng: -92.9170, radioKm: 1.5, aliases: ['universidad juárez autónoma de tabasco'] },
  { key: 'itvh', label: 'Instituto Tecnológico de Villahermosa', categoria: 'educacion', lat: 17.9878, lng: -92.9194, radioKm: 1.2, aliases: ['itvh', 'tecnológico de villahermosa', 'tecnm villahermosa'] },
  { key: 'uvm-villahermosa', label: 'UVM Villahermosa', categoria: 'educacion', lat: 17.9720, lng: -92.9370, radioKm: 1.2, aliases: ['uvm'] },
  { key: 'icest', label: 'ICEST', categoria: 'educacion', lat: 17.9850, lng: -92.9350, radioKm: 1.2 },
  // Sin alias "olmeca" a propósito: es también el nombre de una colonia
  // real (src/data/zones.json) a ~13km de aquí — confirmado con pruebas
  // reales que el alias corto generaba colonia:"Olmeca" + landmark a la vez,
  // dos filtros que se contradicen entre sí (cero resultados posibles) para
  // cualquier búsqueda que solo dijera "Olmeca". El nombre completo
  // "Universidad Olmeca" ya es suficiente y no es ambiguo.
  { key: 'universidad-olmeca', label: 'Universidad Olmeca', categoria: 'educacion', lat: 18.0000, lng: -92.8400, radioKm: 2 },
  { key: 'unid-villahermosa', label: 'UNID Villahermosa', categoria: 'educacion', lat: 17.9905, lng: -92.9230, radioKm: 1.2, aliases: ['unid'] },
  { key: 'universidad-dunamis', label: 'Universidad Dunamis', categoria: 'educacion', lat: 17.9870, lng: -92.9440, radioKm: 1.2, aliases: ['dunamis'] },
  { key: 'uvg-villahermosa', label: 'Universidad Valle del Grijalva', categoria: 'educacion', lat: 17.9600, lng: -92.9250, radioKm: 1.5, aliases: ['uvg', 'valle del grijalva'] },
  { key: 'ieu-villahermosa', label: 'Universidad IEU', categoria: 'educacion', lat: 17.9860, lng: -92.9400, radioKm: 1.2, aliases: ['ieu'] },

  // Villahermosa (Centro) — salud (públicos y privados)
  { key: 'hospital-rovirosa', label: 'Hospital Rovirosa', categoria: 'salud', lat: 17.9870, lng: -92.9420, radioKm: 1.5, aliases: ['rovirosa'] },
  { key: 'hospital-alta-especialidad', label: 'Hospital de Alta Especialidad Juan Graham (La Isla)', categoria: 'salud', lat: 17.9750, lng: -92.9100, radioKm: 2, aliases: ['hospital juan graham', 'juan graham', 'la isla', 'alta especialidad'] },
  { key: 'hospital-nino', label: 'Hospital del Niño Rodolfo Nieto Padrón', categoria: 'salud', lat: 17.9930, lng: -92.9200, radioKm: 1.5, aliases: ['hospital del niño', 'nieto padrón', 'rodolfo nieto padrón'] },
  { key: 'imss-hgz46', label: 'IMSS Hospital General de Zona 46', categoria: 'salud', lat: 17.9890, lng: -92.9210, radioKm: 1.5, aliases: ['imss', 'hgz 46', 'hospital general de zona 46'] },
  { key: 'hospital-angeles', label: 'Hospital Ángeles Villahermosa', categoria: 'salud', lat: 18.0030, lng: -92.9330, radioKm: 1.2, aliases: ['hospital ángeles', 'hospital angeles'] },
  { key: 'medica-tabasco', label: 'Médica Tabasco', categoria: 'salud', lat: 18.0005, lng: -92.9370, radioKm: 1.2 },
  { key: 'hospital-sureste', label: 'Hospital del Sureste', categoria: 'salud', lat: 17.9915, lng: -92.9285, radioKm: 1.2 },
  { key: 'hospital-ceracom', label: 'Hospital Ceracom', categoria: 'salud', lat: 17.9905, lng: -92.9265, radioKm: 1.2, aliases: ['ceracom'] },
  { key: 'clinica-tabasco-2000', label: 'Clínica Médica Quirúrgica Tabasco 2000', categoria: 'salud', lat: 18.0025, lng: -92.9325, radioKm: 1.2, aliases: ['clínica tabasco 2000'] },
  { key: 'isset-centro-medico', label: 'ISSET Centro Médico', categoria: 'salud', lat: 17.9945, lng: -92.9210, radioKm: 1.2, aliases: ['isset'] },
  { key: 'isset-especialidades', label: 'ISSET Centro de Especialidades Médicas', categoria: 'salud', lat: 17.9900, lng: -92.9270, radioKm: 1.2, aliases: ['isset especialidades'] },
  { key: 'cruz-roja', label: 'Cruz Roja Villahermosa', categoria: 'salud', lat: 17.9895, lng: -92.9255, radioKm: 1.2, aliases: ['cruz roja'] },

  // Villahermosa (Centro) — comercial
  { key: 'galerias-tabasco', label: 'Galerías Tabasco', categoria: 'comercial', lat: 18.0008, lng: -92.9461, radioKm: 1.2 },
  { key: 'altabrisa', label: 'Plaza Altabrisa', categoria: 'comercial', lat: 17.9658, lng: -92.9403, radioKm: 1.2, aliases: ['altabrisa'] },
  { key: 'plaza-sendero', label: 'Plaza Sendero', categoria: 'comercial', lat: 18.019117, lng: -92.912933, radioKm: 1.2 },
  { key: 'plaza-cristal', label: 'Plaza Cristal', categoria: 'comercial', lat: 17.965206, lng: -92.901093, radioKm: 1.2 },
  { key: 'plaza-mallorca', label: 'Plaza Mallorca', categoria: 'comercial', lat: 17.966936, lng: -92.965202, radioKm: 1.2 },
  // Sin alias corto "pino suárez": ya es el alias de la colonia "José María
  // Pino Suárez" en colonias.ts (lugar real distinto, a varios km de aquí)
  // — mismo problema que ya se evitó con "olmeca"/"carrizal": un alias
  // corto ambiguo entre un landmark y una colonia hace que ambos filtros se
  // apliquen a la vez y no quede ningún resultado posible.
  { key: 'mercado-pino-suarez', label: 'Mercado José María Pino Suárez', categoria: 'comercial', lat: 17.9964, lng: -92.9144, radioKm: 1, aliases: ['mercado pino suárez', 'mercado pino suarez'] },
  { key: 'plaza-las-americas', label: 'Plaza Las Américas', categoria: 'comercial', lat: 18.0144, lng: -92.9190, radioKm: 1.2, aliases: ['plaza las américas', 'plaza las americas', 'las américas', 'las americas'] },

  // Villahermosa (Centro) — transporte
  { key: 'aeropuerto-vsa', label: 'Aeropuerto de Villahermosa (VSA)', categoria: 'transporte', lat: 17.9970, lng: -92.8174, radioKm: 4, aliases: ['aeropuerto', 'vsa'] },
  { key: 'central-camionera', label: 'Central de Autobuses ADO', categoria: 'transporte', lat: 17.9910, lng: -92.9330, radioKm: 1.5, aliases: ['ado', 'central camionera', 'central de autobuses'] },

  // Comalcalco
  { key: 'zona-arqueologica-comalcalco', label: 'Zona Arqueológica de Comalcalco', categoria: 'cultura', lat: 18.2792, lng: -93.2010, radioKm: 2, aliases: ['zona arqueológica comalcalco', 'ruinas de comalcalco'] },
  { key: 'comalcalco-centro', label: 'centro de Comalcalco', categoria: 'centro', lat: 18.2766, lng: -93.2145, radioKm: 2.5 },

  // Paraíso
  { key: 'puerto-dos-bocas', label: 'Puerto Dos Bocas', categoria: 'transporte', lat: 18.3333, lng: -93.1833, radioKm: 5 },
  { key: 'paraiso-centro', label: 'centro de Paraíso', categoria: 'centro', lat: 18.3999, lng: -93.2073, radioKm: 2.5 },

  // Otros municipios — punto de referencia del centro urbano
  { key: 'cardenas-centro', label: 'centro de Cárdenas', categoria: 'centro', lat: 18.0037, lng: -93.3737, radioKm: 2.5 },
  { key: 'nacajuca-centro', label: 'centro de Nacajuca', categoria: 'centro', lat: 17.9936, lng: -93.0716, radioKm: 2.5 },
  { key: 'jalpa-centro', label: 'centro de Jalpa de Méndez', categoria: 'centro', lat: 18.1762, lng: -93.0656, radioKm: 2.5 },
  { key: 'huimanguillo-centro', label: 'centro de Huimanguillo', categoria: 'centro', lat: 17.8355, lng: -93.3826, radioKm: 2.5 },
  { key: 'centla-centro', label: 'centro de Frontera (Centla)', categoria: 'centro', lat: 18.3892, lng: -92.5917, radioKm: 2.5 },
  { key: 'macuspana-centro', label: 'centro de Macuspana', categoria: 'centro', lat: 17.7633, lng: -92.5936, radioKm: 2.5 },
  { key: 'tenosique-centro', label: 'centro de Tenosique', categoria: 'centro', lat: 17.4743, lng: -91.4241, radioKm: 2.5 },
];

export function getLandmark(key: string): Landmark | undefined {
  return LANDMARKS.find((l) => l.key === key);
}

/** Distancia entre dos coordenadas en km (fórmula de Haversine). */
export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Solo categorías donde hay más de un punto catalogado tiene sentido preguntar
 *  "cerca de un/a ___" sin nombrar cuál — transporte/cultura en la práctica son
 *  un solo lugar de referencia (el aeropuerto, la laguna) y ya se resuelven como
 *  landmark específico por nombre. */
export const CATEGORIAS_GENERICAS: { value: 'salud' | 'educacion' | 'comercial'; label: string; keywords: string[] }[] = [
  { value: 'salud', label: 'un hospital', keywords: ['hospital', 'clínica', 'clinica', 'centro de salud'] },
  { value: 'educacion', label: 'una escuela o universidad', keywords: ['universidad', 'escuela', 'colegio', 'preparatoria', 'secundaria', 'tecnológico', 'tecnologico'] },
  { value: 'comercial', label: 'un centro comercial', keywords: ['centro comercial', 'plaza comercial', 'mall'] },
];

export function landmarksPorCategoria(categoria: string): Landmark[] {
  return LANDMARKS.filter((l) => l.categoria === categoria);
}

/** Distancia al landmark más cercano de una categoría — null si no hay ninguno catalogado ahí. */
export function distanciaMinimaACategoria(lat: number, lng: number, categoria: string): number | null {
  const puntos = landmarksPorCategoria(categoria);
  if (puntos.length === 0) return null;
  return Math.min(...puntos.map((l) => distanciaKm(lat, lng, l.lat, l.lng)));
}

/** Radio por defecto de "cerca de un/a [categoría]" cuando no se nombra un lugar específico. */
export const RADIO_CATEGORIA_KM = 2.5;
