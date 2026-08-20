import { distanciaKm } from './landmarks';
import coloniasMunicipiosData from '@/data/colonias-municipios.json';
import { backendFetch } from './backendApi';

export interface ColoniaCoord {
  key: string;
  label: string;
  municipio: string;
  lat: number;
  lng: number;
  /** Qué tan lejos todavía cuenta como "cerca de" esta colonia. */
  radioKm: number;
  aliases?: string[];
}

/**
 * Cuánto vale "cerca de" una colonia por defecto. Una colonia es un área,
 * no un punto — más grande que el radio típico de un landmark puntual
 * (parque, hospital), pero acotado para no volverse una búsqueda a nivel de
 * toda la ciudad. Un solo valor para todas en vez de uno por colonia:
 * no hay una fuente confiable de polígonos reales para calibrar caso por
 * caso, y un número fijo es más honesto que inventar un radio "a ojo" por
 * cada una.
 */
export const RADIO_COLONIA_KM = 1.3;

/**
 * Coordenadas de colonias/fraccionamientos reales de Tabasco, para poder
 * calcular distancia real (Haversine, igual que src/lib/landmarks.ts) en
 * vez de solo comparar texto contra el campo `colonia` de cada propiedad —
 * antes de esto, buscar "cerca de la col Magisterial" daba cero resultados
 * aunque hubiera una propiedad a 220m, porque su campo `colonia` dice
 * "Framboyanes", no "Magisterial" (caso real reportado y verificado).
 *
 * Cobertura: el catálogo OFICIAL completo de colonias de Centro
 * (Villahermosa) — 229 nombres, misma fuente que usa el sistema de
 * códigos postales (heraldo.com.mx/SEPOMEX) — se intentó geocodificar
 * contra OpenStreetMap/Nominatim uno por uno. De ahí solo entraron aquí
 * las que resolvieron con confianza alta:
 *   1. Coincidencia `place/neighbourhood` en OSM (el lugar existe como tal,
 *      con ese nombre) — la mayoría de las entradas de abajo.
 *   2. Coincidencia `leisure/park` con nombre igual a la colonia (ej.
 *      "Parque Guayabal" para la colonia "Guayabal") — un parque de barrio
 *      suele estar dentro de su colonia, mismo razonamiento ya usado para
 *      verificar "Atasta" cruzándolo contra los landmarks UJAT/IMSS.
 * Se descartaron a propósito los resultados que solo coincidieron con una
 * CALLE (`highway/*`), un polígono de uso de suelo genérico
 * (`landuse/residential|commercial`), o un negocio/edificio que por
 * casualidad comparte nombre (`amenity/bank`, `office/government`, etc.) —
 * ninguno de esos es un proxy confiable del centro real de la colonia; una
 * calle puede estar en su borde, no en medio, y un banco puede estar en
 * cualquier parte de la ciudad. Es la misma razón por la que "Zona Rural",
 * "Zona Rural Norte", "Zona Industrial" y "Colonia Ejidal" (de otros
 * municipios) quedaron fuera desde antes: no hay match confiable.
 *
 * De las 163 colonias intentadas (excluyendo ~66 ya cubiertas o
 * demasiado genéricas para intentar), 56 pasaron la verificación de dos
 * niveles de arriba. Las ~107 restantes simplemente no tienen match en
 * OSM con ese nombre — se prefirió dejarlas fuera a inventar una
 * coordenada. Colonias que no están aquí (de Centro o de cualquier otro
 * municipio) no rompen la búsqueda: caen al match de texto de siempre
 * (ver filters.ts), solo pierden precisión de distancia.
 *
 * Fuera de Centro/Villahermosa la cobertura sigue siendo mínima (solo
 * El Bellote y Frontera, verificadas antes) — el pedido explícito fue
 * "por lo menos las del centro"; extender esto a los otros 9 municipios
 * de Tabasco es un trabajo aparte, del mismo tamaño que este.
 *
 * Nota de calidad de datos (corregida 2026-08-06): "El Bellote" está aquí
 * con municipio real "Paraíso" (confirmado en OSM) — la propiedad de
 * muestra `prop-010` (src/data/properties.json) tenía `colonia: "El
 * Bellote"` con `municipio: "Nacajuca"`, una combinación imposible (título
 * y descripción decían "Nacajuca, 20 min del centro", pero El Bellote está
 * a 42km de Villahermosa). La coordenada `lat`/`lng` original de esa
 * propiedad, antes de que la migración de privacidad de ubicación la
 * reemplazara por `latPublico`/`lngPublico`, coincidía exacto con el
 * centroide de Nacajuca en municipalities.json — confirma que la intención
 * real era Nacajuca, no El Bellote. Se corrigió `prop-010` a
 * `colonia: "Centro"` (mismo patrón que otros municipios sin catálogo
 * propio, ver Cárdenas/Comalcalco más abajo en properties.json).
 *
 * Nota de precisión: "Framboyanes" (arriba, ya verificada) y un geocode
 * independiente hecho en esta ronda para lo mismo difieren por ~640m —
 * ambos puntos caen dentro del bounding box real que OSM le asigna a esa
 * colonia (una colonia es un área, no un punto; esta es la imprecisión
 * normal de reducirla a uno). Se descartó el geocode nuevo y se dejó el
 * valor ya existente, para no invalidar mediciones ya mostradas.
 */
export const COLONIAS_COORDS: ColoniaCoord[] = [
  // Ya verificadas en src/data/zones.json — mismas coordenadas, no se
  // vuelven a geocodificar.
  { key: 'tabasco-2000', label: 'Tabasco 2000', municipio: 'Centro', lat: 17.9994, lng: -92.9316, radioKm: RADIO_COLONIA_KM },
  { key: 'gaviotas-norte', label: 'Gaviotas Norte', municipio: 'Centro', lat: 18.0141, lng: -92.9312, radioKm: RADIO_COLONIA_KM },
  { key: 'gaviotas-sur', label: 'Gaviotas Sur', municipio: 'Centro', lat: 18.0089, lng: -92.9278, radioKm: RADIO_COLONIA_KM },
  { key: 'framboyanes', label: 'Framboyanes', municipio: 'Centro', lat: 18.0056, lng: -92.9288, radioKm: RADIO_COLONIA_KM },
  // "Sector Carrizal" — DISTINTO de "Fraccionamiento Carrizal" más abajo
  // (~3.4km de diferencia, verificado). Ninguno de los dos lleva un alias
  // corto "carrizal": mismo criterio que universidad-olmeca en
  // landmarks.ts, un alias ambiguo entre dos lugares reales es peor que no
  // tener alias — sin coincidencia exacta, cae al texto de siempre, que sí
  // encuentra ambos por separado.
  { key: 'sector-carrizal', label: 'Sector Carrizal', municipio: 'Centro', lat: 17.9875, lng: -92.9421, radioKm: RADIO_COLONIA_KM },
  // Corregida 2026-08-06: la coordenada anterior (17.9923, -92.9178) en
  // realidad hace reverse-geocode a "Calle Venustiano Carranza, Centro" —
  // una calle del centro de la ciudad a ~3.5km de la colonia real.
  // Encontrado al revisar por qué una propiedad etiquetada "Atasta" se veía
  // en el mapa cerca del malecón/centro, cuando la colonia real está al
  // poniente. Nueva coordenada vía Nominatim: "Colonia Atasta de Serra"
  // (place/neighbourhood, el mismo tipo de match que ya usa el resto del
  // catálogo).
  { key: 'atasta', label: 'Atasta', municipio: 'Centro', lat: 17.9846, lng: -92.9495, radioKm: RADIO_COLONIA_KM },
  // Corregida 2026-08-06: la coordenada anterior (17.9895, -92.9478) en
  // realidad hace reverse-geocode a "Calle Mariano Abasolo, Colonia Atasta
  // de Serra" — un lugar real, pero a ~2.1km del centro histórico
  // verdadero, y NADA que ver con esta colonia. Se descubrió al verificar
  // por qué "cerca de la catedral de tabasco" no encontraba una propiedad
  // que sí estaba ahí. Nueva coordenada: la Catedral del Señor de Tabasco
  // (verificada vía Nominatim, ver 'catedral' en landmarks.ts), el ancla
  // más defendible para "el centro histórico" de una ciudad mexicana — no
  // se encontró un nodo de OSM etiquetado específicamente
  // place/neighbourhood="Centro Histórico" para usar en su lugar.
  { key: 'centro-historico', label: 'Centro Histórico', municipio: 'Centro', lat: 17.9896, lng: -92.9282, radioKm: RADIO_COLONIA_KM },
  { key: 'olmeca', label: 'Olmeca', municipio: 'Centro', lat: 17.9812, lng: -92.9502, radioKm: RADIO_COLONIA_KM },
  { key: 'gil-y-saenz', label: 'Gil y Sáenz', municipio: 'Centro', lat: 17.9867, lng: -92.9356, radioKm: RADIO_COLONIA_KM },
  { key: 'col-del-parque', label: 'Col. del Parque', municipio: 'Centro', lat: 17.9734, lng: -92.9267, radioKm: RADIO_COLONIA_KM },

  // Geocodificadas y verificadas en esta sesión (OpenStreetMap/Nominatim).
  { key: 'magisterial', label: 'Magisterial', municipio: 'Centro', lat: 18.0036, lng: -92.9287, radioKm: RADIO_COLONIA_KM },
  { key: 'fraccionamiento-carrizal', label: 'Fraccionamiento Carrizal', municipio: 'Centro', lat: 18.0141, lng: -92.9530, radioKm: RADIO_COLONIA_KM },
  { key: 'el-bellote', label: 'El Bellote', municipio: 'Paraíso', lat: 18.4250, lng: -93.1534, radioKm: RADIO_COLONIA_KM },
  { key: 'frontera', label: 'Frontera', municipio: 'Centla', lat: 18.5322, lng: -92.6461, radioKm: RADIO_COLONIA_KM },

  // Catálogo completo de Centro/Villahermosa, geocodificadas y verificadas
  // en esta ronda (ver metodología de dos niveles arriba).
  { key: 'adolfo-lopez-mateos', label: 'Adolfo López Mateos', municipio: 'Centro', lat: 18.0002, lng: -92.9299, radioKm: RADIO_COLONIA_KM },
  { key: 'alvaro-obregon', label: 'Álvaro Obregón', municipio: 'Centro', lat: 17.9959, lng: -92.9403, radioKm: RADIO_COLONIA_KM },
  { key: 'bonanza', label: 'Bonanza', municipio: 'Centro', lat: 18.0040, lng: -92.9385, radioKm: RADIO_COLONIA_KM },
  { key: 'bosques-de-villahermosa', label: 'Bosques de Villahermosa', municipio: 'Centro', lat: 18.0106, lng: -92.9452, radioKm: RADIO_COLONIA_KM },
  { key: 'brisas-del-grijalva', label: 'Brisas del Grijalva', municipio: 'Centro', lat: 18.0118, lng: -92.9060, radioKm: RADIO_COLONIA_KM },
  // "Ciudad Industrial" e "Infonavit" (sueltos) resolvieron al MISMO nodo
  // real de OSM — es un solo lugar con nombre compuesto. NO se le da alias
  // "Infonavit" a secas: el catálogo original tiene varios "Infonavit ___"
  // distintos (2da/3a Sección, etc.) que no se pudieron verificar — un
  // alias genérico aquí sería tan ambiguo como el caso Carrizal/Olmeca.
  { key: 'infonavit-ciudad-industrial', label: 'Infonavit Ciudad Industrial', municipio: 'Centro', lat: 18.0256, lng: -92.9011, radioKm: RADIO_COLONIA_KM, aliases: ['Ciudad Industrial'] },
  { key: 'cosmos', label: 'Cosmos', municipio: 'Centro', lat: 18.0278, lng: -92.9040, radioKm: RADIO_COLONIA_KM },
  { key: 'cotip', label: 'Cotip', municipio: 'Centro', lat: 17.9730, lng: -92.9711, radioKm: RADIO_COLONIA_KM },
  { key: 'del-bosque', label: 'Del Bosque', municipio: 'Centro', lat: 17.9732, lng: -92.9492, radioKm: RADIO_COLONIA_KM },
  { key: 'florida', label: 'Florida', municipio: 'Centro', lat: 17.9971, lng: -92.9317, radioKm: RADIO_COLONIA_KM },
  // Resolvió específicamente a esta etapa del fraccionamiento, no a
  // "Fovissste" en general (que tiene 1a-4a Etapa + 4a Sección Carrizal,
  // sin verificar) — el label dice la verdad de lo que se comprobó.
  { key: 'fovissste-casa-blanca', label: 'Fovissste Casa Blanca', municipio: 'Centro', lat: 18.0021, lng: -92.9137, radioKm: RADIO_COLONIA_KM },
  { key: 'francisco-villa', label: 'Francisco Villa', municipio: 'Centro', lat: 18.0281, lng: -92.8897, radioKm: RADIO_COLONIA_KM },
  { key: 'galaxia', label: 'Galaxia', municipio: 'Centro', lat: 18.0001, lng: -92.9505, radioKm: RADIO_COLONIA_KM },
  { key: 'guadalupe', label: 'Guadalupe', municipio: 'Centro', lat: 17.9769, lng: -92.9634, radioKm: RADIO_COLONIA_KM },
  { key: 'guadalupe-borja', label: 'Guadalupe Borja', municipio: 'Centro', lat: 17.9769, lng: -92.9634, radioKm: RADIO_COLONIA_KM },
  { key: 'heriberto-kehoe-vicent', label: 'Heriberto Kehoe Vicent', municipio: 'Centro', lat: 18.0091, lng: -92.9412, radioKm: RADIO_COLONIA_KM },
  { key: 'insurgentes', label: 'Insurgentes', municipio: 'Centro', lat: 18.0334, lng: -92.9005, radioKm: RADIO_COLONIA_KM },
  { key: 'jardines-del-sol', label: 'Jardines del Sol', municipio: 'Centro', lat: 18.0262, lng: -92.9048, radioKm: RADIO_COLONIA_KM },
  { key: 'jardines-del-sur', label: 'Jardines del Sur', municipio: 'Centro', lat: 17.9649, lng: -92.9547, radioKm: RADIO_COLONIA_KM },
  { key: 'jesus-garcia', label: 'Jesús García', municipio: 'Centro', lat: 17.9955, lng: -92.9343, radioKm: RADIO_COLONIA_KM },
  { key: 'jose-maria-pino-suarez', label: 'José María Pino Suárez', municipio: 'Centro', lat: 17.9730, lng: -92.9518, radioKm: RADIO_COLONIA_KM, aliases: ['Pino Suárez'] },
  { key: 'jose-pages-llergo', label: 'José Pagés Llergo', municipio: 'Centro', lat: 17.9820, lng: -92.9697, radioKm: RADIO_COLONIA_KM },
  // Resolvió específicamente a la Sección II (de I/II/III sin verificar).
  { key: 'la-manga-ii', label: 'La Manga II', municipio: 'Centro', lat: 17.9999, lng: -92.9087, radioKm: RADIO_COLONIA_KM },
  { key: 'las-delicias', label: 'Las Delicias', municipio: 'Centro', lat: 17.9714, lng: -92.9692, radioKm: RADIO_COLONIA_KM },
  { key: 'lindavista', label: 'Lindavista', municipio: 'Centro', lat: 17.9916, lng: -92.9421, radioKm: RADIO_COLONIA_KM },
  { key: 'loma-linda', label: 'Loma Linda', municipio: 'Centro', lat: 17.9936, lng: -92.9414, radioKm: RADIO_COLONIA_KM },
  { key: 'marcos-buendia', label: 'Marcos Buendia', municipio: 'Centro', lat: 17.9690, lng: -92.9246, radioKm: RADIO_COLONIA_KM },
  // Resolvió específicamente a la Sección I (de 1a/2a/5a Sección sin verificar).
  { key: 'miguel-hidalgo-i', label: 'Miguel Hidalgo I', municipio: 'Centro', lat: 17.9777, lng: -92.9781, radioKm: RADIO_COLONIA_KM },
  { key: 'multiochenta', label: 'Multiochenta', municipio: 'Centro', lat: 18.0028, lng: -92.9536, radioKm: RADIO_COLONIA_KM },
  { key: 'nueva-imagen', label: 'Nueva Imagen', municipio: 'Centro', lat: 18.0051, lng: -92.9405, radioKm: RADIO_COLONIA_KM },
  { key: 'nueva-villahermosa', label: 'Nueva Villahermosa', municipio: 'Centro', lat: 17.9927, lng: -92.9283, radioKm: RADIO_COLONIA_KM },
  { key: 'oropeza', label: 'Oropeza', municipio: 'Centro', lat: 18.0003, lng: -92.9402, radioKm: RADIO_COLONIA_KM },
  { key: 'palmitas', label: 'Palmitas', municipio: 'Centro', lat: 17.9791, lng: -92.9538, radioKm: RADIO_COLONIA_KM },
  { key: 'pensiones', label: 'Pensiones', municipio: 'Centro', lat: 17.9768, lng: -92.9482, radioKm: RADIO_COLONIA_KM },
  { key: 'prados-de-villahermosa', label: 'Prados de Villahermosa', municipio: 'Centro', lat: 18.0058, lng: -92.9333, radioKm: RADIO_COLONIA_KM },
  { key: 'primero-de-mayo', label: 'Primero de Mayo', municipio: 'Centro', lat: 17.9734, lng: -92.9356, radioKm: RADIO_COLONIA_KM },
  { key: 'punta-brava', label: 'Punta Brava', municipio: 'Centro', lat: 17.9696, lng: -92.9660, radioKm: RADIO_COLONIA_KM },
  { key: 'real-de-minas', label: 'Real de Minas', municipio: 'Centro', lat: 18.0071, lng: -92.9457, radioKm: RADIO_COLONIA_KM },
  { key: 'sanchez-magallanes', label: 'Sánchez Magallanes', municipio: 'Centro', lat: 17.9750, lng: -92.9514, radioKm: RADIO_COLONIA_KM },
  // Resolvió específicamente a la Sección I (de I/II/III sin verificar).
  { key: 'triunfo-la-manga-i', label: 'Triunfo La Manga I', municipio: 'Centro', lat: 17.9794, lng: -92.9164, radioKm: RADIO_COLONIA_KM },
  { key: 'valle-marino', label: 'Valle Marino', municipio: 'Centro', lat: 18.0158, lng: -92.9171, radioKm: RADIO_COLONIA_KM },
  { key: 'villa-las-fuentes', label: 'Villa las Fuentes', municipio: 'Centro', lat: 17.9706, lng: -92.9512, radioKm: RADIO_COLONIA_KM },
  { key: 'villas-del-bosque', label: 'Villas del Bosque', municipio: 'Centro', lat: 17.9980, lng: -92.9544, radioKm: RADIO_COLONIA_KM },
  { key: 'vista-alegre', label: 'Vista Alegre', municipio: 'Centro', lat: 17.9757, lng: -92.9558, radioKm: RADIO_COLONIA_KM },
  // Agregada 2026-08-08 — confirmada vía Nominatim (place/neighbourhood,
  // nombre exacto). Distinta del "Club Campestre Villahermosa" (el campo de
  // golf en sí, landmarks.ts) que queda a ~600m — el fraccionamiento es más
  // grande que el club. Surgió al verificar la tabla de "zonas de mayor
  // plusvalía" que trajo el usuario (ver ZONAS_DESTACADAS más abajo):
  // "El Country"/"Jardines del Country" que mencionaba la misma tabla NO se
  // pudieron confirmar en Nominatim con ningún término, se dejaron fuera.
  { key: 'club-campestre', label: 'Fraccionamiento Club Campestre', municipio: 'Centro', lat: 18.0098351, lng: -92.9497433, radioKm: 1, aliases: ['club campestre', 'campestre'] },
  // Agregada 2026-08-08 (segunda tabla del usuario, "vocación de zonas") —
  // confirmada vía Nominatim (place/neighbourhood, nombre exacto). "El
  // Country" se reintentó una vez más con "86039"/calle Macuilis como
  // contexto — sigue sin ningún resultado, van 6+ variantes probadas en dos
  // rondas distintas, se da por no verificable con las fuentes disponibles.
  { key: 'indeco', label: 'Colonia Indeco', municipio: 'Centro', lat: 18.0215479, lng: -92.8978157, radioKm: 1, aliases: ['indeco', 'indeco unidad'] },
  // Agregada 2026-08-08 — sin match directo de "Fraccionamiento Pomoca" en
  // Nominatim, pero sí de negocios reales (centro comercial, parada de
  // TRANSMETROPOLITANO, sitio de taxis) todos etiquetados dentro de la
  // localidad "Pomoca", a ~1km de 'saloya-segunda-seccion' (arriba) — mismo
  // caso que ya documentado en la cuarta pasada de landmarks.ts: dos formas
  // de nombrar zonas vecinas/superpuestas, no un error. Se usa el punto del
  // centro comercial (POMOCA 2) por ser el más específico de los tres.
  { key: 'pomoca', label: 'Pomoca', municipio: 'Nacajuca', lat: 18.0513378, lng: -92.9294658, radioKm: 1.5, aliases: ['pomoca valle real', 'fraccionamiento pomoca'] },
  // Verificadas vía parque de barrio con el mismo nombre (nivel 2, ver
  // metodología arriba) en vez de un nodo de colonia directo.
  { key: '18-de-marzo', label: '18 de Marzo', municipio: 'Centro', lat: 18.0095, lng: -92.9424, radioKm: RADIO_COLONIA_KM },
  { key: 'carlos-a-madrazo', label: 'Carlos A. Madrazo', municipio: 'Centro', lat: 17.9857, lng: -92.9193, radioKm: RADIO_COLONIA_KM },
  { key: 'el-parque', label: 'El Parque', municipio: 'Centro', lat: 18.0212, lng: -92.9051, radioKm: RADIO_COLONIA_KM },
  { key: 'guayabal', label: 'Guayabal', municipio: 'Centro', lat: 17.9728, lng: -92.9270, radioKm: RADIO_COLONIA_KM },
  { key: 'jose-colomo', label: 'José Colomo', municipio: 'Centro', lat: 17.9863, lng: -92.9451, radioKm: RADIO_COLONIA_KM },
  { key: 'la-choca', label: 'La Choca', municipio: 'Centro', lat: 18.0041, lng: -92.9529, radioKm: RADIO_COLONIA_KM },
  { key: 'las-brisas', label: 'Las Brisas', municipio: 'Centro', lat: 17.9772, lng: -92.9272, radioKm: RADIO_COLONIA_KM },
  { key: 'lomas-del-dorado', label: 'Lomas del Dorado', municipio: 'Centro', lat: 17.9590, lng: -92.9517, radioKm: RADIO_COLONIA_KM },
  { key: 'tierra-colorada', label: 'Tierra Colorada', municipio: 'Centro', lat: 18.0246, lng: -92.9207, radioKm: RADIO_COLONIA_KM },
  { key: 'villa-de-las-flores', label: 'Villa de las Flores', municipio: 'Centro', lat: 18.0276, lng: -92.8994, radioKm: RADIO_COLONIA_KM },
  { key: 'villa-de-los-arcos', label: 'Villa de los Arcos', municipio: 'Centro', lat: 17.9764, lng: -92.9592, radioKm: RADIO_COLONIA_KM },
  { key: 'villa-de-los-trabajadores', label: 'Villa de los Trabajadores', municipio: 'Centro', lat: 17.9900, lng: -92.9604, radioKm: RADIO_COLONIA_KM },
  // Verificada vía Nominatim (2026-08-06, misma auditoría de landmarks que
  // originó "catedral" más arriba). Administrativamente es Nacajuca, no
  // Centro — a propósito, aunque en la práctica ya se percibe como una
  // colonia más de la zona conurbada de Villahermosa (fraccionamiento
  // grande y consolidado, no un pueblo aparte).
  // Coordenada actualizada 2026-08-07 al valor oficial de INEGI (ver bloque
  // grande más abajo) — el centroide calculado del polígono real quedó a
  // 187m de la aproximación anterior, dentro del margen esperado.
  { key: 'bosques-de-saloya', label: 'Bosques de Saloya', municipio: 'Nacajuca', lat: 18.0153669, lng: -92.9595985, radioKm: 0.67 },
  // Agregadas 2026-08-07 — de las 107 colonias del catálogo original sin
  // match en Nominatim, se probó una fuente distinta (Google Maps, leyendo
  // las coordenadas de la URL tras buscar "Colonia X, Villahermosa,
  // Tabasco") para 122 nombres. Esa primera pasada dio 101 resultados con
  // distancia plausible a la ciudad — pero NINGUNO se aceptó solo por eso:
  // Google Maps resultó tener fallbacks silenciosos (8 nombres distintos,
  // como "Club Campestre" y "Mayito", cayeron en el MISMO punto exacto que
  // resultó ser "Gaviotas Sur Sector San José" al hacer reverse-geocode).
  // Se le hizo reverse-geocode a los 101 contra Nominatim y solo se
  // aceptaron los que un segundo dato independiente (el barrio/colonia que
  // Nominatim reporta para ese punto) confirmara — 19 lo lograron, y de
  // esos se descartaron 5 más a mano: 'Framboyanes de Villahermosa'
  // (~640m del 'framboyanes' que ya existía arriba, no es un lugar nuevo),
  // 'Gaviotas Sur Sección San José' (a 4km de la 'gaviotas-sur' ya
  // existente, relación ambigua, se prefirió no crear una posible
  // confusión), 'Fovissste' (resolvió a "Etapa I" específica, mismo caso ya
  // documentado con 'fovissste-casa-blanca'), 'Gaviotas Norte Sector
  // Explanada' (el reverse-geocode dio "Gaviotas SUR", no Norte — no
  // coincide) y 'Real Hidalgo' (la única coincidencia con Nominatim fue la
  // palabra "Hidalgo" sola, demasiado débil). De 122 candidatos, 14
  // resultaron confiables con dos fuentes independientes de acuerdo.
  { key: 'blancas-mariposas', label: 'Blancas Mariposas', municipio: 'Centro', lat: 17.9584195, lng: -92.9469486, radioKm: RADIO_COLONIA_KM },
  { key: 'bonampak', label: 'Bonampak', municipio: 'Centro', lat: 17.9600838, lng: -93.007445, radioKm: RADIO_COLONIA_KM },
  { key: 'casa-blanca-1a-seccion', label: 'Casa Blanca 1a Sección', municipio: 'Centro', lat: 18.0045817, lng: -92.9180621, radioKm: RADIO_COLONIA_KM },
  { key: 'deportiva-residencial', label: 'Deportiva Residencial', municipio: 'Centro', lat: 17.9724158, lng: -92.9453798, radioKm: RADIO_COLONIA_KM },
  { key: 'el-recreo', label: 'El Recreo', municipio: 'Centro', lat: 18.015182, lng: -92.9216193, radioKm: RADIO_COLONIA_KM },
  { key: 'flores-del-tropico', label: 'Flores del Trópico', municipio: 'Centro', lat: 18.0045595, lng: -92.9759166, radioKm: RADIO_COLONIA_KM },
  { key: 'islas-del-mundo', label: 'Islas del Mundo', municipio: 'Centro', lat: 17.9751438, lng: -92.9807737, radioKm: RADIO_COLONIA_KM },
  { key: 'jose-narciso-rovirosa', label: 'José Narciso Rovirosa', municipio: 'Centro', lat: 17.9920813, lng: -92.9357863, radioKm: RADIO_COLONIA_KM, aliases: ['Jose N Rovirosa'] },
  { key: 'lagunas', label: 'Lagunas', municipio: 'Centro', lat: 18.0376473, lng: -92.8977572, radioKm: RADIO_COLONIA_KM },
  { key: 'las-garzas', label: 'Las Garzas', municipio: 'Centro', lat: 18.0213187, lng: -92.9002515, radioKm: RADIO_COLONIA_KM },
  { key: 'los-tulipanes', label: 'Los Tulipanes', municipio: 'Centro', lat: 17.9816059, lng: -92.9238736, radioKm: RADIO_COLONIA_KM },
  { key: 'sabina', label: 'Sabina', municipio: 'Centro', lat: 17.9517864, lng: -92.9524085, radioKm: RADIO_COLONIA_KM },
  { key: 'santa-elena', label: 'Santa Elena', municipio: 'Centro', lat: 17.9719048, lng: -92.9905229, radioKm: RADIO_COLONIA_KM },
  { key: 'vicente-guerrero', label: 'Vicente Guerrero', municipio: 'Centro', lat: 18.0315138, lng: -92.8975353, radioKm: RADIO_COLONIA_KM },
];

function normalizarBase(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Exportado para que coloniaDiscovery.ts (server-only) compare nombres con la misma regla exacta, sin duplicar la lógica. */
export function normalizarNombreColonia(s: string): string {
  return normalizarBase(s)
    // Solo se quita el relleno genérico "colonia/col." — la gente lo usa
    // indistintamente para CUALQUIER colonia ("col Magisterial" = "colonia
    // Magisterial"). "fraccionamiento"/"sector" NO se quitan: son parte del
    // nombre propio que distingue lugares reales distintos (ver comentario
    // de Carrizal arriba) — quitarlos causaría el mismo tipo de colisión
    // que ya se evitó con el alias "olmeca" en landmarks.ts.
    .replace(/^(la |el )?(colonia|col\.?)\s+/, '')
    .trim();
}

// Colonias descubiertas automáticamente (geocodificadas contra Nominatim
// con el mismo filtro de dos niveles que las 70 de arriba, ver
// ColoniasService.geocodificarYRegistrar en el backend) — este módulo corre
// también en el navegador (filters.ts, PropertiesClient.tsx), donde no se
// puede consultar el backend en cada llamada, así que se cachean aquí tras
// pedirlas una vez a `GET /colonias/descubiertas` del backend nuevo. Arranca
// vacío: las funciones de abajo simplemente se comportan como si solo
// existiera el catálogo estático hasta que la carga (best-effort, nunca
// bloqueante) termine — ninguna búsqueda se rompe ni espera por esto.
let coloniasDescubiertasCache: ColoniaCoord[] = [];
let cargaIniciada = false;

/** Forma cruda de ColoniaDescubierta tal como la devuelve Prisma/el backend — `aliasesJson` en vez de `aliases`. */
interface ColoniaDescubiertaBackend {
  key: string;
  label: string;
  municipio: string;
  lat: number;
  lng: number;
  radioKm: number;
  aliasesJson: string[] | null;
}

/**
 * Dispara la carga del caché una sola vez por sesión de navegador —
 * llamar varias veces no duplica la petición ni el trabajo. Pensada para
 * invocarse "fire and forget" (sin `await`) desde el punto de entrada del
 * buscador (ver PropertiesClient.tsx) — si falla o tarda, las funciones de
 * abajo siguen funcionando igual, solo sin las colonias descubiertas más
 * recientes hasta que sí cargue.
 */
export function precargarColoniasDescubiertas(): void {
  if (cargaIniciada || typeof window === 'undefined') return;
  cargaIniciada = true;
  backendFetch<ColoniaDescubiertaBackend[]>('/colonias/descubiertas')
    .then((data) => {
      coloniasDescubiertasCache = data.map((c) => ({
        key: c.key,
        label: c.label,
        municipio: c.municipio,
        lat: c.lat,
        lng: c.lng,
        radioKm: c.radioKm,
        aliases: c.aliasesJson ?? undefined,
      }));
    })
    .catch(() => { /* silencioso — se sigue usando solo el catálogo estático */ });
}

/**
 * Equivalente a buscar en `coloniasDescubiertasCache`, pero para Server
 * Components — ahí `precargarColoniasDescubiertas()` nunca llega a
 * ejecutarse (guardada tras `typeof window === 'undefined'`), así que se le
 * pregunta al backend directo en cada llamada. `GET /colonias/descubiertas`
 * ya trae `Cache-Control: public, max-age=300` (BACKEND.md §9), así que esto
 * no golpea la base de datos del backend en cada request de una ficha de
 * propiedad. Reemplaza el `obtenerColoniaDescubiertaPorKey` que antes
 * consultaba la Prisma local del propio frontend — huérfana, esa tabla dejó
 * de recibir descubrimientos nuevos desde que la geocodificación vive en el
 * backend (`ColoniasService.geocodificarYRegistrar`).
 */
export async function obtenerColoniaDescubiertaBackend(key: string): Promise<ColoniaCoord | undefined> {
  try {
    const data = await backendFetch<ColoniaDescubiertaBackend[]>('/colonias/descubiertas');
    const fila = data.find((c) => c.key === key);
    if (!fila) return undefined;
    return {
      key: fila.key,
      label: fila.label,
      municipio: fila.municipio,
      lat: fila.lat,
      lng: fila.lng,
      radioKm: fila.radioKm,
      aliases: fila.aliasesJson ?? undefined,
    };
  } catch {
    return undefined;
  }
}

/**
 * Colonias/asentamientos de los otros 16 municipios de Tabasco (todo menos
 * Centro), fuente: INEGI, "Delimitación de colonias y otros asentamientos
 * humanos" 2024 (https://www.inegi.org.mx/app/biblioteca/ficha.html?upc=794551132180),
 * descarga oficial por estado, sin necesidad de token/registro. A
 * diferencia de todo lo demás en este archivo (geocodificado punto por
 * punto contra Nominatim/Google), esto viene de polígonos reales:
 * lat/lng es el centroide del polígono de cada asentamiento (proyección
 * original Lambert Conformal Conic "MEXICO_ITRF_2008_LCC", reproyectada a
 * WGS84 con proj4) y radioKm es la distancia real del centroide al vértice
 * más lejano del polígono (con un piso de 0.4km para que el radio de
 * "cerca de" siga siendo útil en polígonos muy pequeños) — más preciso que
 * el RADIO_COLONIA_KM fijo que se usa arriba para Centro, porque aquí sí
 * hay geometría real de la que sacarlo.
 *
 * Centro (Villahermosa) NO está en esta fuente: de los 754 asentamientos
 * que INEGI cataloga para Tabasco, cero son del municipio de Centro — este
 * producto se arma con datos que cada ayuntamiento envía de forma
 * voluntaria, y el de Centro simplemente no participó (al menos no en la
 * versión 2024). Por eso Centro se queda con el catálogo de arriba
 * (verificado uno por uno, mezcla de Nominatim/Google) y todo lo demás usa
 * esto.
 *
 * A propósito NO se agrega a `COLONIAS_COORDS` (arriba) ni al catálogo que
 * se le manda al modelo para resolver typos/apodos (2026-08-11:
 * `busqueda-inteligente` ya vive en el backend nuevo, ver
 * `heuristica-busqueda.util.ts`/`busqueda-inteligente.service.ts`, catálogo
 * cargado desde `ColoniaDescubierta` en Prisma, no desde aquí) —
 * `COLONIAS_COORDS` son ~85 nombres, esto son 753 más, casi todos
 * rancherías/ejidos rurales de baja relevancia para una búsqueda
 * inmobiliaria; meterlos ahí infla cada llamada a la IA sin necesidad. Solo
 * participan en `matchColonia()` (más abajo), que es comparación de texto
 * exacto/alias — cuando alguien escribe el nombre correcto, resuelve a
 * coordenada real igual que cualquier otra colonia catalogada, simplemente
 * no hay respaldo de "typo" con IA para estos 753 en particular.
 */
const COLONIAS_MUNICIPIOS: ColoniaCoord[] = coloniasMunicipiosData;

function todasLasColonias(): ColoniaCoord[] {
  return coloniasDescubiertasCache.length
    ? [...COLONIAS_COORDS, ...COLONIAS_MUNICIPIOS, ...coloniasDescubiertasCache]
    : [...COLONIAS_COORDS, ...COLONIAS_MUNICIPIOS];
}

function distanciaLevenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Busca una colonia por nombre libre (como lo extrae la IA) — undefined si
 * no está catalogada aquí. Match exacto primero; si falla, un fallback de
 * tolerancia a typos por distancia de edición — pero solo si hay UN único
 * candidato dentro del margen, nunca el más cercano entre varios: adivinar
 * mal la colonia (mandar a alguien a la colonia equivocada) es peor que no
 * encontrar nada.
 */
export function matchColonia(nombre: string): ColoniaCoord | undefined {
  const n = normalizarNombreColonia(nombre);
  if (!n) return undefined;

  const exacto = todasLasColonias().find(
    (c) => normalizarNombreColonia(c.label) === n || (c.aliases ?? []).some((a) => normalizarNombreColonia(a) === n)
  );
  if (exacto) return exacto;

  // Margen conservador: 1 typo cada ~8 caracteres, tope de 3 — nombres
  // cortos (ej. "Reforma") casi no toleran error, nombres largos sí.
  const margen = Math.min(3, Math.max(1, Math.floor(n.length / 8)));
  const candidatos = todasLasColonias().filter((c) => {
    const etiquetas = [c.label, ...(c.aliases ?? [])].map(normalizarNombreColonia);
    return etiquetas.some((e) => distanciaLevenshtein(e, n) <= margen);
  });
  return candidatos.length === 1 ? candidatos[0] : undefined;
}

/** Busca por key exacta (ej. desde `?cercaColonia=magisterial` en la URL) — mismo patrón que getLandmark(). */
export function getColoniaByKey(key: string): ColoniaCoord | undefined {
  return todasLasColonias().find((c) => c.key === key);
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Busca cualquier colonia catalogada mencionada literalmente DENTRO de un
 * texto libre (frontera de palabra, sin acentos) — a diferencia de
 * `matchColonia`, que compara un candidato ya extraído contra el catálogo,
 * esta escanea la oración completa. Es la red de seguridad determinística
 * para cuando la IA extrae mal o simplemente omite el campo "colonia" en
 * una búsqueda con varios datos a la vez (falla real, confirmada: 3 de 5
 * intentos idénticos con "cerca de la col magisterial" no devolvieron
 * colonia) — mismo patrón que ya usa el loop de LANDMARKS en la heurística
 * de `busqueda-inteligente` del backend nuevo (2026-08-11:
 * `detectarLandmark` en `heuristica-busqueda.util.ts`), que las colonias no
 * tenían para las 56 agregadas en la ronda de geocodificación completa.
 * Nunca puede inventar una coordenada nueva: solo encuentra lo que ya está
 * verificado en COLONIAS_COORDS.
 */
export function buscarColoniaEnTexto(texto: string): ColoniaCoord | undefined {
  const t = normalizarBase(texto);
  for (const c of todasLasColonias()) {
    const nombres = [c.label, ...(c.aliases ?? [])];
    for (const nombre of nombres) {
      const re = new RegExp(`\\b${escaparRegex(normalizarBase(nombre))}\\b`);
      if (re.test(t)) return c;
    }
  }
  return undefined;
}

/**
 * Desplaza una coordenada real unos metros de forma determinista (mismo id
 * → mismo desplazamiento siempre, para que un mapa no "salte" entre
 * renders). Antes vivía dentro de MapView.tsx como único mecanismo de
 * privacidad del mapa general — se movió aquí porque ahora también lo usa
 * `getPuntoPublico` (abajo) como último recurso cuando no hay centroide de
 * colonia verificado; MapView.tsx la sigue usando, pero solo para separar
 * visualmente pines que ya comparten el mismo punto público (varias
 * propiedades en una colonia se enmascaran al mismo centroide), no como la
 * única protección — esa ahora es `getPuntoPublico`.
 */
export function jitterCoord(id: string, lat: number, lng: number, radiusMeters = 120): [number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const angle = (hash % 360) * (Math.PI / 180);
  const dist  = radiusMeters * (0.3 + ((hash >>> 8) % 70) / 100); // 30%–100% del radio
  const dLat  = (dist * Math.cos(angle)) / 111_320;
  const dLng  = (dist * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}

/**
 * Punto público de una propiedad — el único que debe llegar a un navegador
 * que no sea el del dueño (mapa de búsqueda, ficha de detalle, tarjetas).
 * Nunca es la coordenada exacta:
 *  - Si la colonia está catalogada aquí (o en las colonias descubiertas),
 *    es su centroide verificado — el mismo punto para cualquier propiedad
 *    de esa colonia, así que nunca delata cuál calle o predio es.
 *  - Si no está catalogada, es un desplazamiento amplio (500m) de la
 *    coordenada real vía `jitterCoord` — menos preciso que un centroide
 *    real, pero sigue sin ser el punto exacto.
 * Debe calcularse UNA sola vez, del lado que arma los datos que se le
 * entregan al navegador (`getAllProperties` en api.ts; al publicar/editar
 * en propiedadesLocales.ts/PublishForm.tsx) — nunca al momento de dibujar
 * el mapa, porque para entonces la coordenada real ya viajó al cliente sin
 * necesidad (justo el problema que tenía el mecanismo anterior, que
 * enmascaraba visualmente pero seguía recibiendo `lat`/`lng` reales en las
 * props del mapa).
 *
 * Límite conocido: server-side (build/SSR de `getAllProperties`) solo se
 * compara contra el catálogo estático de este archivo — las colonias
 * descubiertas dinámicamente (`coloniasDescubiertasCache`) solo están
 * disponibles en el navegador tras precargarlas, así que una propiedad en
 * una colonia descubierta-pero-no-estática cae al jitter de 500m en vez de
 * a su centroide real hasta que ese caso se resuelva server-side también.
 */
export function getPuntoPublico(id: string, lat: number, lng: number, colonia: string): { lat: number; lng: number } {
  const match = matchColonia(colonia);
  if (match) return { lat: match.lat, lng: match.lng };
  const [jLat, jLng] = jitterCoord(id, lat, lng, 500);
  return { lat: jLat, lng: jLng };
}

export { distanciaKm };
