import type { Property, PropertiesResponse } from '@/types/property';
import type { Municipality, Zone } from '@/types/zone';
import type { Agent } from '@/types/agent';

import propertiesData from '@/data/properties.json';
import municipalitiesData from '@/data/municipalities.json';
import zonesData from '@/data/zones.json';
import agentsData from '@/data/agents.json';
import statsData from '@/data/stats.json';

// El JSON de muestra ya NO trae `lat`/`lng` reales — solo `latPublico`/
// `lngPublico` (centroide de colonia o jitter amplio, precalculados una
// vez, ver .tmp-migration/ en el historial de git y `getPuntoPublico` en
// colonias.ts). Es a propósito: este archivo se importa también desde
// componentes cliente (PropertyCard, SearchBar…), así que cualquier campo
// que viva aquí termina en el bundle del navegador tal cual — antes de
// este cambio, la coordenada exacta de cada propiedad viajaba a CUALQUIER
// página que rendericé una tarjeta, sin importar qué prop se le pasara a
// cada componente (enmascarar solo al construir los `markers` del mapa no
// alcanzaba, porque el JSON crudo con las coordenadas reales igual quedaba
// bundleado). Que el propio archivo fuente nunca tenga la coordenada real
// es la única forma de que de verdad no llegue al navegador.
type PropertySeed = Omit<Property, 'lat' | 'lng'>;
interface PropertiesSeedResponse {
  meta: PropertiesResponse['meta'];
  data: PropertySeed[];
}

// ⚠️ BACKEND PENDIENTE (docs/BACKEND.md §3 — el backend real es ahora un
// proyecto aparte, no Prisma dentro de este mismo archivo, ver el aviso de
// arquitectura al inicio del documento): esta
// capa entera lee un JSON estático, nunca una
// base de datos. `getAllProperties()` es la función más importante de
// reemplazar — todo lo demás en este archivo (getPropertyById,
// getFeaturedProperties, getPropertiesByMunicipality, getSimilarProperties,
// getPriceContext, las stats de municipios/zonas/colonias…) llama a esa
// función o filtra sobre su resultado, así que un solo cambio ahí (por
// `const res = await fetch(\`${API_URL}/propiedades\`)` contra el backend
// separado, en vez de `prisma.property.findMany` local) debería bastar
// para que el resto del archivo siga funcionando sin tocarlo — mismo
// patrón "quirúrgico" que ya usa src/lib/propiedadesLocales.ts para su
// propia simulación en localStorage,
// que hoy se le pega ENCIMA de este archivo del lado del cliente (ver
// aplicarOverridesPublicos/getMisPropiedadesConOverrides ahí) precisamente
// porque este archivo no puede leer nada creado/editado/eliminado por un
// usuario real. Con Property en Prisma, esa capa de merge en el cliente
// deja de hacer falta — el backend ya devolvería el dato correcto de una
// vez.
const PER_PAGE = 12;

/**
 * Fuente de verdad de verificación: el registro de agentes (agents.json), no la
 * copia embebida en cada propiedad. Evita que "Agente verificado" se muestre
 * para todos aunque el agente real no esté verificado.
 */
function getAgentVerification(whatsapp?: string): boolean {
  if (!whatsapp) return false;
  const agent = (agentsData as Agent[]).find((a) => a.whatsapp === whatsapp);
  return agent?.verificado ?? false;
}

export function getAllProperties(): Property[] {
  return (propertiesData as PropertiesSeedResponse).data
    .filter((p) => p.activa)
    .map((p) => ({
      ...p,
      // Mismo problema que ya se corrigió con lat/lng, aplicado a
      // tel/email/whatsapp: este archivo se importa también desde
      // componentes cliente (PropertyCard, SearchBar…), así que cualquier
      // campo que viva en el `agente` que se devuelve aquí termina en el
      // bundle del navegador de CUALQUIER página que muestre una tarjeta —
      // sin sesión, sin pasar por el botón "revelar contacto". Confirmado
      // en vivo: /propiedades sin iniciar sesión traía el teléfono/correo
      // real de cada agente repetido una vez por cada una de sus
      // propiedades. `agente.tel`/`email`/`whatsapp` se omiten a propósito
      // (quedan `undefined`, el tipo ya los declara opcionales) — el único
      // camino real para obtenerlos es `getAgenteContacto()` más abajo,
      // usado exclusivamente por el endpoint gateado por sesión
      // (GET /api/propiedades/[id]/contacto).
      agente: {
        nombre: p.agente.nombre,
        foto: p.agente.foto,
        verificado: getAgentVerification(p.agente.whatsapp),
      },
      // `lat`/`lng` del tipo `Property` quedan aquí como alias del punto
      // público — este archivo nunca tuvo ni tiene acceso a la coordenada
      // real de una propiedad de muestra, así que no hay nada más preciso
      // que copiar. Sigue siendo correcto usar `p.latPublico`/`p.lngPublico`
      // explícitamente en componentes de mapa (más a prueba de futuro si
      // algún día una propiedad SÍ trae coordenada real desde otro origen).
      lat: p.latPublico,
      lng: p.lngPublico,
    }));
}

/**
 * Único camino real para obtener el tel/email/whatsapp de contacto de una
 * propiedad de muestra — lee directo del JSON crudo (`propertiesData`),
 * nunca de `getAllProperties()`, que a propósito ya no los incluye (ver
 * comentario ahí arriba). Debe usarse SOLO desde código que corre
 * exclusivamente en el servidor y ya verificó sesión antes de llamarla
 * (hoy, únicamente `GET /api/propiedades/[id]/contacto`) — nunca desde un
 * componente cliente, ni siquiera indirectamente vía una función que
 * también use el resultado para otra cosa.
 */
export function getAgenteContacto(id: string): Pick<Property['agente'], 'tel' | 'email' | 'whatsapp'> | undefined {
  const seed = (propertiesData as PropertiesSeedResponse).data.find((p) => p.id === id || p.slug === id);
  if (!seed) return undefined;
  const { tel, email, whatsapp } = seed.agente;
  return { tel, email, whatsapp };
}

export function getFeaturedProperties(): Property[] {
  return getAllProperties().filter((p) => p.featured);
}

export function getPropertyById(id: string): Property | undefined {
  return getAllProperties().find((p) => p.id === id || p.slug === id);
}

export function getPropertiesByPage(page: number = 1): PropertiesResponse {
  const all = getAllProperties();
  const start = (page - 1) * PER_PAGE;
  return {
    meta: { total: all.length, page, perPage: PER_PAGE },
    data: all.slice(start, start + PER_PAGE),
  };
}

export function getPropertiesByMunicipality(municipioSlug: string): Property[] {
  const mun = getMunicipalityBySlug(municipioSlug);
  if (!mun) return [];
  return getAllProperties().filter(
    (p) => p.municipio.toLowerCase() === mun.nombre.replace(' (Villahermosa)', '').toLowerCase()
      || p.municipio === 'Centro' && municipioSlug === 'villahermosa'
  );
}

export function getSimilarProperties(property: Property, limit = 3): Property[] {
  return getAllProperties()
    .filter(
      (p) =>
        p.id !== property.id &&
        p.tipo === property.tipo &&
        p.operacion === property.operacion
    )
    .slice(0, limit);
}

export function getAllMunicipalities(): Municipality[] {
  return municipalitiesData as Municipality[];
}

export function getMunicipalityBySlug(slug: string): Municipality | undefined {
  return getAllMunicipalities().find((m) => m.slug === slug);
}

export function getAllZones(): Zone[] {
  return zonesData as Zone[];
}

export function getFeaturedZones(): Zone[] {
  return getAllZones().filter((z) => z.destacada);
}

export function getZoneBySlug(slug: string): Zone | undefined {
  return getAllZones().find((z) => z.slug === slug);
}

function propertiesInMunicipality(all: Property[], m: Municipality): Property[] {
  const nombreBase = m.nombre.replace(' (Villahermosa)', '');
  return all.filter(
    (p) => p.municipio.toLowerCase() === nombreBase.toLowerCase()
      || (m.slug === 'villahermosa' && p.municipio === 'Centro')
  );
}

function propertiesInZone(all: Property[], z: Zone): Property[] {
  return all.filter((p) => p.colonia.toLowerCase() === z.nombre.toLowerCase());
}

/**
 * `propiedades`/`precioPromedio*` en zones.json y municipalities.json son
 * valores editoriales fijos, capturados a mano cuando se armó el catálogo de
 * muestra — no se recalculan solos según crece `properties.json`. La ficha
 * de cada zona (`/zonas/[slug]`) ya calculaba su conteo en vivo; estas
 * funciones lo hacen también disponible para el listado (`/zonas`), y caen
 * de vuelta al valor editorial solo cuando de verdad no hay propiedades
 * reales que promediar (para no mostrar $0).
 *
 * Los municipios (`getMunicipalitiesWithLiveStats`) NO tienen precio
 * promedio — se quitó a propósito: con 1-2 propiedades por municipio en el
 * catálogo, un "promedio" no es más que el precio de esa única propiedad
 * disfrazado de estadística de mercado, y el valor editorial de respaldo
 * tampoco salía de ningún dato real. Mismo criterio que ya exige
 * `getPriceContext` (`totalComparables >= 2` antes de decir algo) — aquí,
 * en vez de imponer un mínimo de muestra, se decidió no mostrar ningún
 * precio a nivel municipio por ahora.
 */
export function getMunicipalitiesWithLiveStats(): Municipality[] {
  const all = getAllProperties();
  return getAllMunicipalities().map((m) => {
    const props = propertiesInMunicipality(all, m);
    return { ...m, propiedades: props.length };
  });
}

export function getZonesWithLiveStats(): Zone[] {
  const all = getAllProperties();
  return getAllZones().map((z) => {
    const props = propertiesInZone(all, z);
    // Mismo caso que getMunicipalitiesWithLiveStats de arriba: zones.json
    // trae precios editoriales fijos que hay que apagar si de verdad no
    // queda ninguna propiedad real detrás — no visible hoy (ninguna zona
    // del catálogo de muestra tiene 0), pero es el mismo bug latente si una
    // colonia se queda sin propiedades activas.
    if (props.length === 0) return { ...z, propiedades: 0, precioPromedioRenta: 0, precioPromedioVenta: 0 };
    const rentas = props.filter((p) => p.operacion === 'renta').map((p) => p.precio);
    const ventas = props.filter((p) => p.operacion === 'venta').map((p) => p.precio);
    return {
      ...z,
      propiedades: props.length,
      precioPromedioRenta: rentas.length ? Math.round(rentas.reduce((a, b) => a + b, 0) / rentas.length) : z.precioPromedioRenta,
      precioPromedioVenta: ventas.length ? Math.round(ventas.reduce((a, b) => a + b, 0) / ventas.length) : z.precioPromedioVenta,
    };
  });
}

export interface ColoniaCard {
  nombre: string;
  /** null si la colonia no tiene ficha editorial en zones.json — enlaza a /propiedades?q= en vez de /zonas/[slug]. */
  slug: string | null;
  municipio: string;
  descripcion: string | null;
  propiedades: number;
  precioPromedioRenta: number | null;
}

/**
 * Todas las colonias con propiedades reales — tengan o no ficha editorial
 * en zones.json —, ordenadas de mayor a menor por cantidad de propiedades.
 * Es la fuente única para decidir qué colonias se ven como tarjeta grande
 * en /zonas y cuáles como chip: no depende de curación manual (`destacada`),
 * así que según crece el catálogo el orden se recalcula solo, sin que nadie
 * tenga que tocar zones.json. Las colonias sin propiedades no aparecen —
 * una tarjeta o chip que lleva a "nada" no le sirve a nadie.
 *
 * Ranking por OFERTA (cuántas propiedades activas tiene la colonia), no por
 * DEMANDA (búsquedas/vistas/contactos) — ese segundo dato no existe todavía
 * en la plataforma, ver docs/BACKEND.md §9 para el requisito real ("colonias
 * más solicitadas del momento").
 */
export function getColoniasRankedByPropiedades(): ColoniaCard[] {
  const all = getAllProperties();
  const curatedByName = new Map(getAllZones().map((z) => [z.nombre.toLowerCase(), z]));

  const porColonia = new Map<string, { nombre: string; municipio: string; propiedades: number; rentas: number[] }>();
  for (const p of all) {
    const key = p.colonia.toLowerCase();
    const entry = porColonia.get(key) ?? { nombre: p.colonia, municipio: p.municipio, propiedades: 0, rentas: [] };
    entry.propiedades += 1;
    if (p.operacion === 'renta') entry.rentas.push(p.precio);
    porColonia.set(key, entry);
  }

  const cards: ColoniaCard[] = Array.from(porColonia.entries()).map(([key, info]) => {
    const curated = curatedByName.get(key);
    const precioPromedioRenta = info.rentas.length
      ? Math.round(info.rentas.reduce((a, b) => a + b, 0) / info.rentas.length)
      : curated?.precioPromedioRenta ?? null;
    return {
      nombre: curated?.nombre ?? info.nombre,
      slug: curated?.slug ?? null,
      municipio: curated?.municipio ?? info.municipio,
      descripcion: curated?.descripcion ?? null,
      propiedades: info.propiedades,
      precioPromedioRenta,
    };
  });

  return cards.sort((a, b) => b.propiedades - a.propiedades || a.nombre.localeCompare(b.nombre, 'es'));
}

export function getAllAgents(): Agent[] {
  return agentsData as Agent[];
}

export function getStats() {
  return statsData;
}

export interface PriceContext {
  precioPorM2: number | null;
  promedioZona: number | null;
  totalComparables: number;
  m2Ref: number;
}

export function getPriceContext(property: Property): PriceContext {
  const m2Ref = property.tipo === 'terreno'
    ? property.m2Terreno
    : property.m2Construidos;

  if (!m2Ref || m2Ref <= 0) {
    return { precioPorM2: null, promedioZona: null, totalComparables: 0, m2Ref: 0 };
  }

  const precioPorM2 = Math.round(property.precio / m2Ref);

  const comparables = getAllProperties().filter((p) =>
    p.id !== property.id &&
    p.tipo === property.tipo &&
    p.operacion === property.operacion &&
    p.municipio === property.municipio &&
    (property.tipo === 'terreno' ? p.m2Terreno > 0 : p.m2Construidos > 0)
  );

  if (comparables.length === 0) {
    return { precioPorM2, promedioZona: null, totalComparables: 0, m2Ref };
  }

  const sum = comparables.reduce((acc, p) => {
    const m2 = property.tipo === 'terreno' ? p.m2Terreno : p.m2Construidos;
    return acc + p.precio / m2;
  }, 0);

  return {
    precioPorM2,
    promedioZona: Math.round(sum / comparables.length),
    totalComparables: comparables.length,
    m2Ref,
  };
}
