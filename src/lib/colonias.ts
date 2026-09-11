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
  // vuelven a geocodificar. `tabasco-2000` confirmada dentro de tolerancia
  // normal (~1.5km vs Nominatim) al reverificar el lote por el bug de
  // 'gaviotas-norte' de abajo — no es el mismo lote el que arrastra el
  // error, son entradas puntuales.
  { key: 'tabasco-2000', label: 'Tabasco 2000', municipio: 'Centro', lat: 17.9994, lng: -92.9316, radioKm: RADIO_COLONIA_KM, aliases: ['T2000'] },
  // Corregida 2026-08-21 — reporte real: pin puesto en el centro visible
  // de la colonia en el mapa marcaba "a 4km de Gaviotas Norte". El valor
  // viejo (18.0141, -92.9312) resultó estar ~3.9km del punto real
  // (confirmado vía Nominatim: "Colonia Gaviotas Norte", único resultado
  // sin sufijo de sector, sin ambigüedad — a diferencia de Gaviotas Sur,
  // ver comentario ahí abajo).
  { key: 'gaviotas-norte', label: 'Gaviotas Norte', municipio: 'Centro', lat: 17.9811, lng: -92.9195, radioKm: RADIO_COLONIA_KM },
  // ⚠️ Verificado 2026-08-21 junto con 'gaviotas-norte' de arriba — este
  // valor (18.0089, -92.9278) también cae ~3.8km del cluster real en
  // Nominatim, mismo tipo de error. A diferencia de Gaviotas Norte, NO hay
  // un "Colonia Gaviotas Sur" sin sufijo en OSM — solo 3 variantes con
  // sector ("Sector El Monal I/II", "Sector San José", lat 17.97-17.98,
  // lng -92.90/-92.92), sin que ninguna sea claramente "la" colonia
  // completa. Se deja el valor viejo sin tocar a propósito — corregirlo a
  // ciegas eligiendo un sector arbitrario sería el mismo tipo de error que
  // esto está arreglando. Necesita la misma verificación de dos fuentes
  // independientes que ya exige el resto de este archivo antes de
  // cambiarse.
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
  // que sí estaba ahí. No se encontró un nodo de OSM etiquetado
  // específicamente place/neighbourhood="Centro Histórico" para usar, así
  // que se ancló a la Catedral (17.9896, -92.9282) como sustituto
  // defendible.
  //
  // Corregida de nuevo 2026-09-10: el usuario verificó a mano en Google
  // Maps un punto sobre Av. Francisco I. Madero (confirmado por
  // reverse-geocode Nominatim como "Centro", Villahermosa — la misma zona)
  // y pidió usarlo en vez de la Catedral. ⚠️ Efecto conocido: la Catedral
  // ya NO es el centroide de esta colonia, así que "cerca de la catedral
  // de tabasco" (el caso real que motivó el fix de 2026-08-06) puede volver
  // a perder precisión — se acepta el trade-off a pedido explícito.
  { key: 'centro-historico', label: 'Centro Histórico', municipio: 'Centro', lat: 17.99154641547893, lng: -92.91686241281937, radioKm: RADIO_COLONIA_KM, aliases: ['Zona Luz'] },
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
  // Alias "Petrolera" — pedido explícito 2026-09-04, reporte real: buscar
  // "colonia petrolera" no encontraba esta colonia. Investigado a fondo: SÍ
  // existe una "Colonia Petrolera" real y distinta en Cárdenas (INEGI, CP
  // 86597, ~2,130 habitantes — ya catalogada en colonias-municipios.json),
  // así que el nombre "Petrolera" está genuinamente compartido por dos
  // lugares reales en municipios distintos, no es un error de datos. Como
  // `todasLasColonias()` concatena `COLONIAS_COORDS` ANTES que
  // `COLONIAS_MUNICIPIOS`, un match sin `municipioHint` resuelve a ESTA
  // entrada (Centro) primero — correcto, coincide con el pedido de que sin
  // municipio explícito el resultado por defecto caiga en Centro. Con
  // `municipioHint: 'Cárdenas'` explícito, `matchColonia` sigue resolviendo
  // bien a la Petrolera real de Cárdenas (rama `exactoEnMunicipio`).
  { key: 'heriberto-kehoe-vicent', label: 'Heriberto Kehoe Vicent', municipio: 'Centro', lat: 18.0091, lng: -92.9412, radioKm: RADIO_COLONIA_KM, aliases: ['Petrolera', 'La Petrolera', 'Colonia Petrolera'] },
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

  // Lote agregado 2026-09-10 — 172 colonias de Centro verificadas a mano
  // por el usuario en Google Maps (coordenada real, no jitter), cruzadas
  // contra el listado oficial de SEPOMEX/Heraldo de Tabasco. Algunas venían
  // como calle/avenida ("Periferico Carlos Pellicer", "Cda Revolución") —
  // el label usa el nombre de la colonia/zona real, no el de la calle; el
  // comentario al final de cada línea conserva el texto original tal como
  // se verificó, por trazabilidad.
  { key: 'agraria', label: 'Agraria', municipio: 'Centro', lat: 17.8323792809621, lng: -92.89048590768462, radioKm: RADIO_COLONIA_KM }, // Agraria
  { key: 'alambrada', label: 'Alambrada', municipio: 'Centro', lat: 18.15985462873963, lng: -92.79072332857668, radioKm: RADIO_COLONIA_KM }, // Alambrada
  { key: 'alfa-y-omega', label: 'Alfa y Omega', municipio: 'Centro', lat: 18.021173753930228, lng: -92.88478906753816, radioKm: RADIO_COLONIA_KM }, // Alfa y Omega
  { key: 'alvarado-guardacosta', label: 'Alvarado Guardacosta', municipio: 'Centro', lat: 17.83768259724057, lng: -92.98936614739193, radioKm: RADIO_COLONIA_KM }, // Alvarado Guardacosta
  { key: 'angeles-ixtacomitan', label: 'Ángeles Ixtacomitan', municipio: 'Centro', lat: 17.95877541666211, lng: -92.97033426245417, radioKm: RADIO_COLONIA_KM }, // Ángeles Ixtacomitan
  { key: 'aniceto', label: 'Aniceto', municipio: 'Centro', lat: 18.15765275886932, lng: -92.78757106728078, radioKm: RADIO_COLONIA_KM }, // Aniceto
  { key: 'aurora', label: 'Aurora', municipio: 'Centro', lat: 17.976835604957472, lng: -92.94775922958841, radioKm: RADIO_COLONIA_KM }, // Fracc. Aurora
  { key: 'benito-juarez', label: 'Benito Juárez', municipio: 'Centro', lat: 18.02282050678436, lng: -92.96675970011177, radioKm: RADIO_COLONIA_KM }, // Benito Juárez
  { key: 'bicentenario', label: 'Bicentenario', municipio: 'Centro', lat: 18.00884120650027, lng: -92.97565598101188, radioKm: RADIO_COLONIA_KM }, // Boulevard Bicentenario
  { key: 'boca-de-aztlan-2da-seccion', label: 'Boca de Aztlán 2da Seccion', municipio: 'Centro', lat: 18.090851764225512, lng: -92.71461390732239, radioKm: RADIO_COLONIA_KM }, // Boca de Aztlán 2da Seccion
  { key: 'bosques-de-araba', label: 'Bosques de Araba', municipio: 'Centro', lat: 17.92635630286076, lng: -93.00080385404746, radioKm: RADIO_COLONIA_KM }, // Bosques de Araba
  { key: 'bugambilias', label: 'Bugambilias', municipio: 'Centro', lat: 18.048221500840214, lng: -92.92527817678064, radioKm: RADIO_COLONIA_KM }, // Fracc Bugambilias
  { key: 'carlos-pellicer', label: 'Carlos Pellicer', municipio: 'Centro', lat: 17.974931125434306, lng: -92.97166020888619, radioKm: RADIO_COLONIA_KM }, // Periferico Carlos Pellicer
  { key: 'carrizal', label: 'Carrizal', municipio: 'Centro', lat: 17.989624602086334, lng: -92.96525392853185, radioKm: RADIO_COLONIA_KM }, // Carrizal
  { key: 'casa-del-arbol', label: 'Casa del Árbol', municipio: 'Centro', lat: 17.924451937953105, lng: -92.9019081573241, radioKm: RADIO_COLONIA_KM }, // Casa del Árbol
  { key: 'casas-para-todos', label: 'Casas Para Todos', municipio: 'Centro', lat: 17.905328922907817, lng: -92.92077558237145, radioKm: RADIO_COLONIA_KM }, // Casas Para Todos (Parrilla 1ra Secc.)
  { key: 'cedros', label: 'Cedros', municipio: 'Centro', lat: 17.94376332273434, lng: -92.94679463445291, radioKm: RADIO_COLONIA_KM }, // Cedros
  { key: 'chacte', label: 'Chacte', municipio: 'Centro', lat: 17.97181066062797, lng: -92.7184573812405, radioKm: RADIO_COLONIA_KM }, // Chacte
  { key: 'chilam-balam', label: 'Chilam Balam', municipio: 'Centro', lat: 17.91817417994389, lng: -92.88872435777807, radioKm: RADIO_COLONIA_KM }, // Fraccc Chilam Balam
  { key: 'ciudad-industrial', label: 'Ciudad Industrial', municipio: 'Centro', lat: 18.030861629759336, lng: -92.90858969177333, radioKm: RADIO_COLONIA_KM }, // Ciudad Industrial
  { key: 'club-de-lago', label: 'Club de Lago', municipio: 'Centro', lat: 18.00457905316006, lng: -92.94539492326895, radioKm: RADIO_COLONIA_KM }, // Fracc Club de Lago
  { key: 'colinas-de-santo-domingo', label: 'Colinas de Santo Domingo', municipio: 'Centro', lat: 18.119101626095333, lng: -92.86472198755979, radioKm: RADIO_COLONIA_KM }, // Colinas de Santo Domingo
  { key: 'constitucion', label: 'Constitución', municipio: 'Centro', lat: 18.07234475074817, lng: -92.87217329867791, radioKm: RADIO_COLONIA_KM }, // Constitución
  { key: 'eden-premier', label: 'Edén Premier', municipio: 'Centro', lat: 17.954214546869686, lng: -92.9602476225357, radioKm: RADIO_COLONIA_KM }, // Edén Premier
  { key: 'rio-viejo-1a-secc', label: 'Rio Viejo 1a Secc', municipio: 'Centro', lat: 17.940446801929877, lng: -92.98378076578402, radioKm: RADIO_COLONIA_KM }, // Rio Viejo 1a Secc
  { key: 'el-almendro', label: 'El Almendro', municipio: 'Centro', lat: 17.95162759488834, lng: -92.98637577278049, radioKm: RADIO_COLONIA_KM }, // El Almendro
  { key: 'el-amate', label: 'El Amate', municipio: 'Centro', lat: 18.049372703094278, lng: -92.92689802095792, radioKm: RADIO_COLONIA_KM }, // El Amate
  { key: 'jose-maria-pino-suarez-zona-norte', label: 'José María Pino Suárez (zona norte)', municipio: 'Centro', lat: 18.018742458422263, lng: -92.93452761910213, radioKm: RADIO_COLONIA_KM }, // Jose Maria Pino Suarez
  { key: 'el-cedro', label: 'El Cedro', municipio: 'Centro', lat: 18.03028056018996, lng: -92.9450218037573, radioKm: RADIO_COLONIA_KM }, // El Cedro
  { key: 'el-censo', label: 'El Censo', municipio: 'Centro', lat: 17.878227368267886, lng: -92.8677864654194, radioKm: RADIO_COLONIA_KM }, // El Censo
  { key: 'el-country', label: 'El Country', municipio: 'Centro', lat: 18.019411392827507, lng: -92.99333091104322, radioKm: RADIO_COLONIA_KM }, // Residencial El Country
  { key: 'el-eden', label: 'El Edén', municipio: 'Centro', lat: 17.9643462815521, lng: -92.97478175164271, radioKm: RADIO_COLONIA_KM }, // El Edén
  { key: 'el-encanto', label: 'El Encanto', municipio: 'Centro', lat: 17.9953076511033, lng: -92.91793101911038, radioKm: RADIO_COLONIA_KM }, // El Encanto (Centro)
  { key: 'el-espejo-1', label: 'El Espejo 1', municipio: 'Centro', lat: 17.99080835553127, lng: -92.95703659156726, radioKm: RADIO_COLONIA_KM }, // El Espejo 1
  { key: 'el-espejo-2', label: 'El Espejo 2', municipio: 'Centro', lat: 17.996923497013956, lng: -92.95645965949272, radioKm: RADIO_COLONIA_KM }, // El Espejo 2
  { key: 'el-espino', label: 'El Espino', municipio: 'Centro', lat: 18.247564932246615, lng: -92.83268533677183, radioKm: RADIO_COLONIA_KM }, // El Espino
  { key: 'el-manguito', label: 'El Manguito', municipio: 'Centro', lat: 17.92514214609746, lng: -92.99900850818412, radioKm: RADIO_COLONIA_KM }, // El Manguito (Ixtacomitan 2a Secc)
  { key: 'el-manzano', label: 'El Manzano', municipio: 'Centro', lat: 17.85776827591009, lng: -92.90687591657124, radioKm: RADIO_COLONIA_KM }, // El Manzano
  { key: 'encrucijada', label: 'Encrucijada', municipio: 'Centro', lat: 17.92683167657752, lng: -92.47835635585335, radioKm: RADIO_COLONIA_KM }, // Encrucijada
  { key: 'espinoza-galindo', label: 'Espinoza Galindo', municipio: 'Centro', lat: 17.923139564769606, lng: -92.91198210192132, radioKm: RADIO_COLONIA_KM }, // Espinoza Galindo
  { key: 'flamingos', label: 'Flamingos', municipio: 'Centro', lat: 18.001956262414705, lng: -92.95246201651351, radioKm: RADIO_COLONIA_KM }, // Flamingos
  { key: 'fovissste-parrilla', label: 'Fovissste Parrilla', municipio: 'Centro', lat: 17.929747473520013, lng: -92.91211624517696, radioKm: RADIO_COLONIA_KM }, // Fovissste Parrilla
  { key: 'golondrinas', label: 'Golondrinas', municipio: 'Centro', lat: 17.975768765184405, lng: -92.92668149027521, radioKm: RADIO_COLONIA_KM }, // Golondrinas (Guayabal)
  { key: 'gracias-mexico', label: 'Gracias México', municipio: 'Centro', lat: 17.85055905452638, lng: -92.92412379166187, radioKm: RADIO_COLONIA_KM }, // Fracc Gracias México
  { key: 'hacienda-buena-vista', label: 'Hacienda Buena Vista', municipio: 'Centro', lat: 17.949749542662197, lng: -93.02045180122282, radioKm: RADIO_COLONIA_KM }, // Fracc Hacienda Buena Vista
  { key: 'hacienda-casa-blanca', label: 'Hacienda Casa Blanca', municipio: 'Centro', lat: 18.007614631926806, lng: -92.96930452715598, radioKm: RADIO_COLONIA_KM }, // Fracc Hacienda Casa Blanca
  { key: 'hacienda-esmeralda', label: 'Hacienda Esmeralda', municipio: 'Centro', lat: 17.945665664226315, lng: -92.97452474545015, radioKm: RADIO_COLONIA_KM }, // Hacienda Esmeralda
  { key: 'huapinol', label: 'Huapinol', municipio: 'Centro', lat: 17.92273655896449, lng: -92.9102706883557, radioKm: RADIO_COLONIA_KM }, // Huapinol (Guapinol)
  { key: 'hueso-de-puerco', label: 'Hueso de Puerco', municipio: 'Centro', lat: 17.788679685148022, lng: -92.89645116513857, radioKm: RADIO_COLONIA_KM }, // Hueso de Puerco
  { key: 'indeco-unidad', label: 'Indeco Unidad', municipio: 'Centro', lat: 18.01977847686832, lng: -92.89967973328112, radioKm: RADIO_COLONIA_KM }, // Indeco Unidad (Progresivo ciudad industrial)
  { key: 'infonavit-parrilla', label: 'Infonavit Parrilla', municipio: 'Centro', lat: 17.91033631353764, lng: -92.91539598136548, radioKm: RADIO_COLONIA_KM }, // Infonavit Parrilla
  { key: 'invitab', label: 'Invitab', municipio: 'Centro', lat: 18.00636833636063, lng: -92.9464166123292, radioKm: RADIO_COLONIA_KM }, // Invitab
  { key: 'jardines-de-buenavista', label: 'Jardines de Buenavista', municipio: 'Centro', lat: 17.962736542302583, lng: -93.00235790150087, radioKm: RADIO_COLONIA_KM }, // Fracc Jardines de Buenavista
  { key: 'jardines-de-huapinol', label: 'Jardines de Huapinol', municipio: 'Centro', lat: 17.926351030967258, lng: -92.90136110987012, radioKm: RADIO_COLONIA_KM }, // Fracc Jardines de Huapinol
  { key: 'j-a-sibilla-zurita', label: 'J A Sibilla Zurita', municipio: 'Centro', lat: 17.95972984911851, lng: -93.02095039067409, radioKm: RADIO_COLONIA_KM }, // J A Sibilla Zurita
  { key: 'jolochero', label: 'Jolochero', municipio: 'Centro', lat: 18.13777182472216, lng: -92.7833905407074, radioKm: RADIO_COLONIA_KM }, // Jolochero (Boca de Culebra)
  { key: 'jornaleros-y-aparceros-del-maluco', label: 'Jornaleros y Aparceros Del Maluco', municipio: 'Centro', lat: 18.027667789779635, lng: -92.96928963914458, radioKm: RADIO_COLONIA_KM }, // Jornaleros y Aparceros Del Maluco
  { key: 'joyas-de-buena-vista', label: 'Joyas de Buena Vista', municipio: 'Centro', lat: 17.92557866610232, lng: -93.04946104784179, radioKm: RADIO_COLONIA_KM }, // Fracc Joyas de Buena Vista
  { key: 'la-ceiba', label: 'La Ceiba', municipio: 'Centro', lat: 18.144880887459575, lng: -92.77546705630077, radioKm: RADIO_COLONIA_KM }, // La Ceiba
  { key: 'la-cruz-del-bajio', label: 'La Cruz del Bajío', municipio: 'Centro', lat: 17.970948027299155, lng: -92.78782497745446, radioKm: RADIO_COLONIA_KM }, // La Cruz del Bajío
  { key: 'lagartera-1a-secc', label: 'Lagartera 1a Secc', municipio: 'Centro', lat: 18.062591732420003, lng: -92.88532599969379, radioKm: RADIO_COLONIA_KM }, // Lagartera 1a Secc
  { key: 'la-gloria', label: 'La Gloria', municipio: 'Centro', lat: 17.985327377083937, lng: -93.01594336054097, radioKm: RADIO_COLONIA_KM }, // La Gloria
  { key: 'lago-ilusiones', label: 'Lago Ilusiones', municipio: 'Centro', lat: 18.000012443180484, lng: -92.93417833270273, radioKm: RADIO_COLONIA_KM }, // Lago Ilusiones
  { key: 'la-gran-villa', label: 'La Gran Villa', municipio: 'Centro', lat: 18.002897335867686, lng: -92.945304947268, radioKm: RADIO_COLONIA_KM }, // La Gran Villa
  { key: 'la-huerta-residencial', label: 'La Huerta Residencial', municipio: 'Centro', lat: 18.074481656724917, lng: -92.8755496257859, radioKm: RADIO_COLONIA_KM }, // Fracc La Huerta Residencial
  { key: 'la-joya', label: 'La Joya', municipio: 'Centro', lat: 17.999948476492026, lng: -92.95638447437703, radioKm: RADIO_COLONIA_KM }, // La Joya (El Espejo II)
  { key: 'la-lima', label: 'La Lima', municipio: 'Centro', lat: 17.90897391518166, lng: -92.93091746506826, radioKm: RADIO_COLONIA_KM }, // La Lima
  { key: 'la-loma', label: 'La Loma', municipio: 'Centro', lat: 18.170265259790995, lng: -92.80371750531461, radioKm: RADIO_COLONIA_KM }, // La Loma
  { key: 'la-majahua', label: 'La Majahua', municipio: 'Centro', lat: 17.968428235449093, lng: -92.84614880822771, radioKm: RADIO_COLONIA_KM }, // Puente La Majahua
  { key: 'la-palma', label: 'La Palma', municipio: 'Centro', lat: 17.985659978876527, lng: -92.80260710007227, radioKm: RADIO_COLONIA_KM }, // La Palma (pajonal)
  { key: 'la-pigua', label: 'La Pigua', municipio: 'Centro', lat: 18.02504461494626, lng: -92.96593079766748, radioKm: RADIO_COLONIA_KM }, // La Pigua
  { key: 'privada-giraldas', label: 'Privada Giraldas', municipio: 'Centro', lat: 18.013568773183657, lng: -92.94602039871035, radioKm: RADIO_COLONIA_KM }, // Privada Giraldas
  { key: 'las-lomas', label: 'Las Lomas', municipio: 'Centro', lat: 17.949917888895587, lng: -92.98136927031312, radioKm: RADIO_COLONIA_KM }, // Fracc Las Lomas
  { key: 'las-margaritas', label: 'Las Margaritas', municipio: 'Centro', lat: 17.900962467884877, lng: -92.92450349437043, radioKm: RADIO_COLONIA_KM }, // Las Margaritas
  { key: 'las-mercedes', label: 'Las Mercedes', municipio: 'Centro', lat: 17.863876398426996, lng: -92.9283261255928, radioKm: RADIO_COLONIA_KM }, // Las Mercedes
  { key: 'las-raices', label: 'Las Raíces', municipio: 'Centro', lat: 17.984937906535276, lng: -92.91211877429814, radioKm: RADIO_COLONIA_KM }, // Las Raíces
  { key: 'las-rosas', label: 'Las Rosas', municipio: 'Centro', lat: 17.958301619679748, lng: -92.99954648144569, radioKm: RADIO_COLONIA_KM }, // Las Rosas
  { key: 'las-torres', label: 'Las Torres', municipio: 'Centro', lat: 18.020086418177822, lng: -92.91967997734857, radioKm: RADIO_COLONIA_KM }, // Las Torres (jose maria pino suarez)
  { key: 'la-venta', label: 'La Venta', municipio: 'Centro', lat: 18.002221925631083, lng: -92.94807791583878, radioKm: RADIO_COLONIA_KM }, // La Venta
  { key: 'la-vuelta', label: 'La Vuelta', municipio: 'Centro', lat: 18.010044444966542, lng: -92.66896836238978, radioKm: RADIO_COLONIA_KM }, // La Vuelta (laguna)
  { key: 'lidia-esther-monica-de-portilla', label: 'Lidia Esther Mónica de Portilla', municipio: 'Centro', lat: 17.996039231900397, lng: -92.92896344621839, radioKm: RADIO_COLONIA_KM }, // Lidia Esther Mónica de Portilla
  { key: 'logistico-industrial-tabasco', label: 'Logístico Industrial Tabasco', municipio: 'Centro', lat: 17.99349161675486, lng: -92.9834535522789, radioKm: RADIO_COLONIA_KM }, // Logístico Industrial Tabasco
  { key: 'loma-bonita', label: 'Loma Bonita', municipio: 'Centro', lat: 17.952705631832455, lng: -93.03368878657905, radioKm: RADIO_COLONIA_KM }, // Loma Bonita
  { key: 'loma-real', label: 'Loma Real', municipio: 'Centro', lat: 17.9507997882762, lng: -93.0348645056174, radioKm: RADIO_COLONIA_KM }, // Loma Real
  { key: 'lomas-de-bella-vista', label: 'Lomas de Bella Vista', municipio: 'Centro', lat: 17.95150520725049, lng: -93.03380245219891, radioKm: RADIO_COLONIA_KM }, // Lomas de Bella Vista
  { key: 'lomas-de-ocuiltzapotlan', label: 'Lomas de Ocuiltzapotlan', municipio: 'Centro', lat: 18.12652463231998, lng: -92.8650807270576, radioKm: RADIO_COLONIA_KM }, // Fracc Lomas de Ocuiltzapotlan
  { key: 'los-alamos', label: 'Los Álamos', municipio: 'Centro', lat: 17.988932810569462, lng: -92.95247576748457, radioKm: RADIO_COLONIA_KM }, // Conjunto habitacional Los Álamos
  { key: 'los-angeles', label: 'Los Ángeles', municipio: 'Centro', lat: 18.13145956501844, lng: -92.86775029720782, radioKm: RADIO_COLONIA_KM }, // Los Ángeles (Ocuitzapotlan)
  { key: 'las-huertas', label: 'Las Huertas', municipio: 'Centro', lat: 17.950770568555427, lng: -92.9784935865791, radioKm: RADIO_COLONIA_KM }, // Fracc Las Huertas
  { key: 'los-mezquites', label: 'Los Mezquites', municipio: 'Centro', lat: 17.95973857394754, lng: -92.96876670007259, radioKm: RADIO_COLONIA_KM }, // Cda Los Mezquites
  { key: 'los-pinos', label: 'Los Pinos', municipio: 'Centro', lat: 17.943889500469236, lng: -92.97439509369838, radioKm: RADIO_COLONIA_KM }, // Los Pinos
  { key: 'los-rios', label: 'Los Ríos', municipio: 'Centro', lat: 18.000697498902056, lng: -92.94622208083622, radioKm: RADIO_COLONIA_KM }, // Los Ríos
  { key: 'luis-gil-perez', label: 'Luis Gil Perez', municipio: 'Centro', lat: 17.874311644855265, lng: -93.07374946679658, radioKm: RADIO_COLONIA_KM }, // Luis Gil Perez
  { key: 'macuili', label: 'Macuili', municipio: 'Centro', lat: 18.00650076363893, lng: -93.00779084554154, radioKm: RADIO_COLONIA_KM }, // Macuili (Anacleto Canabal 3a Secc)
  { key: 'macultepec', label: 'Macultepec', municipio: 'Centro', lat: 18.149767436313336, lng: -92.85934834959383, radioKm: RADIO_COLONIA_KM }, // Macultepec
  { key: 'manuel-andrade-diaz', label: 'Manuel Andrade Díaz', municipio: 'Centro', lat: 17.95979019613748, lng: -92.99823541558767, radioKm: RADIO_COLONIA_KM }, // Manuel Andrade Díaz
  { key: 'mayito', label: 'Mayito', municipio: 'Centro', lat: 17.985457523647785, lng: -92.92654600376865, radioKm: RADIO_COLONIA_KM }, // Mayito
  { key: 'monteceibas', label: 'Monteceibas', municipio: 'Centro', lat: 17.87533237181988, lng: -92.89750499818643, radioKm: RADIO_COLONIA_KM }, // Fracc Monteceibas
  { key: 'nueva-invitab', label: 'Nueva Invitab', municipio: 'Centro', lat: 18.006260501332193, lng: -92.94628877582934, radioKm: RADIO_COLONIA_KM }, // Nueva Invitab
  { key: 'nueva-pensiones', label: 'Nueva Pensiones', municipio: 'Centro', lat: 17.971825135701728, lng: -92.96453893103339, radioKm: RADIO_COLONIA_KM }, // Nueva Pensiones
  { key: 'ocuiltzapotlan', label: 'Ocuiltzapotlan', municipio: 'Centro', lat: 18.135642222746114, lng: -92.86495481113023, radioKm: RADIO_COLONIA_KM }, // Ocuiltzapotlan
  { key: 'olimpo', label: 'Olimpo', municipio: 'Centro', lat: 17.96601833265473, lng: -92.98059392926127, radioKm: RADIO_COLONIA_KM }, // Fracc Olimpo
  { key: 'pablo-l-sidar', label: 'Pablo L Sidar', municipio: 'Centro', lat: 17.910515260611835, lng: -93.03131021198759, radioKm: RADIO_COLONIA_KM }, // Pablo L Sidar
  { key: 'pajonal', label: 'Pajonal', municipio: 'Centro', lat: 17.994596682930755, lng: -92.79666166761731, radioKm: RADIO_COLONIA_KM }, // Pajonal
  { key: 'palma-real', label: 'Palma Real', municipio: 'Centro', lat: 17.966673767934292, lng: -92.90898326328805, radioKm: RADIO_COLONIA_KM }, // Palma Real
  { key: 'palmeiras', label: 'Palmeiras', municipio: 'Centro', lat: 17.963332905988185, lng: -92.9198465614399, radioKm: RADIO_COLONIA_KM }, // Residencial Palmeiras
  { key: 'parque-tabasco', label: 'Parque Tabasco', municipio: 'Centro', lat: 18.007021855229464, lng: -92.96330543871834, radioKm: RADIO_COLONIA_KM }, // Parque Tabasco
  { key: 'paseo-las-palmas', label: 'Paseo las Palmas', municipio: 'Centro', lat: 17.962597053004597, lng: -92.91754303317458, radioKm: RADIO_COLONIA_KM }, // Av Paseo las Palmas
  { key: 'paseos-del-usumacinta', label: 'Paseos Del Usumacinta', municipio: 'Centro', lat: 17.988758392683952, lng: -92.9416427032127, radioKm: RADIO_COLONIA_KM }, // Prol Paseos Del Usumacinta
  { key: 'paso-real', label: 'Paso Real', municipio: 'Centro', lat: 18.13799055765255, lng: -92.87724883449563, radioKm: RADIO_COLONIA_KM }, // Paso Real
  { key: 'paso-real-de-la-victoria', label: 'Paso Real de La Victoria', municipio: 'Centro', lat: 18.138128300612983, lng: -92.87969515623081, radioKm: RADIO_COLONIA_KM }, // Paso Real de La Victoria
  { key: 'periodista', label: 'Periodista', municipio: 'Centro', lat: 17.974211798600855, lng: -92.93272417080821, radioKm: RADIO_COLONIA_KM }, // Calle del Periodista
  { key: 'pino-suarez-centro', label: 'Pino Suárez (Centro)', municipio: 'Centro', lat: 17.98990245642267, lng: -92.9155950601473, radioKm: RADIO_COLONIA_KM }, // Pino Suárez (Centro)
  { key: 'playas-del-rosario', label: 'Playas Del Rosario', municipio: 'Centro', lat: 18.150978144730534, lng: -92.86306216096116, radioKm: RADIO_COLONIA_KM }, // Playas Del Rosario
  { key: 'plaza-jardin', label: 'Plaza Jardín', municipio: 'Centro', lat: 17.96477646587936, lng: -92.94895391407256, radioKm: RADIO_COLONIA_KM }, // Plaza Jardín
  { key: 'plaza-villahermosa', label: 'Plaza Villahermosa', municipio: 'Centro', lat: 17.96354050889884, lng: -92.9455200545573, radioKm: RADIO_COLONIA_KM }, // Plaza Villahermosa
  { key: 'popular-manuel-silva', label: 'Popular Manuel Silva', municipio: 'Centro', lat: 17.922259107174508, lng: -92.90673833660145, radioKm: RADIO_COLONIA_KM }, // Popular Manuel Silva
  { key: 'popular-pedro-c-colorado', label: 'Popular Pedro C Colorado', municipio: 'Centro', lat: 17.986275559991096, lng: -92.92263811171759, radioKm: RADIO_COLONIA_KM }, // Popular Pedro C Colorado
  { key: 'portal-del-agua', label: 'Portal Del Agua', municipio: 'Centro', lat: 17.996584149846814, lng: -92.92512641541393, radioKm: RADIO_COLONIA_KM }, // Portal Del Agua
  { key: 'privada-de-lagunas-del-maurel', label: 'Privada de Lagunas del Maurel', municipio: 'Centro', lat: 18.039017808755176, lng: -92.89599754843455, radioKm: RADIO_COLONIA_KM }, // Privada de Lagunas del Maurel
  { key: 'proclama', label: 'Proclama', municipio: 'Centro', lat: 17.931786458516502, lng: -92.9978579083924, radioKm: RADIO_COLONIA_KM }, // Proclama
  { key: 'pueblo-nuevo-de-las-raices', label: 'Pueblo Nuevo de las Raíces', municipio: 'Centro', lat: 17.845285336606477, lng: -92.87696925826492, radioKm: RADIO_COLONIA_KM }, // Pueblo Nuevo de las Raíces
  { key: 'puerta-de-hierro', label: 'Puerta de Hierro', municipio: 'Centro', lat: 18.011639413577047, lng: -92.98950500192011, radioKm: RADIO_COLONIA_KM }, // Fracc Puerta de Hierro
  { key: 'puerta-grande', label: 'Puerta Grande', municipio: 'Centro', lat: 18.010445652036765, lng: -92.99012727437687, radioKm: RADIO_COLONIA_KM }, // Fracc Puerta Grande
  { key: 'real-diamante', label: 'Real Diamante', municipio: 'Centro', lat: 18.145686109690505, lng: -92.86850493445966, radioKm: RADIO_COLONIA_KM }, // Real Diamante
  { key: 'real-del-angel', label: 'Real Del Ángel', municipio: 'Centro', lat: 17.962608495700994, lng: -92.95932416553481, radioKm: RADIO_COLONIA_KM }, // Real Del Ángel
  { key: 'real-del-valle', label: 'Real del Valle', municipio: 'Centro', lat: 17.960776459211353, lng: -92.98759831514938, radioKm: RADIO_COLONIA_KM }, // Fracc Real del Valle
  { key: 'real-de-sabina', label: 'Real de Sabina', municipio: 'Centro', lat: 17.95664408911885, lng: -92.95020970192081, radioKm: RADIO_COLONIA_KM }, // Real de Sabina
  { key: 'real-de-san-jorge', label: 'Real de San Jorge', municipio: 'Centro', lat: 17.962383595309355, lng: -92.96133395589518, radioKm: RADIO_COLONIA_KM }, // Real de San Jorge
  { key: 'real-de-tabasco', label: 'Real de Tabasco', municipio: 'Centro', lat: 18.003244076755692, lng: -92.94597570905083, radioKm: RADIO_COLONIA_KM }, // Real de Tabasco
  { key: 'real-hidalgo', label: 'Real Hidalgo', municipio: 'Centro', lat: 17.979713981185355, lng: -92.97453500376876, radioKm: RADIO_COLONIA_KM }, // Fracc Real Hidalgo
  { key: 'reforma', label: 'Reforma', municipio: 'Centro', lat: 17.98242456720471, lng: -92.92931797054057, radioKm: RADIO_COLONIA_KM }, // Reforma
  { key: 'residencial-esmeralda', label: 'Residencial Esmeralda', municipio: 'Centro', lat: 17.969568112008815, lng: -92.91903496551083, radioKm: RADIO_COLONIA_KM }, // Residencial Esmeralda
  { key: 'las-puertas', label: 'Las Puertas', municipio: 'Centro', lat: 18.012356984429346, lng: -92.99016726670595, radioKm: RADIO_COLONIA_KM }, // Residencial las Puertas
  { key: 'puerta-real', label: 'Puerta Real', municipio: 'Centro', lat: 18.012708245988154, lng: -92.98733419027471, radioKm: RADIO_COLONIA_KM }, // Residencial Puerta Real
  { key: 'villas-del-sol', label: 'Villas del Sol', municipio: 'Centro', lat: 17.994665063882127, lng: -92.95131865774302, radioKm: RADIO_COLONIA_KM }, // Residencial Villas del Sol
  { key: 'revolucion', label: 'Revolución', municipio: 'Centro', lat: 17.981793878778994, lng: -92.95795220192045, radioKm: RADIO_COLONIA_KM }, // Cda Revolución
  { key: 'samarkanda', label: 'Samarkanda', municipio: 'Centro', lat: 18.043922819202475, lng: -92.91073142068306, radioKm: RADIO_COLONIA_KM }, // Samarkanda
  { key: 'san-angel', label: 'San Ángel', municipio: 'Centro', lat: 18.018399482563378, lng: -92.89831037897594, radioKm: RADIO_COLONIA_KM }, // Fracc San Ángel
  { key: 'sol-campestre', label: 'Sol Campestre', municipio: 'Centro', lat: 18.01665003563684, lng: -92.98737132890727, radioKm: RADIO_COLONIA_KM }, // Fracc Sol Campestre
  { key: 'subteniente-garcia', label: 'Subteniente Garcia', municipio: 'Centro', lat: 17.856133859404714, lng: -92.9306263888084, radioKm: RADIO_COLONIA_KM }, // Subteniente Garcia
  { key: 'tamulte-de-las-barrancas', label: 'Tamulte de las Barrancas', municipio: 'Centro', lat: 17.96952736498271, lng: -92.96072019694901, radioKm: RADIO_COLONIA_KM }, // Tamulte de las Barrancas
  { key: 'tamulte-de-las-sabanas-real', label: 'Tamulte de las Sabanas Real', municipio: 'Centro', lat: 18.15805048272921, lng: -92.78401055474882, radioKm: RADIO_COLONIA_KM }, // Tamulte de las Sabanas Real
  { key: 'tercer-milenio', label: 'Tercer Milenio', municipio: 'Centro', lat: 18.142488996983346, lng: -92.87018239912281, radioKm: RADIO_COLONIA_KM }, // Tercer Milenio
  { key: 'tocoal', label: 'Tocoal', municipio: 'Centro', lat: 18.155447409405912, lng: -92.7849452472185, radioKm: RADIO_COLONIA_KM }, // Tocoal
  { key: 'triangulo-industrial', label: 'Triangulo Industrial', municipio: 'Centro', lat: 18.01865295651364, lng: -92.89595542606952, radioKm: RADIO_COLONIA_KM }, // Triangulo Industrial
  { key: 'tumbulushal', label: 'Tumbulushal', municipio: 'Centro', lat: 17.821060092032255, lng: -92.93155690506305, radioKm: RADIO_COLONIA_KM }, // Tumbulushal
  { key: 'union-hace-la-fuerza', label: 'Unión Hace La Fuerza', municipio: 'Centro', lat: 17.925989973002764, lng: -92.90793533337109, radioKm: RADIO_COLONIA_KM }, // Unión Hace La Fuerza
  { key: 'villa-floresta', label: 'Villa Floresta', municipio: 'Centro', lat: 17.902517158425475, lng: -92.92031077397054, radioKm: RADIO_COLONIA_KM }, // Villa Floresta
  { key: 'villa-las-torres', label: 'Villa las Torres', municipio: 'Centro', lat: 17.964773138641593, lng: -92.99513884008131, radioKm: RADIO_COLONIA_KM }, // Fracc Villa las Torres
  { key: 'villa-los-claustros', label: 'Villa los Claustros', municipio: 'Centro', lat: 17.87478067915452, lng: -92.92077635489133, radioKm: RADIO_COLONIA_KM }, // Villa los Claustros
  { key: 'villa-parrilla', label: 'Villa Parrilla', municipio: 'Centro', lat: 18.150815025333518, lng: -92.86434962121656, radioKm: RADIO_COLONIA_KM }, // Villa Parrilla
  { key: 'villa-union', label: 'Villa Unión', municipio: 'Centro', lat: 18.10157729967323, lng: -92.86620086632169, radioKm: RADIO_COLONIA_KM }, // Villa Unión
  { key: '27-de-octubre', label: '27 de Octubre', municipio: 'Centro', lat: 17.85130434716627, lng: -92.92489580977751, radioKm: RADIO_COLONIA_KM }, // 27 de Octubre (Playas del rosario)
  { key: '2-montes', label: '2 Montes', municipio: 'Centro', lat: 17.986577990167955, lng: -92.82877008566028, radioKm: RADIO_COLONIA_KM }, // 2 Montes
  { key: 'acachapan-y-colmena-2a', label: 'Acachapan y Colmena 2a', municipio: 'Centro', lat: 18.0655797558823, lng: -92.80838766038335, radioKm: RADIO_COLONIA_KM }, // Acachapan y Colmena 2a (El Maluco)
  { key: 'barranca-y-guanal-seccion', label: 'Barranca y Guanal Sección', municipio: 'Centro', lat: 18.01570386229353, lng: -92.80822424002746, radioKm: RADIO_COLONIA_KM }, // Barranca y Guanal Sección (López Portillo)
  { key: 'coronel-traconis-2a', label: 'Coronel Traconis 2a', municipio: 'Centro', lat: 17.943376288856253, lng: -92.80197895758863, radioKm: RADIO_COLONIA_KM }, // Coronel Traconis 2a (El Zapote)
  { key: 'coronel-traconis-3a', label: 'Coronel Traconis 3a', municipio: 'Centro', lat: 17.943376288856253, lng: -92.80197895758863, radioKm: RADIO_COLONIA_KM }, // Coronel Traconis 3a (Guerrero)
  { key: 'coronel-traconis-4a', label: 'Coronel Traconis 4a', municipio: 'Centro', lat: 17.943376288856253, lng: -92.80197895758863, radioKm: RADIO_COLONIA_KM }, // Coronel Traconis 4a (San Francisco)
  { key: 'coronel-traconis-5a', label: 'Coronel Traconis 5a', municipio: 'Centro', lat: 17.943376288856253, lng: -92.80197895758863, radioKm: RADIO_COLONIA_KM }, // Coronel Traconis 5a (San Rafael y San Diego)
  { key: 'ismate-y-chilpilla-1a', label: 'Ismate y Chilpilla 1a', municipio: 'Centro', lat: 17.965185718171355, lng: -92.64071875162514, radioKm: RADIO_COLONIA_KM }, // Ismate y Chilpilla 1a (San Antonio)
  { key: 'isset', label: 'Isset', municipio: 'Centro', lat: 17.990301590005533, lng: -92.92156864336371, radioKm: RADIO_COLONIA_KM }, // Isset
  { key: 'miraflores-1a', label: 'Miraflores 1a', municipio: 'Centro', lat: 17.91721255239231, lng: -92.77860674432856, radioKm: RADIO_COLONIA_KM }, // Miraflores 1a (Arroyo Grande)
  { key: 'plutarco-elias-calles-3a', label: 'Plutarco Elias Calles 3a', municipio: 'Centro', lat: 17.95340093436296, lng: -92.91478767720407, radioKm: RADIO_COLONIA_KM }, // Plutarco Elias Calles 3a (La Providencia)
  { key: 'plutarco-elias-calles-cura-hueso', label: 'Plutarco Elias Calles Cura Hueso', municipio: 'Centro', lat: 17.962160448082123, lng: -92.91983503736536, radioKm: RADIO_COLONIA_KM }, // Plutarco Elias Calles Cura Hueso
  { key: 'plutarco-elias-calles', label: 'Plutarco Elías Calles', municipio: 'Centro', lat: 17.955805355912165, lng: -92.91611509772886, radioKm: RADIO_COLONIA_KM }, // Plutarco Elías Calles (La Majahua)
  { key: 'buena-vista', label: 'Buena Vista', municipio: 'Centro', lat: 18.145649431554276, lng: -92.74904905836635, radioKm: RADIO_COLONIA_KM }, // Buena Vista
  { key: 'el-zapotal-1a-secc', label: 'El Zapotal 1a Secc', municipio: 'Centro', lat: 18.082065644657323, lng: -92.86347142668707, radioKm: RADIO_COLONIA_KM }, // El Zapotal 1a Secc
  { key: 'platano-y-cacao-1a-secc', label: 'Plátano y Cacao 1a Secc', municipio: 'Centro', lat: 17.97743620776993, lng: -93.1495856789774, radioKm: RADIO_COLONIA_KM }, // Plátano y Cacao 1a Secc
  { key: 'jose-maria-pino-suarez-1a-seccion', label: 'José María Pino Suárez (1a Sección)', municipio: 'Centro', lat: 18.351581997457185, lng: -93.38224852975947, radioKm: RADIO_COLONIA_KM }, // Jose Maria Pino Suarez 1a Secc
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
// Devuelve la promesa (antes era `void`) — mismo motivo que
// precargarLandmarks() en landmarks.ts: quien necesite reaccionar cuando
// termine puede engancharse; los fire-and-forget existentes no cambian.
export function precargarColoniasDescubiertas(): Promise<void> {
  if (cargaIniciada || typeof window === 'undefined') return Promise.resolve();
  cargaIniciada = true;
  return backendFetch<ColoniaDescubiertaBackend[]>('/colonias/descubiertas')
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

function nombreColoniaCoincide(c: ColoniaCoord, n: string): boolean {
  return normalizarNombreColonia(c.label) === n || (c.aliases ?? []).some((a) => normalizarNombreColonia(a) === n);
}

/**
 * Busca una colonia por nombre libre (como lo extrae la IA) — undefined si
 * no está catalogada aquí. Match exacto primero; si falla, un fallback de
 * tolerancia a typos por distancia de edición — pero solo si hay UN único
 * candidato dentro del margen, nunca el más cercano entre varios: adivinar
 * mal la colonia (mandar a alguien a la colonia equivocada) es peor que no
 * encontrar nada.
 *
 * `municipioHint` — bug real encontrado 2026-08-23 escribiendo pruebas: 85
 * nombres de colonia existen en más de un municipio a la vez (ej.
 * "Magisterial" es un lugar real distinto en Centro, Cunduacán,
 * Huimanguillo, Macuspana, Paraíso y Tenosique). Sin esta pista, un match
 * exacto siempre resolvía al PRIMERO del arreglo combinado (casi siempre el
 * de Centro/Villahermosa, porque `COLONIAS_COORDS` va primero), en
 * silencio, sin importar el municipio real que la persona quiso decir — y
 * el fallback de typos ni siquiera resolvía nada (varios candidatos
 * homónimos rompían la regla de "solo si hay un único candidato"). Quien
 * llama debe pasar el municipio si ya lo tiene (extraído por la IA, o un
 * campo del formulario/filtro) — sigue siendo opcional y compatible con
 * quien no lo tenga, solo que sin la pista el resultado es el mismo de
 * siempre (ambiguo, gana el primero del arreglo).
 */
export function matchColonia(nombre: string, municipioHint?: string): ColoniaCoord | undefined {
  const n = normalizarNombreColonia(nombre);
  if (!n) return undefined;
  const municipioNorm = municipioHint ? normalizarBase(municipioHint) : undefined;

  if (municipioNorm) {
    const exactoEnMunicipio = todasLasColonias().find(
      (c) => nombreColoniaCoincide(c, n) && normalizarBase(c.municipio) === municipioNorm
    );
    if (exactoEnMunicipio) return exactoEnMunicipio;
  }

  const exacto = todasLasColonias().find((c) => nombreColoniaCoincide(c, n));
  if (exacto) return exacto;

  // Margen conservador: 1 typo cada ~8 caracteres, tope de 3 — nombres
  // cortos (ej. "Reforma") casi no toleran error, nombres largos sí.
  const margen = Math.min(3, Math.max(1, Math.floor(n.length / 8)));
  const cercanos = (c: ColoniaCoord) => {
    const etiquetas = [c.label, ...(c.aliases ?? [])].map(normalizarNombreColonia);
    return etiquetas.some((e) => distanciaLevenshtein(e, n) <= margen);
  };

  if (municipioNorm) {
    const candidatosEnMunicipio = todasLasColonias().filter(
      (c) => cercanos(c) && normalizarBase(c.municipio) === municipioNorm
    );
    if (candidatosEnMunicipio.length === 1) return candidatosEnMunicipio[0];
  }

  const candidatos = todasLasColonias().filter(cercanos);
  return candidatos.length === 1 ? candidatos[0] : undefined;
}

/** Busca por key exacta (ej. desde `?cercaColonia=magisterial` en la URL) — mismo patrón que getLandmark(). */
export function getColoniaByKey(key: string): ColoniaCoord | undefined {
  return todasLasColonias().find((c) => c.key === key);
}

/**
 * Colonia catalogada más cercana a una coordenada (reverse-lookup) — al
 * revés de `matchColonia`, que resuelve un NOMBRE ya escrito a coordenada,
 * esta resuelve una COORDENADA a nombre. Usada para sugerir corregir el
 * campo "Colonia" cuando el GPS de una foto (ver `sugerirPinDesdeFoto` en
 * PublishForm.tsx) cae dentro de una colonia catalogada distinta de la que
 * la persona escribió a mano — nunca la sobreescribe sola, solo ofrece la
 * corrección. `municipioHint` reduce ambigüedad igual que en `matchColonia`
 * (mismo problema real: nombres de colonia repetidos en varios municipios).
 */
export function coloniaCercana(lat: number, lng: number, radioKm = 2, municipioHint?: string): ColoniaCoord | undefined {
  const municipioNorm = municipioHint ? normalizarBase(municipioHint) : undefined;
  let mejor: ColoniaCoord | undefined;
  let mejorDist = Infinity;
  for (const c of todasLasColonias()) {
    if (municipioNorm && normalizarBase(c.municipio) !== municipioNorm) continue;
    const d = distanciaKm(lat, lng, c.lat, c.lng);
    if (d <= radioKm && d < mejorDist) { mejor = c; mejorDist = d; }
  }
  return mejor;
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
 *
 * ⚠️ Verificado 2026-08-23: sin llamadores reales hoy — `api.ts` recibe
 * `latPublico`/`lngPublico` ya calculados por el backend
 * (`bp.latPublico`/`bp.lngPublico`), no por esta función. Se queda aquí por
 * si el cálculo alguna vez vuelve al frontend; el parámetro `municipio`
 * (mismo fix de desambiguación que `matchColonia`) se agrega ahora para que
 * no quede desalineada si eso pasa.
 */
export function getPuntoPublico(id: string, lat: number, lng: number, colonia: string, municipio?: string): { lat: number; lng: number } {
  const match = matchColonia(colonia, municipio);
  if (match) return { lat: match.lat, lng: match.lng };
  const [jLat, jLng] = jitterCoord(id, lat, lng, 500);
  return { lat: jLat, lng: jLng };
}

export { distanciaKm };
