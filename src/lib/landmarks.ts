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
export const LANDMARKS_VERIFICADO_EN = '2026-08-07';

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
 * Américas, Central de Abastos, Mercado Gregorio Méndez, Mercado Florentino
 * Hernández, Central de Autobuses de Tabasco, Santuario de Cupilco, Villa
 * La Venta, Parque Estatal Agua Blanca, Boca del Cerro, Parroquia Santiago
 * Apóstol de Teapa — estas últimas 20 vía Nominatim/OpenStreetMap,
 * auditoría 2026-08-06; Tapijulapa es solo a nivel pueblo, no se encontró
 * el templo específico.
 *
 * ⚠️ **Auditoría 2026-08-07 — ronda completa de los ~45 que quedaban
 * "aproximados a mano" tras la de arriba.** Se disparó por un reporte real:
 * una propiedad en Olmeca aparecía como "cerca del malecón" cuando el
 * malecón real (verificado en OSM: Parque Malecón Carlos A. Madrazo) está a
 * 3.18km de donde apuntaba la coordenada guardada — 'malecon' nunca había
 * pasado por Nominatim, estaba adivinado. Se verificaron los 45 restantes
 * contra Nominatim/OpenStreetMap uno por uno (no solo 'malecon'); 23
 * tenían un error real (0.97km a 20.19km — el peor caso fue
 * 'nacajuca-centro', apuntando a 20km de la Nacajuca real) y se
 * corrigieron. 'parque-tabasco' se sincronizó con la coordenada nueva de
 * 'laguna-ilusiones' (mismo punto físico a propósito, ver el comentario
 * junto a esa entrada).
 *
 * ⚠️ **Segunda pasada 2026-08-07 — direcciones de NotebookLM, cruzadas
 * contra Nominatim antes de aceptar ninguna.** De los que quedaron sin
 * verificar en la ronda de arriba, se le pidió a NotebookLM (con fuentes
 * reales cargadas, no memoria general) la dirección completa de cada uno
 * más apodos/nombres populares — cada dirección que devolvió se
 * geocodificó por separado contra Nominatim, nunca se aceptó el dato de
 * NotebookLM solo. Confirmadas y corregidas con esto: 'icest',
 * 'unid-villahermosa', 'ieu-villahermosa', 'uvm-villahermosa',
 * 'imss-hgz46', 'hospital-sureste', 'hospital-ceracom',
 * 'isset-especialidades', 'cruz-roja', 'medica-tabasco'. Se agregaron 3
 * lugares nuevos que NotebookLM sugirió y Nominatim confirmó:
 * 'universidad-popular-chontalpa' (Cárdenas), 'el-cuyo-jonuta' (zona
 * arqueológica — NotebookLM advirtió de una colisión real con otro "El
 * Cuyo" en Yucatán, confirmado que este SÍ es el de Tabasco/Jonuta) y
 * 'pantanos-centla' (reserva natural, radio más grande a propósito por ser
 * una zona extensa, no un punto). Dos sugerencias de NotebookLM (Mercado 27
 * de Febrero en Cárdenas, Playa Paraíso en Tacotalpa) NO se agregaron: sin
 * ningún resultado confiable en Nominatim, mismo criterio de nunca adivinar
 * una coordenada.
 *
 * Siguen SIN verificar (sin ningún resultado confiable en Nominatim ni con
 * la dirección de NotebookLM — instituciones privadas/pequeñas sin
 * presencia fuerte en OSM): 'universidad-dunamis' (ni el nombre ni "Av.
 * Malecón Carlos A. Madrazo 677" dieron resultado), 'uvg-villahermosa' (ni
 * el nombre ni "Fraccionamiento El Amate" dieron resultado), y
 * 'clinica-tabasco-2000' ("Plaza Oropeza" en Nominatim solo matcheó un
 * restaurante en una plaza distinta — se descartó ese resultado). Estas
 * mantienen su coordenada aproximada anterior — si alguien tiene la
 * dirección exacta de alguna, corregirla aquí es el único lugar que hace
 * falta tocar.
 *
 * El resto (ubicaciones aproximadas dentro de la colonia/calle real,
 * situadas a mano por geografía conocida de la ciudad, no un geocoder) es
 * suficiente para un radio de "cerca de" de 1-5 km, no para precisión de
 * metros. Si algo se ve mal ubicado, ajustar aquí es el único lugar que
 * hace falta tocar.
 *
 * ⚠️ **Tercera pasada 2026-08-07 — segundo documento de NotebookLM (salud,
 * educación, comercio, transporte y apodos municipales), mismo criterio:
 * nunca aceptar una dirección/apodo sin cruzarlo con Nominatim.** Antes de
 * aplicar nada se re-verificaron por búsqueda directa (no solo por
 * dirección) los lugares que el documento describía distinto a como ya
 * estaban aquí — 'hospital-rovirosa', 'ujat', 'universidad-olmeca' y
 * 'mercado-gregorio-mendez' dieron el mismo punto (o a <1km, dentro de la
 * misma colonia) que ya se tenía: eran variantes de descripción, no errores,
 * así que se dejaron sin cambios. Se agregaron 4 lugares nuevos confirmados
 * por Nominatim con match exacto de nombre: 'hospital-air' (real y DISTINTO
 * de 'clinica-tabasco-2000' — un Nominatim de la ronda pasada lo había
 * devuelto como falso positivo de esa búsqueda, quedó la duda hasta ahora),
 * 'uttab', 'parque-abuelos' y 'quinta-grijalva'. También se agregaron como
 * alias los apodos municipales que el documento marcó con fuente Wikipedia/
 * confianza alta: 'puerta del sureste' (Cárdenas), 'la perla de la
 * chontalpa' (Comalcalco), 'el gigante de tabasco' (Huimanguillo), 'la
 * atenas de tabasco' (Cunduacán), 'el balcón del usumacinta' (Emiliano
 * Zapata), 'la sultana de la sierra' (Teapa) — los de confianza baja o sin
 * validar que el propio documento señalaba (Macuspana, Tenosique) NO se
 * agregaron. Sin resultado confiable en Nominatim en este momento (ver
 * cuarta pasada abajo para los que sí se resolvieron después): Hospital de
 * Alta Especialidad de la Mujer, Hospital ISSSTE "Daniel Gurría Urgell"
 * (Dos Montes), Universidad Alfa y Omega, Universidad Mundo Maya, CEIBA,
 * las divisiones foráneas de UJAT (Comalcalco, Tenosique), Mercado Miguel
 * Orrico de los Llanos y MUSEVI — nombres de instituciones/lugares reales
 * pero sin presencia geocodificable en OSM todavía.
 *
 * ⚠️ **Cuarta pasada 2026-08-07 — búsqueda web propia (no NotebookLM) para
 * los 8 que quedaron sin resolver arriba.** Se buscaron direcciones en
 * fuentes oficiales (sitios .gob.mx, sitio oficial de cada institución,
 * documento de transparencia municipal) y se cruzó cada una contra
 * Nominatim antes de aceptarla — mismo criterio, la fuente cambió pero la
 * disciplina no. Resultado: 6 de los 8 sí se pudieron confirmar y se
 * agregaron — 'hospital-mujer', 'hospital-issste' (dos fuentes
 * gubernamentales independientes ubicaron el hospital nuevo en el km 17 de
 * la carretera Villahermosa-Macuspana, zona Altozano; una tercera búsqueda
 * había sugerido "Atasta" pero no coincidía con ninguna fuente oficial y se
 * descartó), 'alfa-omega', 'ujat-tenosique' (match exacto de nombre),
 * 'mercado-tamulte' y 'musevi' (match exacto de nombre). Tres direcciones
 * de 'hospital-mujer'/'mercado-tamulte' coincidieron en el mismo punto de
 * Nominatim pese a tener números de calle distintos — no distingue a nivel
 * de número en esa avenida, solo de segmento; se documentó junto a cada
 * entrada. Siguen sin resolver: Universidad Mundo Maya (dirección con
 * kilómetro de carretera, sin match en Nominatim), CEIBA (el nombre
 * colisiona con "Ceiba" como topónimo/nombre de calle genérico en varias
 * colonias — ningún resultado correspondía a la escuela real) y UJAT
 * Comalcalco (ninguna variante de la dirección dio resultado).
 */
export const LANDMARKS: Landmark[] = [
  // Villahermosa (Centro) — naturaleza / cultura
  { key: 'laguna-ilusiones', label: 'Laguna de las Ilusiones', categoria: 'cultura', lat: 18.0095532, lng: -92.9302939, radioKm: 2, aliases: ['laguna'] },
  // "Parque Tabasco" (construido en 1930) es el nombre histórico del mismo
  // sitio físico que hoy se llama Parque Tomás Garrido Canabal, a la orilla
  // de la laguna — reconstruido por completo en 1983-1985 (confirmado por
  // fuente pública, no un supuesto). Es una entrada propia, NO un alias de
  // 'laguna-ilusiones': aunque comparten coordenadas, mostrarle a alguien
  // que buscó "parque Tabasco" una ficha que dice "Laguna de las Ilusiones"
  // se siente como un resultado ajeno, aunque geográficamente sea el mismo
  // punto — la etiqueta que se muestra debe coincidir con lo que la persona
  // buscó.
  { key: 'parque-tabasco', label: 'Parque Tabasco', categoria: 'cultura', lat: 18.0095532, lng: -92.9302939, radioKm: 2, aliases: ['parque tomás garrido', 'parque tomas garrido', 'parque tomás garrido canabal'] },
  { key: 'parque-la-venta', label: 'Parque Museo La Venta', categoria: 'cultura', lat: 18.0017649, lng: -92.9333756, radioKm: 1.5, aliases: ['parque la venta', 'museo la venta'] },
  { key: 'malecon', label: 'Malecón de Villahermosa', categoria: 'cultura', lat: 17.9892220, lng: -92.9159682, radioKm: 1.5, aliases: ['malecón', 'malecon'] },
  // Coordenada exacta vía Nominatim/OpenStreetMap (verificada 2026-08-06) —
  // agregada después de que una búsqueda real ("cerca de la catedral de
  // tabasco") diera 0 resultados: la IA no puede reconocer un landmark que
  // no está en este catálogo, sin importar qué tan conocido sea en la vida
  // real.
  { key: 'catedral', label: 'Catedral del Señor de Tabasco', categoria: 'cultura', lat: 17.9896, lng: -92.9282, radioKm: 1, aliases: ['catedral', 'catedral de tabasco', 'catedral de villahermosa'] },
  { key: 'cicom', label: 'Zona CICOM', categoria: 'cultura', lat: 17.9800, lng: -92.9280, radioKm: 1.2 },
  { key: 'planetario', label: 'Planetario Tabasco 2000', categoria: 'cultura', lat: 17.9996097, lng: -92.9457292, radioKm: 1 },
  { key: 'yumka', label: 'Yumká', categoria: 'cultura', lat: 18.0009123, lng: -92.8041569, radioKm: 2 },
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
  // Agregados 2026-08-07 (tercera pasada) — confirmados vía Nominatim
  // (leisure/park y highway/living_street con el nombre exacto). Quedan a
  // ~130m entre sí, ambos en la zona céntrica junto al río — no es un
  // error de duplicado, son dos lugares reales y distintos que resultan
  // ser vecinos.
  { key: 'parque-abuelos', label: 'Parque de los Abuelos (Manuel Mestre)', categoria: 'cultura', lat: 17.9905847, lng: -92.9300817, radioKm: 1, aliases: ['parque de los abuelos', 'parque manuel mestre'] },
  { key: 'quinta-grijalva', label: 'Quinta Grijalva', categoria: 'cultura', lat: 17.9910572, lng: -92.9289926, radioKm: 1, aliases: ['quinta grijalva'] },
  // Agregada 2026-08-07 (cuarta pasada) — dirección real vía búsqueda web
  // (archdaily.mx, poresto.com), confirmada vía Nominatim (tourism/gallery,
  // nombre exacto). Es un museo cerrado/inconcluso desde hace años (proyecto
  // fallido, cobertura periodística lo confirma), pero la estructura sigue
  // en pie y es un punto de referencia real y reconocible en Paseo Tabasco.
  { key: 'musevi', label: 'MUSEVI (Museo Elevado de Villahermosa)', categoria: 'cultura', lat: 17.9951786, lng: -92.9377808, radioKm: 1, aliases: ['musevi', 'museo elevado de villahermosa'] },

  // Villahermosa (Centro) — educación
  { key: 'ujat', label: 'UJAT', categoria: 'educacion', lat: 17.9822128, lng: -92.9279565, radioKm: 1.5, aliases: ['universidad juárez autónoma de tabasco'] },
  { key: 'itvh', label: 'Instituto Tecnológico de Villahermosa', categoria: 'educacion', lat: 17.9878, lng: -92.9194, radioKm: 1.2, aliases: ['itvh', 'tecnológico de villahermosa', 'tecnm villahermosa'] },
  { key: 'uvm-villahermosa', label: 'UVM Villahermosa', categoria: 'educacion', lat: 17.9717369, lng: -92.9481709, radioKm: 1.2, aliases: ['uvm', 'universidad del valle de méxico'] },
  { key: 'icest', label: 'ICEST', categoria: 'educacion', lat: 17.9566, lng: -92.9527, radioKm: 1.2 },
  // Sin alias "olmeca" a propósito: es también el nombre de una colonia
  // real (src/data/zones.json) a ~13km de aquí — confirmado con pruebas
  // reales que el alias corto generaba colonia:"Olmeca" + landmark a la vez,
  // dos filtros que se contradicen entre sí (cero resultados posibles) para
  // cualquier búsqueda que solo dijera "Olmeca". El nombre completo
  // "Universidad Olmeca" ya es suficiente y no es ambiguo.
  { key: 'universidad-olmeca', label: 'Universidad Olmeca', categoria: 'educacion', lat: 17.9674732, lng: -92.8058279, radioKm: 2 },
  { key: 'unid-villahermosa', label: 'UNID Villahermosa', categoria: 'educacion', lat: 17.9836, lng: -92.9463, radioKm: 1.2, aliases: ['unid'] },
  // Sigue sin confirmar por Nominatim (ni el nombre ni la calle "Malecón
  // Carlos A. Madrazo 677" dieron resultado) — se deja la coordenada
  // aproximada anterior, no la de NotebookLM sin cruzar.
  { key: 'universidad-dunamis', label: 'Universidad Dunamis', categoria: 'educacion', lat: 17.9870, lng: -92.9440, radioKm: 1.2, aliases: ['dunamis'] },
  // Igual sin confirmar — "Fraccionamiento El Amate" no dio resultado en
  // Nominatim tampoco. Coordenada aproximada anterior sin cambios.
  { key: 'uvg-villahermosa', label: 'Universidad Valle del Grijalva', categoria: 'educacion', lat: 17.9600, lng: -92.9250, radioKm: 1.5, aliases: ['uvg', 'valle del grijalva'] },
  { key: 'ieu-villahermosa', label: 'Universidad IEU', categoria: 'educacion', lat: 18.0114187, lng: -92.9526657, radioKm: 1.2, aliases: ['ieu'] },
  // Agregada 2026-08-07 (tercera pasada) — confirmada vía Nominatim
  // (amenity/school, nombre exacto). Campus real fuera del área urbana
  // (Parrilla 2, ~12km del centro) — radio un poco mayor que el resto de
  // educación para cubrir el fraccionamiento completo alrededor.
  { key: 'uttab', label: 'Universidad Tecnológica de Tabasco (UTTAB)', categoria: 'educacion', lat: 17.8837589, lng: -92.9257541, radioKm: 1.5, aliases: ['uttab', 'universidad tecnológica de tabasco'] },
  // Agregada 2026-08-07 (cuarta pasada) — dos direcciones de campus vía
  // búsqueda web (sitio oficial + directorio SEP), ambas en Colonia Atasta,
  // confirmadas al mismo punto vía Nominatim (calle exacta, no solo colonia).
  { key: 'alfa-omega', label: 'Universidad Alfa y Omega', categoria: 'educacion', lat: 17.9829613, lng: -92.9408541, radioKm: 1.2, aliases: ['alfa y omega', 'universidad alfa y omega'] },
  // Agregada 2026-08-07 (cuarta pasada) — dirección oficial (ujat.mx),
  // confirmada vía Nominatim con match exacto (amenity/university). A
  // 169km de Villahermosa porque Tenosique está en el extremo sur del
  // estado, no es un error — mismo caso que 'boca-del-cerro'.
  { key: 'ujat-tenosique', label: 'UJAT División Académica de los Ríos (Tenosique)', categoria: 'educacion', lat: 17.4882580, lng: -91.4257457, radioKm: 1.5, aliases: ['división académica de los ríos', 'damr'] },

  // Villahermosa (Centro) — salud (públicos y privados)
  { key: 'hospital-rovirosa', label: 'Hospital Rovirosa', categoria: 'salud', lat: 18.0136483, lng: -92.9271801, radioKm: 1.5, aliases: ['rovirosa'] },
  // Agregada 2026-08-07 (cuarta pasada) — dirección oficial del hospital
  // (hmujertab.gob.mx), confirmada vía Nominatim al segmento de la Av.
  // Gregorio Méndez Magaña en Tamulté de las Barrancas — coincide con el
  // mismo punto que 'mercado-tamulte' de abajo (Nominatim no distingue por
  // número exacto en esta calle, solo por segmento); son dos lugares reales
  // y vecinos, mismo criterio ya usado con 'hospital-ceracom'/'cruz-roja'.
  { key: 'hospital-mujer', label: 'Hospital Regional de Alta Especialidad de la Mujer', categoria: 'salud', lat: 17.9649928, lng: -92.9622973, radioKm: 1.5, aliases: ['hospital de la mujer', 'hospital regional de la mujer'] },
  // Agregada 2026-08-07 (cuarta pasada) — dos fuentes oficiales del
  // gobierno (gob.mx/issste, tabasco.gob.mx) ubican el hospital nuevo "en
  // el kilómetro 17 de la carretera Villahermosa-Macuspana, zona
  // Altozano"; ninguna da colonia/calle exacta. Nominatim confirma la
  // ranchería real "Dos Montes" sobre ese mismo corredor — se usa su
  // centroide como aproximación (por eso el radio es mayor, 2km, no la
  // ubicación exacta del hospital dentro de la ranchería).
  { key: 'hospital-issste', label: 'Hospital General ISSSTE Dr. Daniel Gurría Urgell', categoria: 'salud', lat: 17.9857780, lng: -92.8280610, radioKm: 2, aliases: ['issste', 'hospital issste', 'daniel gurría urgell', 'gurría urgell'] },
  { key: 'hospital-alta-especialidad', label: 'Hospital de Alta Especialidad Juan Graham (La Isla)', categoria: 'salud', lat: 17.9780328, lng: -92.9856342, radioKm: 2, aliases: ['hospital juan graham', 'juan graham', 'la isla', 'alta especialidad'] },
  { key: 'hospital-nino', label: 'Hospital del Niño Rodolfo Nieto Padrón', categoria: 'salud', lat: 17.9773301, lng: -92.9530105, radioKm: 1.5, aliases: ['hospital del niño', 'nieto padrón', 'rodolfo nieto padrón'] },
  { key: 'imss-hgz46', label: 'IMSS Hospital General de Zona 46', categoria: 'salud', lat: 18.0157630, lng: -92.9170954, radioKm: 1.5, aliases: ['imss', 'hgz 46', 'hospital general de zona 46', 'dr. bartolo sanz pont'] },
  { key: 'hospital-angeles', label: 'Hospital Ángeles Villahermosa', categoria: 'salud', lat: 17.9964630, lng: -92.9532072, radioKm: 1.2, aliases: ['hospital ángeles', 'hospital angeles'] },
  { key: 'medica-tabasco', label: 'Médica Tabasco', categoria: 'salud', lat: 17.9922836, lng: -92.9332870, radioKm: 1.2, aliases: ['clínica médica tabasco'] },
  { key: 'hospital-sureste', label: 'Hospital del Sureste', categoria: 'salud', lat: 17.9932727, lng: -92.9298863, radioKm: 1.2 },
  // isset-especialidades comparte la misma calle (Av. Sandino, Col. Primero
  // de Mayo) que la dirección que dio Nominatim para este — a nivel de
  // calle, no de número exacto, quedan prácticamente en el mismo punto.
  { key: 'hospital-ceracom', label: 'Hospital Ceracom', categoria: 'salud', lat: 17.9759147, lng: -92.9349303, radioKm: 1.2, aliases: ['ceracom'] },
  // Sigue sin confirmar — "Plaza Oropeza" en Nominatim solo matcheó un
  // restaurante en una plaza distinta (Plaza Farole), no la clínica. Se deja
  // la coordenada aproximada anterior (ya estaba en la colonia correcta,
  // Tabasco 2000, solo no verificada a nivel de dirección exacta).
  { key: 'clinica-tabasco-2000', label: 'Clínica Médica Quirúrgica Tabasco 2000', categoria: 'salud', lat: 18.0025, lng: -92.9325, radioKm: 1.2, aliases: ['clínica tabasco 2000'] },
  // Agregada 2026-08-07 (tercera pasada) — NotebookLM la mencionó como
  // "Hospital Air" y llegué a sospechar que era el mismo lugar que
  // clinica-tabasco-2000 de arriba (un Nominatim previo la había devuelto
  // como falso positivo para esa búsqueda). Confirmado que es un lugar
  // real y DISTINTO: amenity/hospital verificado, ~1km de distancia de
  // clinica-tabasco-2000, nombre oficial en OSM "Clínica Air".
  { key: 'hospital-air', label: 'Clínica Air', categoria: 'salud', lat: 17.9944131, lng: -92.9360686, radioKm: 1.2, aliases: ['hospital air', 'clínica air'] },
  { key: 'isset-centro-medico', label: 'ISSET Centro Médico', categoria: 'salud', lat: 17.9945, lng: -92.9210, radioKm: 1.2, aliases: ['isset'] },
  { key: 'isset-especialidades', label: 'ISSET Centro de Especialidades Médicas', categoria: 'salud', lat: 17.9733994, lng: -92.9381466, radioKm: 1.2, aliases: ['isset especialidades', 'cem-isset', 'cem isset'] },
  { key: 'cruz-roja', label: 'Cruz Roja Villahermosa', categoria: 'salud', lat: 17.9759147, lng: -92.9349303, radioKm: 1.2, aliases: ['cruz roja'] },

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
  // Búsqueda dedicada en Nominatim por "mercado, Villahermosa" — son los
  // 3 mercados públicos que existen ahí como amenity/marketplace, más la
  // Central de Abastos (mayoreo, tipo de lugar distinto). Antes de esto
  // solo estaba Pino Suárez, agregado por casualidad al investigar el bug
  // original — el usuario tenía razón en que un mercado no es menos
  // importante que un centro comercial para la vida diaria.
  { key: 'central-abastos', label: 'Central de Abastos de Villahermosa', categoria: 'comercial', lat: 17.9919, lng: -92.9657, radioKm: 1.5, aliases: ['central de abastos', 'abastos'] },
  { key: 'mercado-gregorio-mendez', label: 'Mercado Público Coronel Gregorio Méndez Magaña', categoria: 'comercial', lat: 17.9792, lng: -92.9291, radioKm: 1, aliases: ['mercado gregorio méndez', 'mercado gregorio mendez'] },
  { key: 'mercado-florentino-hernandez', label: 'Mercado Público Florentino Hernández Bautista', categoria: 'comercial', lat: 17.9839, lng: -92.9187, radioKm: 1, aliases: ['mercado florentino hernández', 'mercado florentino hernandez'] },
  // Agregada 2026-08-07 (cuarta pasada) — dirección de un documento oficial
  // de transparencia municipal (directorio de mercados, Ayuntamiento de
  // Villahermosa), confirmada vía Nominatim al mismo punto que
  // 'hospital-mujer' de arriba (ver nota ahí).
  { key: 'mercado-tamulte', label: 'Mercado Público Gral. Miguel Orrico de los Llanos (Tamulté)', categoria: 'comercial', lat: 17.9649928, lng: -92.9622973, radioKm: 1.5, aliases: ['mercado de tamulté', 'mercado tamulte', 'miguel orrico de los llanos'] },

  // Villahermosa (Centro) — transporte
  { key: 'aeropuerto-vsa', label: 'Aeropuerto de Villahermosa (VSA)', categoria: 'transporte', lat: 17.9970, lng: -92.8174, radioKm: 4, aliases: ['aeropuerto', 'vsa'] },
  // "central de autobuses" (genérico, sin "ADO" ni "de Tabasco") se quitó
  // de los alias: dejó de ser inequívoco al agregar 'central-autobuses-tabasco'
  // más abajo — dos terminales reales distintas con nombre parecido, mismo
  // problema que ya se evitó con "olmeca"/"carrizal"/"pino suárez".
  { key: 'central-camionera', label: 'Central de Autobuses ADO', categoria: 'transporte', lat: 17.9967876, lng: -92.9219001, radioKm: 1.5, aliases: ['ado', 'central camionera'] },
  // Verificada vía Nominatim — terminal real y DISTINTA de la ADO de arriba
  // (rutas locales/segunda clase, no la misma empresa ni el mismo lugar).
  // NotebookLM la llamó "Terminal de Autobuses de Tabasco" en la
  // investigación que la originó; el nombre real tageado en OSM es este.
  { key: 'central-autobuses-tabasco', label: 'Central de Autobuses de Tabasco', categoria: 'transporte', lat: 17.9999684, lng: -92.9186152, radioKm: 1.5, aliases: ['central de autobuses de tabasco', 'terminal de segunda', 'central de segunda'] },

  // Comalcalco
  { key: 'zona-arqueologica-comalcalco', label: 'Zona Arqueológica de Comalcalco', categoria: 'cultura', lat: 18.2792, lng: -93.2010, radioKm: 2, aliases: ['zona arqueológica comalcalco', 'ruinas de comalcalco'] },
  // Alias "la perla de la chontalpa" — apodo histórico de Comalcalco,
  // confianza alta (fuente Wikipedia vía NotebookLM, segunda pasada
  // 2026-08-07). No requiere verificación por Nominatim: es un alias de
  // texto, no una coordenada.
  { key: 'comalcalco-centro', label: 'centro de Comalcalco', categoria: 'centro', lat: 18.2615076, lng: -93.2231523, radioKm: 2.5, aliases: ['la perla de la chontalpa'] },
  // Verificada vía Nominatim — iglesia real y muy conocida por sus colores,
  // en la localidad de Cupilco (no en la cabecera municipal).
  { key: 'santuario-cupilco', label: 'Santuario La Asunción de María (Cupilco)', categoria: 'cultura', lat: 18.2382, lng: -93.1270, radioKm: 1.5, aliases: ['iglesia de cupilco', 'santuario de cupilco', 'cupilco'] },

  // Paraíso
  { key: 'puerto-dos-bocas', label: 'Puerto Dos Bocas', categoria: 'transporte', lat: 18.4303558, lng: -93.1803285, radioKm: 5 },
  { key: 'paraiso-centro', label: 'centro de Paraíso', categoria: 'centro', lat: 18.3999, lng: -93.2073, radioKm: 2.5 },
  // "El Bellote" (colonia ya catalogada en colonias.ts, no se repite aquí
  // como landmark — mismo lugar, evitar el mismo tipo de colisión de
  // "olmeca"/"carrizal") cubre también lo que NotebookLM llamó "Corredor
  // Gastronómico El Bellote": es la misma ubicación, no un lugar aparte.

  // Tacotalpa
  // Verificada solo a nivel pueblo (Tapijulapa) — no se encontró en
  // Nominatim la coordenada específica del Templo de Santiago Apóstol, así
  // que se usa el centro del pueblo en vez de adivinar el edificio exacto.
  // NotebookLM señaló que "Tapijulapa" ya se usa como sinónimo de toda la
  // zona turística de la sierra, no solo el templo — el alias queda así a
  // propósito.
  //
  // "templo de santiago apóstol" (sin más contexto) se quitó de los alias:
  // hay OTRA iglesia real con el mismo nombre en Teapa (ver más abajo,
  // 'parroquia-santiago-apostol-teapa'), verificada por separado — mismo
  // problema de dos lugares reales que comparten nombre, otra vez.
  { key: 'tapijulapa', label: 'Tapijulapa', categoria: 'cultura', lat: 17.4603, lng: -92.7788, radioKm: 2, aliases: ['templo de tapijulapa', 'santiago apóstol de tapijulapa'] },

  // Otros municipios — punto de referencia del centro urbano
  { key: 'cardenas-centro', label: 'centro de Cárdenas', categoria: 'centro', lat: 17.9886831, lng: -93.3767428, radioKm: 2.5, aliases: ['puerta del sureste'] },
  // Agregada 2026-08-07 — sugerida por NotebookLM, confirmada vía
  // Nominatim (amenity/university, nombre exacto).
  { key: 'universidad-popular-chontalpa', label: 'Universidad Popular de la Chontalpa', categoria: 'educacion', lat: 17.9609667, lng: -93.3636066, radioKm: 1.5, aliases: ['upch'] },
  { key: 'nacajuca-centro', label: 'centro de Nacajuca', categoria: 'centro', lat: 18.1681198, lng: -93.0190169, radioKm: 2.5 },
  { key: 'jalpa-centro', label: 'centro de Jalpa de Méndez', categoria: 'centro', lat: 18.1762, lng: -93.0656, radioKm: 2.5 },
  { key: 'huimanguillo-centro', label: 'centro de Huimanguillo', categoria: 'centro', lat: 17.8331648, lng: -93.3920691, radioKm: 2.5, aliases: ['el gigante de tabasco'] },
  // "La Venta" — la advertencia de ambigüedad más importante de esta ronda:
  // Villa La Venta (aquí, pueblo real a ~130km de Villahermosa, verificado)
  // NO es lo mismo que "Parque Museo La Venta" (Villahermosa, ya
  // catalogado arriba). Ninguno de los dos lleva el alias corto "la venta"
  // — exactamente el mismo criterio que ya se usa en todo este archivo
  // para nombres compartidos entre dos lugares reales distintos.
  { key: 'villa-la-venta', label: 'Villa La Venta', categoria: 'centro', lat: 18.0999, lng: -94.0457, radioKm: 3, aliases: ['villa la venta', 'la venta huimanguillo'] },
  { key: 'centla-centro', label: 'centro de Frontera (Centla)', categoria: 'centro', lat: 18.5321825, lng: -92.6461428, radioKm: 2.5 },
  // Agregada 2026-08-07 — sugerida por NotebookLM, confirmada vía
  // Nominatim (boundary/national_park, nombre exacto). Radio más grande
  // que el resto (6km, no 1-2.5): es una reserva natural real de gran
  // extensión, no un punto puntual — un radio chico dejaría fuera zonas
  // que sí están dentro de la reserva.
  { key: 'pantanos-centla', label: 'Reserva de la Biosfera Pantanos de Centla', categoria: 'cultura', lat: 18.3242402, lng: -92.4536258, radioKm: 6, aliases: ['pantanos de centla', 'los pantanos'] },
  { key: 'macuspana-centro', label: 'centro de Macuspana', categoria: 'centro', lat: 17.7633, lng: -92.5936, radioKm: 2.5 },
  { key: 'agua-blanca', label: 'Parque Estatal Agua Blanca', categoria: 'cultura', lat: 17.6123, lng: -92.4590, radioKm: 2, aliases: ['agua blanca', 'cascadas de agua blanca'] },
  { key: 'tenosique-centro', label: 'centro de Tenosique', categoria: 'centro', lat: 17.4743, lng: -91.4241, radioKm: 2.5 },
  // "Boca del Cerro" es tanto un puente/cañón como el nombre del poblado —
  // dos nodos de OSM cercanos pero no idénticos (~6km entre sí); se usó el
  // que corresponde al poblado real, no una carretera aislada.
  { key: 'boca-del-cerro', label: 'Boca del Cerro', categoria: 'cultura', lat: 17.4532, lng: -91.4288, radioKm: 3, aliases: ['boca del cerro'] },
  // Los siguientes 7 faltaban por completo — de los 17 municipios que
  // reconoce la plataforma, estos eran los únicos siete sin ni un solo
  // landmark de referencia. Coordenadas de municipalities.json (mismo
  // criterio "a mano por geografía conocida" que ya aplica a los 7 de
  // arriba, no Nominatim — son solo el punto de referencia del centro
  // urbano, no un lugar específico).
  { key: 'cunduacan-centro', label: 'centro de Cunduacán', categoria: 'centro', lat: 18.0660590, lng: -93.1736750, radioKm: 2.5, aliases: ['la atenas de tabasco'] },
  { key: 'emiliano-zapata-centro', label: 'centro de Emiliano Zapata', categoria: 'centro', lat: 17.7399133, lng: -91.7649173, radioKm: 2.5, aliases: ['el balcón del usumacinta'] },
  { key: 'balancan-centro', label: 'centro de Balancán', categoria: 'centro', lat: 17.7975167, lng: -91.3458589, radioKm: 2.5 },
  { key: 'jonuta-centro', label: 'centro de Jonuta', categoria: 'centro', lat: 18.0903163, lng: -92.1375479, radioKm: 2.5 },
  // Agregada 2026-08-07 — sugerida por NotebookLM, que de paso advirtió una
  // colisión real: existe otro "El Cuyo" bien conocido (playa/puerto) en
  // Yucatán, a cientos de km de aquí. Confirmado vía Nominatim que ESTE es
  // el sitio arqueológico real dentro de Jonuta, Tabasco (85km de
  // Villahermosa, no en Yucatán) — sin alias corto "el cuyo" a propósito,
  // mismo criterio que "olmeca"/"carrizal"/"la venta" en este archivo para
  // nombres compartidos con un lugar real distinto en otro estado.
  { key: 'el-cuyo-jonuta', label: 'Zona Arqueológica El Cuyo (Jonuta)', categoria: 'cultura', lat: 18.0892618, lng: -92.1342049, radioKm: 1.5 },
  { key: 'tacotalpa-centro', label: 'centro de Tacotalpa', categoria: 'centro', lat: 17.5972, lng: -92.8189, radioKm: 2.5 },
  { key: 'teapa-centro', label: 'centro de Teapa', categoria: 'centro', lat: 17.5428, lng: -92.9558, radioKm: 2.5, aliases: ['la sultana de la sierra'] },
  // Verificada vía Nominatim — iglesia real de Teapa, DISTINTA de la de
  // Tapijulapa (ver nota junto a 'tapijulapa' más arriba). Alias con
  // "teapa" explícito a propósito, nunca "santiago apóstol" solo.
  { key: 'parroquia-santiago-apostol-teapa', label: 'Parroquia Santiago Apóstol (Teapa)', categoria: 'cultura', lat: 17.5488, lng: -92.9535, radioKm: 1, aliases: ['iglesia de teapa', 'parroquia de teapa', 'santiago apóstol de teapa'] },
  { key: 'jalapa-centro', label: 'centro de Jalapa', categoria: 'centro', lat: 17.7217160, lng: -92.8120120, radioKm: 2.5 },
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
