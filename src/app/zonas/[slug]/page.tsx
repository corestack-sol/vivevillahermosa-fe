import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicarCTA } from '@/components/forms/PublicarCTA';
import Image from 'next/image';
import { ChevronRight, MapPin, Zap, TrendingUp, Map as MapIcon, Building2, Droplets, Waves, PlayCircle } from 'lucide-react';
import { getAllZones, getAllMunicipalities, getAllProperties, getZoneBySlug, getMunicipalityBySlug, getPropertiesPage, getZonesWithLiveStats, getMunicipalitiesWithLiveStats } from '@/lib/api';
import { buildZoneMetadata } from '@/lib/seo';
import { ZoneMap } from '@/components/map/ZoneMap';
import { formatPrice } from '@/lib/format';
import { obtenerLandmarksBackend, distanciaKm } from '@/lib/landmarks';
import { detectarRiesgoInundacion } from '@/lib/zonas-inundacion';
import { backendFetchServer } from '@/lib/backendApiServer';
import type { Property } from '@/types/property';
import { ListaPropiedadesMunicipio } from '@/components/zonas/ListaPropiedadesMunicipio';
import type { Zone, Municipality, MunicipioContenido } from '@/types/zone';
import contenidoMunicipios from '@/data/municipios-contenido.json';
import { MunicipioContenidoView } from '@/components/zonas/MunicipioContenidoView';
import { VideoConCorte } from '@/components/zonas/VideoConCorte';
import { HeroFotoMunicipio } from '@/components/zonas/HeroFotoMunicipio';

const TAMANO_PAGINA = 12;
// Tope de pines en el mapa de un municipio: los pines son ligeros, las tarjetas no.
const MAX_PINES_MAPA = 50;

const CONTENIDO_MUNICIPIOS = contenidoMunicipios as Record<string, MunicipioContenido>;

// Fotos reales de Wikimedia Commons para el hero de cada municipio.
//
// Auditoría de atractivos turísticos 22/09/2026 — pedido explícito: para
// los 16 municipios que no son Centro, la foto debía mostrar un atractivo
// turístico real (el mismo que ya describe la sección "Qué visitar" de
// cada uno) en vez de una vista genérica de la cabecera municipal. Cada
// archivo se verificó abriendo su página real en Commons (autor, licencia
// y descripción tal cual aparecen ahí, nunca inferidos del nombre del
// archivo) — mismo criterio que la auditoría de fotos del 17/09/2026, que
// ya había encontrado 2 fotos con autoría no verificable.
//
// Dos casos con salvedad, documentados aquí por si hay que revisar:
//  - Huimanguillo: la única foto libre encontrada es el edificio del museo
//    de sitio de La Venta, no las pirámides — el sitio real está en gran
//    parte bajo una refinería de Pemex y casi no hay fotos libres suyas;
//    se descartaron varias candidatas por riesgo de confundirse con el
//    Parque-Museo La Venta (que está en Villahermosa, no en Huimanguillo).
//  - Jalapa: no se encontró ninguna foto turística libre en Commons (la
//    categoría del municipio solo tiene dulces típicos y una acuarela de
//    1858) — se dejó sin cambios, sigue con su foto de cabecera de siempre.
//  - Macuspana, Balancán y Jonuta: la foto correcta existe pero en
//    resolución baja en su origen (720×480 a 1632×1224) — se usaron igual,
//    revisar cómo se ven ampliadas.
//
// De las 16 fotos nuevas, 10 están licenciadas CC BY / CC BY-SA (no
// dominio público) — esa licencia exige, además del autor, nombrar la
// licencia y avisar que la obra se adaptó (se convirtió a .webp y se
// recortó). `licencia` completa eso solo para las que de verdad lo
// requieren; las de dominio público (`licencia` ausente) no lo necesitan
// legalmente, se les da crédito igual por cortesía.
const CC_BY_2 = { nombre: 'CC BY 2.0', url: 'https://creativecommons.org/licenses/by/2.0/' };
const CC_BY_3 = { nombre: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' };
const CC_BY_SA_3 = { nombre: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' };
const CC_BY_SA_4 = { nombre: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };

interface CreditoFoto { autor: string; fuente: string; licencia?: { nombre: string; url: string } }

// `fuente` — auditoría 22/09/2026: las 17 páginas de archivo real en
// Commons, reconfirmadas una por una ese mismo día (autor, licencia y
// descripción tal cual aparecen ahí, ninguna con aviso de disputa ni
// solicitud de borrado). CC BY/BY-SA piden enlazar la licencia Y, cuando
// sea razonable, la obra misma — antes solo se enlazaba la licencia.
const MUNICIPIO_FOTO_CREDITO: Record<string, CreditoFoto> = {
  // Cabeza colosal olmeca (Monumento 1) en el Parque-Museo La Venta,
  // Villahermosa — pedido explícito 2026-09-22: Centro también pasa de
  // vista genérica a atractivo turístico real, mismo criterio que los
  // otros 16. Verificado en Commons: autor, licencia y descripción tal
  // cual aparecen en la página real del archivo.
  centro: { autor: 'Arian Zwegers', licencia: CC_BY_2, fuente: 'https://commons.wikimedia.org/wiki/File:Villahermosa,_Parque-Museo_La_Venta,_Colossal_Head_(20686566115).jpg' },
  cardenas: { autor: 'AlejandroLinaresGarcia', licencia: CC_BY_SA_3, fuente: 'https://commons.wikimedia.org/wiki/File:BeachAreanearSanchezMagallanes.JPG' },
  comalcalco: { autor: 'Alfonsobouchot', licencia: CC_BY_SA_4, fuente: 'https://commons.wikimedia.org/wiki/File:Comalcalco.La_Gran_Acr%C3%B3polis.jpg' },
  paraiso: { autor: 'AlejandroLinaresGarcia', licencia: CC_BY_SA_3, fuente: 'https://commons.wikimedia.org/wiki/File:VaraderoBeach37.JPG' },
  'jalpa-de-mendez': { autor: 'Cookie253', licencia: CC_BY_3, fuente: 'https://commons.wikimedia.org/wiki/File:Casa_Museo_Coronel_Gregorio_M%C3%A9ndez_Maga%C3%B1a.JPG' },
  nacajuca: { autor: 'Alfonsobouchot', fuente: 'https://commons.wikimedia.org/wiki/File:Nacajuca_Iglesia_de_Mazateupa.jpg' },
  huimanguillo: { autor: 'Alfonsobouchot', fuente: 'https://commons.wikimedia.org/wiki/File:La_Venta_Museo_de_sitio.jpg' },
  centla: { autor: 'Alfonsobouchot', licencia: CC_BY_SA_3, fuente: 'https://commons.wikimedia.org/wiki/File:Pantanos_de_Centla_09.JPG' },
  macuspana: { autor: 'Alfonsobouchot', licencia: CC_BY_SA_3, fuente: 'https://commons.wikimedia.org/wiki/File:Macuspana_Agua_Blanca.jpg' },
  cunduacan: { autor: 'AlejandroLinaresGarcia', licencia: CC_BY_SA_3, fuente: 'https://commons.wikimedia.org/wiki/File:HouseChonita01.JPG' },
  tenosique: { autor: 'ProtoplasmaKid', licencia: CC_BY_SA_4, fuente: 'https://commons.wikimedia.org/wiki/File:Zona_Arqueol%C3%B3gica_de_Pomon%C3%A1_-_Panor%C3%A1mica.jpg' },
  'emiliano-zapata': { autor: 'Kazekage AMT', fuente: 'https://commons.wikimedia.org/wiki/File:Actual_Malec%C3%B3n_de_Emiliano_Zapata.JPG' },
  balancán: { autor: 'México Comunidad', licencia: CC_BY_2, fuente: 'https://commons.wikimedia.org/wiki/File:Zona_arqueol%C3%B3gica_de_Moral_-_Reforma_(Balanc%C3%A1n,_Tabasco,_M%C3%A9xico)_-_05.jpg' },
  jonuta: { autor: 'Kazekage AMT', fuente: 'https://commons.wikimedia.org/wiki/File:El_Cuyo,_Jonuta.jpg' },
  jalapa: { autor: 'Alfonsobouchot', fuente: 'https://commons.wikimedia.org/wiki/File:Tunel_Vegetal,_Jalapa_Tabasco.JPG' },
  tacotalpa: { autor: 'Alfonsobouchot', fuente: 'https://commons.wikimedia.org/wiki/File:Tapijulapa.JPG' },
  teapa: { autor: 'Avatar7', licencia: CC_BY_SA_3, fuente: 'https://commons.wikimedia.org/wiki/File:Teapa.Grutas_de_Cocon%C3%A1.jpg' },
};

// Radio generoso para "cerca de la zona" (el centro de una colonia/municipio
// está más lejos de un landmark que una propiedad puntual dentro de ella) —
// no confundir con `radioKm` de cada Landmark, que es para "cerca de la
// propiedad" (BACKEND.md §9.2 solo pide landmarks REALES cercanos, nunca
// inventados; este radio decide cuáles cuentan como "cercanos" a nivel zona).
const RADIO_LANDMARKS_ZONA_KM = 3;

/** Hasta 3 landmarks reales más cercanos al centro de la zona, ordenados por distancia — nunca inventados. */
async function landmarksCercaDeZona(lat: number, lng: number): Promise<string[]> {
  const landmarks = await obtenerLandmarksBackend();
  return landmarks
    .map((l) => ({ label: l.label, distancia: distanciaKm(lat, lng, l.lat, l.lng) }))
    .filter((l) => l.distancia <= RADIO_LANDMARKS_ZONA_KM)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 3)
    .map((l) => l.label);
}

/**
 * BACKEND.md §9.2 — para COLONIAS, genera la descripción contra datos
 * verificados (landmarks reales, stats en vivo, Atlas de Riesgos vía
 * `detectarRiesgoInundacion`); si la llamada falla, cae al texto estático
 * editorial (zones.json) en vez de dejar la sección vacía.
 *
 * Para MUNICIPIOS ya no se llama a la IA — pedido explícito 2026-08-19:
 * "no incluiste una descripción breve e interesante (cultura, industria,
 * zonas de interés), solo está la descripción genérica de siempre". La IA
 * generaba una plantilla genérica ("es un municipio ubicado en Tabasco...")
 * que le ganaba en prioridad al texto editorial investigado en Wikipedia
 * (municipalities.json, con hechos reales de historia/cultura/economía por
 * municipio) — ese texto SIEMPRE es mejor que la plantilla, así que ya no
 * hace falta ni la llamada.
 */
async function resolverDescripcion(zone: Zone | undefined, municipality: Municipality | undefined): Promise<string> {
  const estatica = (zone?.descripcion ?? municipality?.descripcion) ?? '';
  if (municipality) return estatica;
  try {
    const riesgo = zone
      ? detectarRiesgoInundacion(zone!.nombre, zone!.municipio)
      : null;
    const body = {
      nombre: zone!.nombre,
      tipo: 'colonia' as const,
      municipio: zone!.municipio,
      landmarksCercanos: await landmarksCercaDeZona(zone!.lat, zone!.lng),
      totalPropiedades: zone!.propiedades,
      precioPromedioVenta: zone!.precioPromedioVenta > 0 ? zone!.precioPromedioVenta : undefined,
      precioPromedioRenta: zone!.precioPromedioRenta > 0 ? zone!.precioPromedioRenta : undefined,
      // `confianza: 'confirmada'` solo dice que el NOMBRE coincidió exacto —
      // `citadaEnAtlas` (auditoría 2026-09-20) dice si el Atlas de verdad
      // nombra esta colonia. Sin ambas, la IA podría escribir "según el
      // Atlas..." para una de las 24 zonas que el documento nunca menciona.
      riesgoInundacion: riesgo?.confianza === 'confirmada' && riesgo.citadaEnAtlas ? riesgo.riesgo : undefined,
    };
    const { descripcion } = await backendFetchServer<{ descripcion: string }>('/ia/descripcion-zona', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return descripcion || estatica;
  } catch {
    return estatica;
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  // Municipios siguen siendo catálogo editorial estático (§9.3 no los tocó
  // esta pasada). Colonias con ficha ya son reales en el backend (§9.3,
  // /admin/zonas) — una colonia creada después del build no está en esta
  // lista, pero `dynamicParams` en su default (true) la renderiza on-demand
  // en su primera visita y queda cacheada por `revalidate` de abajo, sin
  // necesitar rebuild.
  const zones = (await getAllZones()).map((z) => ({ slug: z.slug }));
  const municipalities = getAllMunicipalities().map((m) => ({ slug: m.slug }));
  return [...zones, ...municipalities];
}

// Los conteos/precios en vivo de más abajo sí dependen de Property (real
// desde esta fase) — ISR para que no se queden congelados en el valor del
// build.
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const zone = (await getZonesWithLiveStats()).find((z) => z.slug === slug);
  if (zone) return buildZoneMetadata(zone, 'zone');
  const municipality = (await getMunicipalitiesWithLiveStats()).find((m) => m.slug === slug);
  if (municipality) return buildZoneMetadata(municipality, 'municipality');
  return { title: 'Zona no encontrada | Vive Villahermosa' };
}

export default async function ZonaDetailPage({ params }: Props) {
  const { slug } = await params;

  // Stats en vivo (conteo y precio promedio calculados desde el catálogo
  // real, no el valor editorial fijo de zones.json/municipalities.json —
  // mismo dato que ya muestra el listado en /zonas, ver src/lib/api.ts).
  // Un slug de colonia tiene prioridad sobre uno de municipio (mismo orden de
  // antes). Se pregunta por la ficha de UNA colonia en vez de calcular las
  // estadísticas de todas, que obliga a traer el catálogo completo.
  const fichaColonia = await getZoneBySlug(slug);
  const zone = fichaColonia ? (await getZonesWithLiveStats()).find((z) => z.slug === slug) : undefined;
  const municipality = !fichaColonia ? getMunicipalityBySlug(slug) : undefined;

  if (!zone && !municipality) notFound();

  // Colonia: el catálogo completo (pocas propiedades por colonia). Municipio:
  // solo su primera tanda de TAMANO_PAGINA, y el resto bajo demanda desde el
  // navegador (ListaPropiedadesMunicipio) — sin traer todo el catálogo.
  const nombreMunicipioFiltro = municipality?.nombre.replace(' (Villahermosa)', '');
  let zoneProperties: Property[];
  let totalPropiedades: number;
  let markerSource: Property[];
  if (zone) {
    const allProperties = await getAllProperties();
    zoneProperties = allProperties.filter((p) => p.colonia.toLowerCase() === zone.nombre.toLowerCase());
    totalPropiedades = zoneProperties.length;
    markerSource = zoneProperties;
  } else {
    // Una sola llamada al backend (antes eran dos, la misma página=1 pedida
    // dos veces con distinto límite) — MAX_PINES_MAPA (50) ya cubre de sobra
    // TAMANO_PAGINA (12), así que las tarjetas son simplemente los primeros
    // 12 de la respuesta del mapa, sin pedirlos aparte.
    const pagina = await getPropertiesPage({ municipio: nombreMunicipioFiltro!, page: 1, limit: MAX_PINES_MAPA });
    zoneProperties = pagina.properties.slice(0, TAMANO_PAGINA);
    totalPropiedades = pagina.total;
    markerSource = pagina.properties;
  }

  const markers = markerSource.map((p) => ({
    id: p.id,
    slug: p.slug,
    // latPublico/lngPublico (enmascaradas), no lat/lng reales — mismo
    // criterio de privacidad que /mapa (MapaClient.tsx), este mapa se
    // había quedado con las coordenadas exactas sin la máscara.
    lat: p.latPublico,
    lng: p.lngPublico,
    titulo: p.titulo,
    precio: p.precio,
    operacion: p.operacion,
    tipo: p.tipo,
    colonia: p.colonia,
    foto: p.fotos[0] ?? null,
    riesgoInundacion: p.riesgoInundacion,
  }));

  const name = zone?.nombre ?? municipality!.nombre;
  const description = await resolverDescripcion(zone, municipality);
  const lat = zone?.lat ?? municipality!.lat;
  const lng = zone?.lng ?? municipality!.lng;
  const isMunicipality = !!municipality;
  const isCercaDosoBocas = municipality?.cercaDosoBocas ?? false;


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-brand">Inicio</Link>
        <ChevronRight size={14} />
        <Link href="/zonas" className="hover:text-brand">Zonas</Link>
        <ChevronRight size={14} />
        <span className="text-gray-700 font-medium">{name}</span>
      </nav>

      {/* .zona-grid (src/styles/globals.css) — móvil: orden = orden del DOM,
          tal cual aparece abajo (hero, side [buscar + video], estadística,
          propiedades, mapa, info) — pedido explícito 2026-09-22: no enterrar
          la búsqueda ni las propiedades reales bajo foto/texto/mapa. lg+:
          recompone las dos columnas de siempre vía grid-template-areas,
          sin tocar cómo se ve en escritorio. */}
      <div className="zona-grid">
          {/* Hero card — foto real (Wikimedia Commons) para municipios,
              antes un degradado sólido sin imagen. Las colonias (`zone`)
              no tienen foto propia, se quedan con el degradado + ícono.
              h-64 sm:h-80 (antes h-48 fijo) — pedido explícito 2026-08-19
              ("mejora el diseño"): con foto real de calidad, 192px se
              sentía corto/recortado; más alto deja respirar la imagen sin
              perder el título encima. */}
          <div className="zona-grid__hero relative h-64 sm:h-80 bg-gradient-to-br from-brand-dark to-brand rounded-3xl overflow-hidden animate-fade-up">
            {isMunicipality && municipality?.foto ? (
              <HeroFotoMunicipio src={municipality.foto} alt={name} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                {isMunicipality ? <MapIcon size={110} strokeWidth={1} /> : <Building2 size={110} strokeWidth={1} />}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  <MapPin size={10} />
                  {isMunicipality ? 'Municipio de Tabasco' : `Colonia · ${zone!.municipio}`}
                </span>
                {isCercaDosoBocas && (
                  <span className="bg-amber-500/90 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Zap size={10} /> Cerca Dos Bocas
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white drop-shadow-sm">{name}</h1>
            </div>
            {isMunicipality && municipality?.foto && (() => {
              const credito = MUNICIPIO_FOTO_CREDITO[municipality.id];
              return (
                <span className="absolute top-3 right-3 bg-black/25 backdrop-blur-sm text-white/80 text-[10px] px-2 py-1 rounded-full">
                  Foto: {credito?.autor ?? 'Wikimedia Commons'}
                  {credito?.licencia && (
                    <>
                      {' · '}
                      <a
                        href={credito.licencia.url}
                        target="_blank"
                        rel="noopener noreferrer license"
                        className="underline hover:text-white"
                      >
                        {credito.licencia.nombre}
                      </a>
                      {', adaptada'}
                    </>
                  )}
                  {' / '}
                  {credito?.fuente ? (
                    <a href={credito.fuente} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      Wikimedia Commons
                    </a>
                  ) : (
                    'Wikimedia Commons'
                  )}
                </span>
              );
            })()}
          </div>

          {/* Sidebar (área "side") — el botón de buscar y, en Centro, el
              video van SIEMPRE juntos: comparten un solo contenedor sticky,
              así que no se pueden separar sin romper ese comportamiento en
              escritorio. En móvil suben juntos a la posición 2 (justo tras
              el hero) — pedido explícito 2026-09-22: no enterrar la acción
              principal bajo foto/texto/mapa. */}
          {/* Sin sticky (ni en móvil ni en escritorio): el bloque de video en
              Centro es alto (~1500px con el resto de la columna) y, mientras
              seguía pegado, terminaba compartiendo espacio visible en pantalla
              con las tarjetas de propiedades que ya habían entrado por abajo
              — confirmado en vivo con un navegador real, pedido explícito
              2026-09-22: "esas secciones no deben de estar sticky". */}
          <div className="zona-grid__side space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-heading font-bold text-gray-800 mb-3">Buscar en {name}</h2>
              <Link
                href={`/propiedades?${isMunicipality ? `municipio=${encodeURIComponent(municipality!.nombre.replace(' (Villahermosa)', ''))}` : `q=${encodeURIComponent(zone!.nombre)}`}`}
                className="block w-full text-center bg-brand hover:bg-brand-dark text-white text-sm font-semibold py-3 rounded-xl transition-colors mb-2"
              >
                Ver todas en venta o renta
              </Link>
              <Link
                href={`/propiedades?${isMunicipality ? `municipio=${encodeURIComponent(municipality!.nombre.replace(' (Villahermosa)', ''))}&operacion=renta` : `q=${encodeURIComponent(zone!.nombre)}&operacion=renta`}`}
                className="block w-full text-center border-2 border-brand text-brand text-sm font-semibold py-2.5 rounded-xl hover:bg-brand-pale transition-colors"
              >
                Solo rentas
              </Link>
            </div>

            {municipality?.id === 'centro' && (
              <section
                aria-label="Video sobre Villahermosa y el agua"
                className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl ring-1 ring-brand-dark/40 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(56,189,248,0.28),transparent_55%),radial-gradient(90%_70%_at_0%_100%,rgba(181,100,58,0.30),transparent_60%),linear-gradient(160deg,#1D4A2C_0%,#0F2B1A_100%)]"
              >
                {/* Decoración: gotas y olas grandes, muy tenues, detrás del contenido. */}
                <Droplets aria-hidden="true" size={120} strokeWidth={1} className="pointer-events-none absolute -right-6 -top-6 text-white/10" />
                <Waves aria-hidden="true" size={150} strokeWidth={1} className="pointer-events-none absolute -bottom-8 -left-8 text-white/10" />

                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur-sm ring-1 ring-white/20">
                    <PlayCircle size={12} /> Video · 75 s
                  </span>
                  <h2 className="font-display font-black text-lg leading-snug mt-3 mb-1 text-balance">
                    Cómo Villahermosa sobrevive al asedio del agua
                  </h2>
                  <p className="text-xs text-white/70 mb-4">Una ciudad que aprendió a convivir con sus ríos.</p>

                  {/* Vertical (720×1280, 9:16): un marco 16:9 lo dejaría con barras negras. */}
                  <VideoConCorte
                    className="w-full max-w-[280px] mx-auto rounded-2xl bg-black aspect-[9/16] ring-1 ring-white/25 shadow-2xl shadow-black/50"
                    src="/videos/villahermosa-y-el-agua.mp4"
                    finSegundos={71.5}
                  >
                    Tu navegador no puede reproducir este video.
                  </VideoConCorte>
                </div>
              </section>
            )}

            {/* Antes decía "Tip de inversión" con afirmaciones de demanda/
                plusvalía sin ningún dato real detrás — el caso genérico
                (ninguna colonia catalogada como Dos Bocas o municipio)
                literalmente repetía la misma frase ("una de las zonas más
                consolidadas... buena plusvalía") para cualquier colonia,
                lo cual es falso para casi todas por definición. Ahora solo
                hechos verificables: ubicación real, sin adjetivos de
                oportunidad/demanda/plusvalía.
                Para municipios ya no se muestra si no hay nada real que
                decir (pedido explícito 2026-08-19): la frase genérica
                "conectado por carretera al centro del estado" quedaba
                repetida (y para Centro mismo, sin sentido — ES el centro)
                junto a la descripción real de arriba. Se queda solo el
                caso con dato real (Dos Bocas) o el de colonia (municipio
                al que pertenece, útil y no repetido en otro lado). */}
            {(isCercaDosoBocas || !isMunicipality) && (
              <div className="bg-brand-pale rounded-2xl p-4">
                <p className="text-xs font-semibold text-brand-dark mb-2 flex items-center gap-1">
                  <TrendingUp size={13} /> Sobre la zona
                </p>
                <p className="text-xs text-gray-600">
                  {isCercaDosoBocas
                    ? 'Ubicada cerca de la Refinería Dos Bocas / Pemex.'
                    : `${name} es una colonia del municipio de ${zone!.municipio}.`}
                </p>
              </div>
            )}
          </div>

          {/* Stats — para municipios (sin precio promedio de zona) un solo
              stat real existe, así que se muestra como tira ancha en vez
              de una grilla de 3 columnas con 2 huecos vacíos al lado
              (pedido explícito 2026-08-19). Las colonias con precios sí
              llenan la grilla de verdad. */}
          {zone && (zone.precioPromedioRenta > 0 || zone.precioPromedioVenta > 0) ? (
            <div className="zona-grid__stats grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-brand-pale rounded-2xl p-4 text-center">
                <p className="text-2xl font-display font-black text-brand">{totalPropiedades}</p>
                <p className="text-xs text-gray-600 mt-1">Propiedades</p>
              </div>
              {zone.precioPromedioRenta > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                  <p className="text-lg font-heading font-bold text-gray-800">
                    {formatPrice(zone.precioPromedioRenta, 'renta')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Renta promedio</p>
                </div>
              )}
              {zone.precioPromedioVenta > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                  <p className="text-lg font-heading font-bold text-gray-800">
                    {formatPrice(zone.precioPromedioVenta, 'venta')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Venta promedio</p>
                </div>
              )}
            </div>
          ) : (
            <div className="zona-grid__stats bg-brand-pale rounded-2xl p-4 flex items-center gap-4">
              <p className="text-2xl font-display font-black text-brand flex-shrink-0">{totalPropiedades}</p>
              <p className="text-xs text-gray-600">
                propiedad{totalPropiedades !== 1 ? 'es' : ''} publicada{totalPropiedades !== 1 ? 's' : ''} en {name}
              </p>
            </div>
          )}

          {/* Properties list (área "props") — pedido explícito 2026-09-22:
              sube a la posición 4 en móvil, antes era literalmente lo
              último de la página, después incluso del video. */}
          <div className="zona-grid__props">
            {zoneProperties.length > 0 ? (
              <section>
                <h2 className="text-xl font-heading font-bold text-gray-800 mb-5">
                  Propiedades en {name}
                </h2>
                {/* Misma grilla auto-fill que /propiedades (PROPERTY_GRID_CLASSES,
                    src/lib/gridClasses.ts, usada dentro de ListaPropiedadesMunicipio).
                    Municipio: de a TAMANO_PAGINA con "Ver más" (pedido 2026-09-21).
                    Colonia: ya trae todas, así que `total` = las que hay y el botón
                    no aparece. */}
                <ListaPropiedadesMunicipio
                  inicial={zoneProperties}
                  total={totalPropiedades}
                  municipio={nombreMunicipioFiltro ?? ''}
                  tamanoPagina={TAMANO_PAGINA}
                />
              </section>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-10 text-center">
                {/* Mascota 404 propia en vez del ícono genérico de construcción —
                    pedido explícito 2026-08-19, aplica a las 17 páginas de
                    municipio (y a colonia, mismo bloque compartido). */}
                <Image
                  src="/images/icons/404-mascota.webp"
                  alt=""
                  width={140}
                  height={87}
                  className="mx-auto mb-3"
                />
                <p className="font-semibold text-gray-700 mb-2">Próximamente en {name}</p>
                <p className="text-gray-500 text-sm mb-4">
                  Aún no hay propiedades publicadas en esta zona. ¿Tienes una? Publícala gratis.
                </p>
                <PublicarCTA
                  className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-brand-dark transition-colors"
                >
                  Publicar propiedad <ChevronRight size={16} />
                </PublicarCTA>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="zona-grid__map">
            <h2 className="font-heading font-bold text-gray-800 mb-3">Mapa de la zona</h2>
            <div className="h-64 rounded-2xl overflow-hidden border border-gray-200">
              {/* Sin pin "$0" inventado cuando no hay propiedades — pedido
                  explícito 2026-08-19: "no quiero que se vea nada... mas
                  que el solo mapa". `center`/`zoom` ya posicionan el mapa
                  sin necesitar un marcador falso. */}
              <ZoneMap markers={markers} center={[lat, lng]} zoom={isMunicipality ? 12 : 14} />
            </div>
          </div>

          {/* Description — en municipios con contenido ampliado
              (src/data/municipios-contenido.json) todo va unificado en esta
              misma tarjeta "Sobre el municipio". Última en móvil (posición
              6): es material de apoyo, no la acción ni el contenido
              principal de la página. */}
          {municipality && CONTENIDO_MUNICIPIOS[municipality.id] ? (
            <div className="zona-grid__info">
              <MunicipioContenidoView descripcion={description} contenido={CONTENIDO_MUNICIPIOS[municipality.id]} />
            </div>
          ) : (
            <div className="zona-grid__info bg-white rounded-2xl border border-gray-200 p-5 animate-fade-up" style={{ animationDelay: '60ms' }}>
              <h2 className="font-heading font-bold text-gray-800 mb-2">Sobre {isMunicipality ? 'el municipio' : 'la colonia'}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
            </div>
          )}
      </div>
    </div>
  );
}
