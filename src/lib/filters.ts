import type { Property } from '@/types/property';
import type { SearchFilters } from '@/types/search';
import { getLandmark, distanciaKm, distanciaMinimaACategoria, RADIO_CATEGORIA_KM } from './landmarks';
import { matchColonia } from './colonias';
import { estaEnZonaDestacada } from './zonasDestacadas';

export function applyFilters(properties: Property[], filters: SearchFilters): Property[] {
  let result = [...properties];

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
    const coord = matchColonia(filters.colonia);
    if (coord) {
      result = result.filter((p) => distanciaKm(p.lat, p.lng, coord.lat, coord.lng) <= coord.radioKm);
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
    if (landmark) {
      result = result.filter((p) => distanciaKm(p.lat, p.lng, landmark.lat, landmark.lng) <= landmark.radioKm);
    }
  } else if (filters.categoriaLandmark) {
    // "Cerca de un hospital" sin nombrar cuál — distancia al más cercano de
    // todos los landmarks catalogados en esa categoría. Se ignora si ya hay
    // un landmark específico (arriba): un lugar nombrado es más preciso que
    // una categoría genérica, no tiene sentido aplicar ambos a la vez.
    const cat = filters.categoriaLandmark;
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

  return sortProperties(result, filters.sort ?? 'relevancia');
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
    default:
      return [...properties].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }
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
