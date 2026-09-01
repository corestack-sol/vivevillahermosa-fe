import type { Property } from '@/types/property';
import type { SearchFilters } from '@/types/search';
import { getLandmark, distanciaKm, distanciaMinimaACategoria, RADIO_CATEGORIA_KM } from './landmarks';
import { matchColonia } from './colonias';
import { estaEnZonaDestacada } from './zonasDestacadas';
import { MUNICIPIO_CENTERS } from './publishSchema';

// Orden fijo, cero costo (sin geolocalización ni distancia real) — mismo
// orden de MUNICIPIO_CENTERS (Centro primero, resto por tamaño de mercado)
// que ya se usa en el selector de publicar. Evita que el orden por defecto
// de /propiedades muestre los municipios revueltos sin depender de la
// ubicación del usuario, que sería costoso a miles de usuarios (ver
// docs/BACKEND-ORDEN-MUNICIPIO-23082026.md).
const PRIORIDAD_MUNICIPIO: Record<string, number> = Object.fromEntries(
  Object.keys(MUNICIPIO_CENTERS).map((m, i) => [m, i])
);
function prioridadMunicipio(municipio: string): number {
  return PRIORIDAD_MUNICIPIO[municipio] ?? Object.keys(MUNICIPIO_CENTERS).length;
}

export function applyFilters(properties: Property[], filters: SearchFilters): Property[] {
  let result = [...properties];
  // Distancia real contra la que se mide "qué tan cerca" — se rellena en
  // los bloques de colonia/landmark/categoría de abajo (reusando la misma
  // resolución que ya hacen para filtrar, sin buscarla dos veces) y se usa
  // después para ordenar cuando la persona no pidió explícitamente otro
  // orden (ver `sortProperties` más abajo). Bug real reportado 2026-09-02:
  // "cerca de X" sí filtraba bien por radio, pero el orden final
  // (relevancia = municipio + destacado) no sabía nada de distancia — la
  // lista salía con las etiquetas "1.4km", "0.5km", "0.6km" revueltas en
  // vez de de menor a mayor.
  let distanciaOrden: ((p: Property) => number) | undefined;

  if (filters.q) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      (p) =>
        p.titulo.toLowerCase().includes(q) ||
        p.colonia.toLowerCase().includes(q) ||
        p.municipio.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q)
    );
  }

  if (filters.tipo) {
    result = result.filter((p) => p.tipo === filters.tipo);
  }

  if (filters.operacion) {
    result = result.filter((p) => p.operacion === filters.operacion);
  }

  if (filters.municipio) {
    result = result.filter(
      (p) => p.municipio.toLowerCase() === filters.municipio!.toLowerCase()
        || (filters.municipio === 'Centro' && p.municipio === 'Centro')
    );
  }

  if (filters.colonia) {
    // Distancia real cuando la colonia está catalogada con coordenadas
    // (src/lib/colonias.ts) — sin esto, "cerca de la col Magisterial"
    // nunca encontraba una propiedad a 220m si su campo `colonia` dice
    // "Framboyanes" (caso real reportado). Si no está catalogada, cae al
    // mismo match de texto de siempre — no se pierde cobertura, solo se
    // gana precisión donde ya la verificamos.
    const coord = matchColonia(filters.colonia, filters.municipio);
    if (coord) {
      distanciaOrden = (p) => distanciaKm(p.lat, p.lng, coord.lat, coord.lng);
      result = result.filter((p) => {
        if (distanciaKm(p.lat, p.lng, coord.lat, coord.lng) > coord.radioKm) return false;
        // Que el radio se traslape no basta: si la propiedad ya tiene su
        // PROPIA colonia catalogada y es una distinta a la buscada, no
        // cuenta como "cerca de X" — caso real confirmado (2026-08-08):
        // "locales cerca de Tabasco 2000" traía un local de Centro
        // Histórico, a solo 1.15km de distancia (dentro del radio de
        // 1.3km) pero con nombre e identidad propios, nada que ver con
        // Tabasco 2000. En el centro de Villahermosa las colonias
        // catalogadas están muy juntas entre sí, así que este cruce se
        // repite fácilmente con cualquier par de colonias vecinas — no es
        // un caso aislado de esta sola.
        const coloniaPropia = matchColonia(p.colonia, p.municipio);
        if (coloniaPropia && coloniaPropia.key !== coord.key) return false;
        return true;
      });
    } else {
      const q = filters.colonia.toLowerCase();
      result = result.filter(
        (p) =>
          p.titulo.toLowerCase().includes(q) ||
          p.colonia.toLowerCase().includes(q) ||
          p.municipio.toLowerCase().includes(q) ||
          p.descripcion.toLowerCase().includes(q)
      );
    }
  }

  if (filters.precioMin !== undefined && filters.precioMin > 0) {
    result = result.filter((p) => p.precio >= filters.precioMin!);
  }

  if (filters.precioMax !== undefined && filters.precioMax > 0) {
    result = result.filter((p) => p.precio <= filters.precioMax!);
  }

  if (filters.recamaras && filters.recamaras > 0) {
    result = result.filter((p) => p.recamaras >= filters.recamaras!);
  }

  if (filters.recamarasMax && filters.recamarasMax > 0) {
    result = result.filter((p) => p.recamaras <= filters.recamarasMax!);
  }

  if (filters.banos && filters.banos > 0) {
    result = result.filter((p) => p.banos >= filters.banos!);
  }

  if (filters.m2Min !== undefined && filters.m2Min > 0) {
    // Un terreno se mide por m2Terreno (m2Construidos es 0 casi siempre) —
    // todo lo demás se mide por lo construido, que es lo que la gente
    // pregunta al decir "de 200 metros" para una casa/depa.
    result = result.filter((p) => (p.tipo === 'terreno' ? p.m2Terreno : p.m2Construidos) >= filters.m2Min!);
  }

  if (filters.m2Max !== undefined && filters.m2Max > 0) {
    result = result.filter((p) => (p.tipo === 'terreno' ? p.m2Terreno : p.m2Construidos) <= filters.m2Max!);
  }

  if (filters.amenidad) {
    const a = filters.amenidad.toLowerCase();
    result = result.filter((p) => p.amenidades.some((am) => am.toLowerCase().includes(a)));
  }

  if (filters.riesgoInundacion) {
    result = result.filter((p) => p.riesgoInundacion === filters.riesgoInundacion);
  }

  if (filters.cercaDosoBocas) {
    result = result.filter((p) => p.cercaDosoBocas);
  }

  if (filters.landmark) {
    // Distancia geográfica real (Haversine), no coincidencia de texto — un
    // landmark como "Laguna de las Ilusiones" no es el nombre de ninguna
    // colonia, así que buscarlo como texto siempre daría cero resultados
    // aunque la propiedad esté literalmente enfrente.
    const landmark = getLandmark(filters.landmark);
    if (landmark) distanciaOrden = (p) => distanciaKm(p.lat, p.lng, landmark.lat, landmark.lng);
    // Bug real reportado 2026-08-20: "cerca del hospital rovirosa" devolvía
    // una propiedad a 48km — el catálogo de landmarks se carga async
    // (precargarLandmarks, fire-and-forget) y si la búsqueda corre antes de
    // que termine, getLandmark() no encuentra nada. Antes, sin `landmark`
    // el filtro simplemente no se aplicaba (`if (landmark) {...}` sin
    // `else`), así que la lista completa sin filtrar pasaba como si fuera
    // "cerca de" el lugar. Nunca hay que mostrar todo como si estuviera
    // verificado cuando en realidad no se pudo verificar nada — vacío es
    // el resultado honesto, no todo el catálogo.
    result = landmark
      ? result.filter((p) => distanciaKm(p.lat, p.lng, landmark.lat, landmark.lng) <= landmark.radioKm)
      : [];
  } else if (filters.categoriaLandmark) {
    // "Cerca de un hospital" sin nombrar cuál — distancia al más cercano de
    // todos los landmarks catalogados en esa categoría. Se ignora si ya hay
    // un landmark específico (arriba): un lugar nombrado es más preciso que
    // una categoría genérica, no tiene sentido aplicar ambos a la vez.
    const cat = filters.categoriaLandmark;
    distanciaOrden = (p) => distanciaMinimaACategoria(p.lat, p.lng, cat) ?? Infinity;
    result = result.filter((p) => {
      const d = distanciaMinimaACategoria(p.lat, p.lng, cat);
      return d !== null && d <= RADIO_CATEGORIA_KM;
    });
  }

  if (filters.zonaDestacada) {
    // "zona de alta plusvalía"/"zona exclusiva" — igual que landmark, es
    // distancia real a uno o más puntos ya verificados (ver
    // zonasDestacadas.ts), nunca coincidencia de texto contra el nombre de
    // la zona.
    const zona = filters.zonaDestacada;
    result = result.filter((p) => estaEnZonaDestacada(zona, p.lat, p.lng));
  }

  // Con un punto de referencia real (colonia/landmark/categoría) y sin que
  // la persona haya pedido explícitamente otro orden, "más cerca primero"
  // es más útil que el orden por defecto — ese default no sabía nada de
  // distancia, por eso las tarjetas salían con las etiquetas de km
  // revueltas (reporte real 2026-09-02). `comparadorCalidad` desempata
  // distancias iguales con las mismas señales que ya usa el orden general
  // (ver más abajo) en vez de dejarlo en un orden arbitrario.
  const sinOrdenExplicito = !filters.sort || filters.sort === 'relevancia';
  const ordenado = distanciaOrden && sinOrdenExplicito
    ? [...result].sort((a, b) => distanciaOrden!(a) - distanciaOrden!(b) || comparadorCalidad(a, b))
    : sortProperties(result, filters.sort ?? 'relevancia');

  // "limite" es un tope explícito pedido por la persona ("muéstrame 5
  // propiedades", "las 3 más baratas", "top 10") — se aplica DESPUÉS de
  // ordenar, nunca antes, para que "las 3 más baratas" de verdad sean las
  // 3 más baratas y no 3 propiedades al azar que luego se ordenan entre
  // sí. Distinto de la paginación de la UI (PER_PAGE en useSearch.ts): eso
  // es "cuántas cargar a la vez", esto es "cuántas existen en total" para
  // esta búsqueda.
  if (filters.limite && filters.limite > 0) {
    return ordenado.slice(0, filters.limite);
  }
  return ordenado;
}

function sortProperties(properties: Property[], sort: string): Property[] {
  switch (sort) {
    case 'precio-asc':
      return [...properties].sort((a, b) => a.precio - b.precio);
    case 'precio-desc':
      return [...properties].sort((a, b) => b.precio - a.precio);
    case 'reciente':
      return [...properties].sort(
        (a, b) => new Date(b.fechaPublicacion).getTime() - new Date(a.fechaPublicacion).getTime()
      );
    case 'colonia-asc':
      return [...properties].sort((a, b) => a.colonia.localeCompare(b.colonia, 'es'));
    case 'm2-desc':
      // Un terreno se mide por m2Terreno (m2Construidos es 0 casi siempre)
      // — mismo criterio que ya usan los filtros m2Min/m2Max arriba.
      return [...properties].sort((a, b) => tamano(b) - tamano(a));
    case 'm2-asc':
      return [...properties].sort((a, b) => tamano(a) - tamano(b));
    default:
      // Antes era solo municipio→destacado — un fallback "cero costo, sin
      // geolocalización" que no usaba ninguna señal real de calidad del
      // anuncio. Pedido explícito 2026-09-02: ordenar "como lo hacen las
      // grandes empresas" — destacado (visibilidad paga) primero, luego
      // completeness real (con fotos, nunca inventado — mismo criterio que
      // ya exige PublishForm.tsx desde el 2026-08-31), luego más reciente,
      // y recién al final el agrupado por municipio como desempate cuando
      // nada más distingue a dos propiedades — ya no es el criterio
      // principal, solo evita que el orden se vea aleatorio en un empate
      // total.
      return [...properties].sort(
        (a, b) => comparadorCalidad(a, b) || prioridadMunicipio(a.municipio) - prioridadMunicipio(b.municipio)
      );
  }
}

// Señales reales (nunca inventadas — ver docs/BACKEND-PENDIENTES: vistas/
// contactos siguen en 0 hasta que exista analítica real, así que nunca se
// usan aquí) compartidas por el orden por defecto y por el desempate del
// orden por distancia — así "destacado"/"con fotos"/"reciente" pesan igual
// sin importar si la búsqueda tenía un punto de referencia o no.
function comparadorCalidad(a: Property, b: Property): number {
  const porFeatured = (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  if (porFeatured !== 0) return porFeatured;
  const porFotos = (b.fotos.length > 0 ? 1 : 0) - (a.fotos.length > 0 ? 1 : 0);
  if (porFotos !== 0) return porFotos;
  return new Date(b.fechaPublicacion).getTime() - new Date(a.fechaPublicacion).getTime();
}

function tamano(p: Property): number {
  return p.tipo === 'terreno' ? p.m2Terreno : p.m2Construidos;
}

// Criterios que sí definen "qué tan cerca" está una propiedad de la
// búsqueda — deliberadamente excluye `q` (texto libre, ya cubierto por
// título/colonia/municipio/descripción dentro de cada criterio real) y
// `sort`/`limite`/`page` (esos son de PRESENTACIÓN, no de qué cuenta como
// una coincidencia).
type CriterioClave =
  | 'tipo' | 'operacion' | 'municipio' | 'colonia' | 'precioMin' | 'precioMax'
  | 'recamaras' | 'recamarasMax' | 'banos' | 'm2Min' | 'm2Max' | 'amenidad'
  | 'riesgoInundacion' | 'cercaDosoBocas' | 'landmark' | 'categoriaLandmark' | 'zonaDestacada';

function criteriosActivos(filters: SearchFilters): CriterioClave[] {
  const activos: CriterioClave[] = [];
  if (filters.tipo) activos.push('tipo');
  if (filters.operacion) activos.push('operacion');
  if (filters.municipio) activos.push('municipio');
  if (filters.colonia) activos.push('colonia');
  if (filters.precioMin && filters.precioMin > 0) activos.push('precioMin');
  if (filters.precioMax && filters.precioMax > 0) activos.push('precioMax');
  if (filters.recamaras && filters.recamaras > 0) activos.push('recamaras');
  if (filters.recamarasMax && filters.recamarasMax > 0) activos.push('recamarasMax');
  if (filters.banos && filters.banos > 0) activos.push('banos');
  if (filters.m2Min !== undefined && filters.m2Min > 0) activos.push('m2Min');
  if (filters.m2Max !== undefined && filters.m2Max > 0) activos.push('m2Max');
  if (filters.amenidad) activos.push('amenidad');
  if (filters.riesgoInundacion) activos.push('riesgoInundacion');
  if (filters.cercaDosoBocas) activos.push('cercaDosoBocas');
  if (filters.landmark) activos.push('landmark');
  else if (filters.categoriaLandmark) activos.push('categoriaLandmark');
  if (filters.zonaDestacada) activos.push('zonaDestacada');
  return activos;
}

// Mismo predicado que cada bloque de `applyFilters`, pero evaluado UNO A
// LA VEZ en vez de encadenado con AND — así una propiedad que cumple 4 de
// 5 criterios puntúa 4, no queda descartada por completo como en
// `applyFilters` (que la excluiría con solo fallar uno).
function cumpleCriterio(p: Property, filters: SearchFilters, criterio: CriterioClave): boolean {
  switch (criterio) {
    case 'tipo': return p.tipo === filters.tipo;
    case 'operacion': return p.operacion === filters.operacion;
    case 'municipio': return p.municipio.toLowerCase() === filters.municipio!.toLowerCase();
    case 'colonia': {
      const coord = matchColonia(filters.colonia!, filters.municipio);
      if (coord) return distanciaKm(p.lat, p.lng, coord.lat, coord.lng) <= coord.radioKm;
      const q = filters.colonia!.toLowerCase();
      return p.titulo.toLowerCase().includes(q) || p.colonia.toLowerCase().includes(q)
        || p.municipio.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q);
    }
    case 'precioMin': return p.precio >= filters.precioMin!;
    case 'precioMax': return p.precio <= filters.precioMax!;
    case 'recamaras': return p.recamaras >= filters.recamaras!;
    case 'recamarasMax': return p.recamaras <= filters.recamarasMax!;
    case 'banos': return p.banos >= filters.banos!;
    case 'm2Min': return tamano(p) >= filters.m2Min!;
    case 'm2Max': return tamano(p) <= filters.m2Max!;
    case 'amenidad': return p.amenidades.some((a) => a.toLowerCase().includes(filters.amenidad!.toLowerCase()));
    case 'riesgoInundacion': return p.riesgoInundacion === filters.riesgoInundacion;
    case 'cercaDosoBocas': return p.cercaDosoBocas;
    case 'landmark': {
      const landmark = getLandmark(filters.landmark!);
      return !!landmark && distanciaKm(p.lat, p.lng, landmark.lat, landmark.lng) <= landmark.radioKm;
    }
    case 'categoriaLandmark': {
      const d = distanciaMinimaACategoria(p.lat, p.lng, filters.categoriaLandmark!);
      return d !== null && d <= RADIO_CATEGORIA_KM;
    }
    case 'zonaDestacada': return estaEnZonaDestacada(filters.zonaDestacada!, p.lat, p.lng);
  }
}

// "tipo" y "operacion" nunca se relajan, ni siquiera en "todo lo demás" —
// caso real confirmado (2026-08-08): pedir "locales cerca de Tabasco 2000"
// mostraba casas/departamentos/terrenos ahí solo porque coincidían en
// colonia/precio/etc., aunque no fueran ni remotamente el tipo de
// propiedad pedido. Un local no es "parecido" a una casa solo por estar en
// la misma cuadra — son categorías distintas, no un mismo tipo con algún
// detalle de menos. Renta vs. venta es el mismo caso: son compromisos
// financieros distintos, no una variación menor. El resto de los
// criterios (ubicación exacta, precio, recámaras, m2, amenidad...) sí son
// razonables de relajar para un "lo más parecido que encontramos".
const CRITERIOS_DUROS: readonly CriterioClave[] = ['tipo', 'operacion'];

/**
 * "Todo lo demás" — propiedades que NO cumplen los filtros completos
 * (ya excluidas de `applyFilters`) pero sí coinciden con AL MENOS uno de
 * los criterios SUAVES activos, ordenadas por cuántos cumplen (más
 * coincidencias primero) — siempre respetando tipo/operación si se
 * pidieron (ver CRITERIOS_DUROS). Nunca reemplaza `applyFilters` — es un
 * complemento para no dejar a alguien viendo cero resultados relacionados
 * cuando su búsqueda fue razonable pero muy específica.
 */
export function getResultadosSimilares(
  properties: Property[],
  filters: SearchFilters,
  excluirIds: Set<string>,
  max: number
): Property[] {
  const criterios = criteriosActivos(filters);
  if (criterios.length === 0) return [];

  const duros = criterios.filter((c) => CRITERIOS_DUROS.includes(c));
  const suaves = criterios.filter((c) => !CRITERIOS_DUROS.includes(c));
  if (suaves.length === 0) return []; // solo pidió tipo/operación — no hay nada más "parecido" que ofrecer

  return properties
    .filter((p) => !excluirIds.has(p.id))
    .filter((p) => duros.every((c) => cumpleCriterio(p, filters, c)))
    .map((p) => ({ p, score: suaves.filter((c) => cumpleCriterio(p, filters, c)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.precio - b.p.precio)
    .slice(0, max)
    .map((x) => x.p);
}

export function paginateResults<T>(items: T[], page: number, perPage: number) {
  const start = (page - 1) * perPage;
  return {
    data: items.slice(start, start + perPage),
    total: items.length,
    page,
    perPage,
    totalPages: Math.ceil(items.length / perPage),
  };
}
