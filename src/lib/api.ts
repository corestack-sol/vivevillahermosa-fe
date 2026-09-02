import type { FloodRisk, OperationType, Property, PropertyType } from '@/types/property';
import type { Municipality, Zone } from '@/types/zone';
import type { Agent } from '@/types/agent';

import municipalitiesData from '@/data/municipalities.json';
import agentsData from '@/data/agents.json';
import { backendFetch } from '@/lib/backendApi';
import { distanciaKm } from '@/lib/landmarks';

// ⚠️ 2026-08-10 (docs/BACKEND.md §3): Property ya es real en el backend
// separado — esta capa le hace fetch a GET /propiedades en vez de leer
// src/data/properties.json. `getAllProperties()` sigue siendo la función
// bisagra (todo lo demás llama a esa o filtra su resultado), pero ahora es
// async. `all=true` trae el catálogo activo completo sin paginar — el mismo
// parámetro que ya usan internamente sitemap.ts y las stats de zona/colonia
// de más abajo; la búsqueda server-side con filtros reales (landmark, zona
// destacada, etc., ya soportados por el backend) queda pendiente como
// optimización futura, no bloqueante — el filtrado client-side existente
// (src/lib/filters.ts) sigue funcionando igual sobre datos reales.
//
export interface BackendPublicProperty {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  tipo: PropertyType;
  operacion: OperationType;
  precio: number;
  m2Construidos: number | null;
  m2Terreno: number | null;
  recamaras: number | null;
  banos: number | null;
  mediosBanos: number | null;
  estacionamientos: number | null;
  antiguedad: number | null;
  amenidades: string[];
  servicios: string[];
  fotos: string[];
  municipio: string;
  colonia: string;
  direccion: string;
  latPublico: number;
  lngPublico: number;
  riesgoInundacion: FloodRisk;
  zonaEcologica: boolean;
  cercaDosoBocas: boolean;
  featured: boolean;
  estado: string;
  activa: boolean;
  agente: { nombre: string; foto: string | null; verificado: boolean; enRevision: boolean };
  createdAt: string;
  updatedAt: string;
  // Presentes SOLO cuando GET /propiedades/:id lo devuelve a su propio
  // dueño (OwnerProperty en el backend) — ausentes en la vista pública.
  lat?: number;
  lng?: number;
  alertaFraude?: { señales: string[] } | null;
  agenteTel?: string | null;
  agenteEmail?: string | null;
  agenteWhatsapp?: string | null;
  requiereMensajePrimero?: boolean;
  // Presentes solo cuando el backend ya tiene tabla de eventos real (ver
  // docs/BACKEND-VISTAS-CONTACTOS-02092026.md, pedido explícito
  // 2026-09-02) — `undefined` hasta entonces, mapMiaBackend() lo trata
  // como 0 en vez de inventar un número. `contactosReales` (no
  // `contactos`) para coincidir con el nombre que OwnerActionsBar.tsx ya
  // esperaba desde antes (ver su `MiaBackend.contactosReales`) — dos
  // nombres distintos para el mismo dato hubiera sido confuso para el
  // backend al implementarlo.
  vistas?: number;
  contactosReales?: number;
}

export function mapBackendProperty(bp: BackendPublicProperty): Property {
  return {
    id: bp.id,
    slug: bp.slug,
    titulo: bp.titulo,
    descripcion: bp.descripcion,
    tipo: bp.tipo,
    operacion: bp.operacion,
    precio: bp.precio,
    moneda: 'MXN',
    m2Construidos: bp.m2Construidos ?? 0,
    m2Terreno: bp.m2Terreno ?? 0,
    recamaras: bp.recamaras ?? 0,
    banos: bp.banos ?? 0,
    mediosBanos: bp.mediosBanos ?? 0,
    estacionamientos: bp.estacionamientos ?? 0,
    antiguedad: bp.antiguedad ?? 0,
    amenidades: bp.amenidades,
    servicios: bp.servicios,
    fotos: bp.fotos,
    municipio: bp.municipio,
    colonia: bp.colonia,
    direccion: bp.direccion,
    // lat/lng reales solo llegan cuando el backend confirmó que quien pide
    // esta propiedad es su propio dueño — para cualquier otro caso, mismo
    // criterio que ya tenía este archivo con el JSON estático: nunca más
    // preciso que el punto público.
    lat: bp.lat ?? bp.latPublico,
    lng: bp.lng ?? bp.lngPublico,
    latPublico: bp.latPublico,
    lngPublico: bp.lngPublico,
    riesgoInundacion: bp.riesgoInundacion,
    zonaEcologica: bp.zonaEcologica,
    cercaDosoBocas: bp.cercaDosoBocas,
    featured: bp.featured,
    alertaFraude: bp.alertaFraude ?? undefined,
    agente: {
      nombre: bp.agente.nombre,
      foto: bp.agente.foto ?? '',
      verificado: bp.agente.verificado,
      enRevision: bp.agente.enRevision,
      tel: bp.agenteTel ?? undefined,
      email: bp.agenteEmail ?? undefined,
      whatsapp: bp.agenteWhatsapp ?? undefined,
    },
    requiereMensajePrimero: bp.requiereMensajePrimero,
    fechaPublicacion: bp.createdAt,
    activa: bp.activa,
  };
}

export async function getAllProperties(): Promise<Property[]> {
  const { propiedades } = await backendFetch<{
    propiedades: BackendPublicProperty[];
  }>('/propiedades?all=true');
  return propiedades.map(mapBackendProperty);
}

/**
 * Igual que `getAllProperties()`, pero acotado a un área geográfica —
 * pedido explícito 2026-08-23: `/mapa` traía el catálogo COMPLETO en cada
 * carga de página (`?all=true`, sin límite), algo que deja de ser viable
 * cuando haya cientos/miles de propiedades activas.
 *
 * Se manda `all=true` junto con los límites del área — ⚠️ verificado en
 * vivo 2026-08-26: el backend YA filtra de verdad por estos parámetros
 * (probado con 3 recuadros de distinto tamaño, el conteo bajó de 28 a 7 a
 * 2 según se cerró el área) a pesar del `all=true` — este comentario antes
 * decía que el backend los ignoraba, quedó desactualizado, ver
 * docs/BACKEND-PENDIENTES-30082026.md §3.
 */
export async function getPropertiesInBounds(bounds: { north: number; south: number; east: number; west: number }): Promise<Property[]> {
  const qs = new URLSearchParams({
    all: 'true',
    swLat: String(bounds.south),
    swLng: String(bounds.west),
    neLat: String(bounds.north),
    neLng: String(bounds.east),
  });
  const { propiedades } = await backendFetch<{
    propiedades: BackendPublicProperty[];
  }>(`/propiedades?${qs.toString()}`);
  return propiedades.map(mapBackendProperty);
}

/** Ver docs/BACKEND-PROPIEDADES-PAGINACION-23082026.md — mismos nombres de campo. */
export interface PropertiesSearchParams {
  page?: number;
  limit?: number;
  tipo?: string;
  operacion?: string;
  municipio?: string;
  precioMin?: number;
  precioMax?: number;
  recamaras?: number;
  recamarasMax?: number;
  banos?: number;
  m2Min?: number;
  m2Max?: number;
  riesgoInundacion?: string;
  cercaDosoBocas?: boolean;
  q?: string;
  sort?: string;
  /** Proximidad a un punto ya resuelto (colonia/landmark) — nunca un nombre, ver el doc §3. */
  nearLat?: number;
  nearLng?: number;
  nearRadiusKm?: number;
}

/**
 * `/propiedades` con paginación y filtros reales — pedido explícito
 * 2026-08-23, mismo motivo que `getPropertiesInBounds()`: a cientos/miles
 * de propiedades activas, traer el catálogo completo en cada visita a
 * `/propiedades` deja de ser viable. Ver
 * docs/BACKEND-PROPIEDADES-PAGINACION-23082026.md para el contrato
 * completo (incluye qué filtros quedaron fuera de esta primera pasada a
 * propósito — zonaDestacada, amenidad, "todo lo demás").
 *
 * Mismo criterio de seguridad que `getPropertiesInBounds()`: se manda
 * `all=true` junto con los parámetros nuevos — el backend hoy los ignora y
 * devuelve el catálogo completo (`total` ausente, se usa
 * `propiedades.length` como respaldo), cero regresión mientras no lo
 * implemente.
 */
export async function searchProperties(params: PropertiesSearchParams): Promise<{ properties: Property[]; total: number }> {
  const qs = new URLSearchParams({ all: 'true' });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const { propiedades, total } = await backendFetch<{
    propiedades: BackendPublicProperty[];
    total?: number;
  }>(`/propiedades?${qs.toString()}`);
  return { properties: propiedades.map(mapBackendProperty), total: total ?? propiedades.length };
}

export async function getFeaturedProperties(): Promise<Property[]> {
  return (await getAllProperties()).filter((p) => p.featured);
}

export async function getPropertyById(id: string): Promise<Property | undefined> {
  try {
    const bp = await backendFetch<BackendPublicProperty>(
      `/propiedades/${encodeURIComponent(id)}`,
    );
    return mapBackendProperty(bp);
  } catch {
    return undefined;
  }
}

// ±25% de tolerancia para "precio parecido" / "tamaño parecido" — igual de
// laxo en ambos, no hay una razón para que uno sea más estricto que el otro.
const SIMILAR_TOLERANCIA = 0.25;

function dentroDeTolerancia(valor: number, base: number, tolerancia: number): boolean {
  return base > 0 && Math.abs(valor - base) / base <= tolerancia;
}

// Puntúa qué tan parecida es `p` a la propiedad que se está viendo — mismo
// espíritu que el scoring de getResultadosSimilares en filters.ts (más
// coincidencias primero), pero comparado contra los valores de ESTA
// propiedad en vez de contra filtros de búsqueda activos (esta función no
// recibe SearchFilters, solo la propiedad). Colonia/municipio son
// acumulativos, no alternativos: mismo municipio ya suma, mismo colonia
// (que implica mismo municipio) suma más encima, no en su lugar.
function scoreSimilitud(p: Property, base: Property): number {
  let score = 0;
  if (p.municipio === base.municipio) {
    score += 3;
    if (p.colonia.toLowerCase() === base.colonia.toLowerCase()) score += 2;
  }
  if (dentroDeTolerancia(p.precio, base.precio, SIMILAR_TOLERANCIA)) score += 2;
  if (base.recamaras > 0 && p.recamaras === base.recamaras) score += 1;
  if (base.banos > 0 && p.banos === base.banos) score += 1;
  if (dentroDeTolerancia(p.m2Construidos, base.m2Construidos, SIMILAR_TOLERANCIA)) score += 1;
  return score;
}

export async function getSimilarProperties(property: Property, limit = 3): Promise<Property[]> {
  // tipo/operación siguen siendo el único filtro duro (mismo criterio que
  // CRITERIOS_DUROS en filters.ts) — un local no es "parecido" a una casa
  // solo por estar en la misma colonia o tener precio similar.
  const { propiedades } = await backendFetch<{ propiedades: BackendPublicProperty[] }>(
    `/propiedades?all=true&tipo=${encodeURIComponent(property.tipo)}&operacion=${encodeURIComponent(property.operacion)}`,
  );
  const candidatos = propiedades
    .map(mapBackendProperty)
    .filter((p) => p.id !== property.id);

  return candidatos
    .map((p) => ({ p, score: scoreSimilitud(p, property) }))
    .sort((a, b) => b.score - a.score || Math.abs(a.p.precio - property.precio) - Math.abs(b.p.precio - property.precio))
    .slice(0, limit)
    .map((x) => x.p);
}

export function getAllMunicipalities(): Municipality[] {
  return municipalitiesData as Municipality[];
}

export function getMunicipalityBySlug(slug: string): Municipality | undefined {
  return getAllMunicipalities().find((m) => m.slug === slug);
}

/** Forma real de GET /zonas/colonias — backend, ver AdminColoniasService/ZonasService. */
interface BackendColoniaFicha {
  id: string;
  slug: string;
  nombre: string;
  municipio: string;
  lat: number;
  lng: number;
  foto: string | null;
  destacada: boolean;
}

/**
 * BACKEND.md §9.3 — catálogo de colonias con ficha editorial, curado a mano
 * desde /admin/zonas (Opción B: nunca se genera solo desde el ranking de
 * demanda, ver AdminColoniasService.pendientes). Antes zones.json estático;
 * `descripcion`/`propiedades`/`precioPromedio*` siguen sin persistirse acá
 * (se calculan en runtime, ver getZonesWithLiveStats/resolverDescripcion en
 * zonas/[slug]/page.tsx) — placeholders honestos, nunca un valor editorial
 * fijo que pueda quedar desactualizado.
 */
function mapColoniaFichaToZone(c: BackendColoniaFicha): Zone {
  return {
    id: c.id,
    nombre: c.nombre,
    slug: c.slug,
    municipio: c.municipio,
    lat: c.lat,
    lng: c.lng,
    propiedades: 0,
    precioPromedioRenta: 0,
    precioPromedioVenta: 0,
    descripcion: `${c.nombre} es una colonia del municipio de ${c.municipio}, Tabasco.`,
    foto: c.foto ?? '',
    destacada: c.destacada,
  };
}

export async function getAllZones(): Promise<Zone[]> {
  const colonias = await backendFetch<BackendColoniaFicha[]>('/zonas/colonias');
  return colonias.map(mapColoniaFichaToZone);
}

export async function getZoneBySlug(slug: string): Promise<Zone | undefined> {
  try {
    const colonia = await backendFetch<BackendColoniaFicha>(
      `/zonas/colonias/${encodeURIComponent(slug)}`,
    );
    return mapColoniaFichaToZone(colonia);
  } catch {
    return undefined;
  }
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
 * `propiedades` en municipalities.json es un valor editorial fijo (§9.3
 * todavía no migró los municipios, solo las colonias con ficha — ver
 * getAllZones). Esta función solo recalcula el conteo en vivo contra
 * Property, que sí es real desde esta fase.
 */
export async function getMunicipalitiesWithLiveStats(): Promise<Municipality[]> {
  const all = await getAllProperties();
  return getAllMunicipalities().map((m) => {
    const props = propertiesInMunicipality(all, m);
    return { ...m, propiedades: props.length };
  });
}

export async function getZonesWithLiveStats(): Promise<Zone[]> {
  const [all, zones] = await Promise.all([getAllProperties(), getAllZones()]);
  return zones.map((z) => {
    const props = propertiesInZone(all, z);
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
  /** null si la colonia no tiene ficha editorial (§9.3, /admin/zonas) — enlaza a /propiedades?q= en vez de /zonas/[slug]. */
  slug: string | null;
  municipio: string;
  descripcion: string | null;
  propiedades: number;
  precioPromedioRenta: number | null;
}

function normalizarNombreMunicipio(s: string): string {
  // "Centro (Villahermosa)" (municipalities.json) vs. "Centro" (Property.municipio)
  // — se les quita el paréntesis antes de comparar.
  return s.replace(/\s*\([^)]*\)\s*/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const CENTRO_MUNICIPIO = municipalitiesData.find((m) => m.id === 'centro')!;

// Distancia real (Haversine, mismo helper que src/lib/landmarks.ts) de cada
// municipio al Centro — pedido explícito 2026-08-19: "las colonias más
// buscadas" deben agruparse primero por Centro, luego por municipio del más
// cercano al más lejano, en vez de una lista plana por demanda/oferta.
const DISTANCIA_MUNICIPIO_DESDE_CENTRO = new Map<string, number>(
  municipalitiesData.map((m) => [
    normalizarNombreMunicipio(m.nombre),
    distanciaKm(CENTRO_MUNICIPIO.lat, CENTRO_MUNICIPIO.lng, m.lat, m.lng),
  ]),
);

/** Infinity para un municipio sin coordenadas conocidas — se va al final, no rompe el orden del resto. */
function distanciaMunicipioDesdeCentro(nombreMunicipio: string): number {
  return DISTANCIA_MUNICIPIO_DESDE_CENTRO.get(normalizarNombreMunicipio(nombreMunicipio)) ?? Infinity;
}

/**
 * Todas las colonias con propiedades reales — tengan o no ficha editorial
 * curada en /admin/zonas —, ordenadas de mayor a menor por cantidad de
 * propiedades. Ranking por OFERTA (cuántas propiedades activas tiene la
 * colonia) — para DEMANDA (búsquedas/vistas/contactos reales), ver
 * `getColoniasOrdenadasPorDemanda` más abajo (BACKEND.md §9.1).
 *
 * A propósito NO agrupa por cercanía a Centro (a diferencia de
 * `getColoniasOrdenadasPorDemanda`) — MapaClient.tsx la usa para "Ir a
 * zona", donde lo que importa es volar al mercado con más oferta real, no
 * mostrar Centro primero.
 */
export async function getColoniasRankedByPropiedades(): Promise<ColoniaCard[]> {
  const [all, zones] = await Promise.all([getAllProperties(), getAllZones()]);
  const curatedByName = new Map(zones.map((z) => [z.nombre.toLowerCase(), z]));

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

interface ColoniaTendencia {
  colonia: string;
  municipio: string | null;
  total: number;
}

function normalizarNombreParaTendencia(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** GET /colonias/tendencia (BACKEND.md §9.1) — si falla, un arreglo vacío hace que getColoniasOrdenadasPorDemanda caiga honestamente a oferta. */
async function obtenerTendenciaColonias(): Promise<ColoniaTendencia[]> {
  try {
    return await backendFetch<ColoniaTendencia[]>('/colonias/tendencia');
  } catch {
    return [];
  }
}

export interface ColoniasOrdenadasPorDemanda {
  colonias: ColoniaCard[];
  /**
   * false cuando todavía no hay ningún evento real de demanda (plataforma
   * recién desplegada, o falló la llamada al backend) — en ese caso
   * `colonias` cae a la misma lista/orden de `getColoniasRankedByPropiedades`
   * (por oferta) y `tieneDemandaReal` siempre da false. Quien consuma esto
   * debe usar este flag para decidir qué texto mostrar ("más buscadas"
   * vs. "con más propiedades") — nunca afirmar demanda real cuando en
   * realidad se está mostrando el respaldo por oferta.
   */
  porDemanda: boolean;
  /** true para cualquier colonia con demanda real registrada (total > 0 en /colonias/tendencia) — pedido explícito 2026-08-19: la llama debe verse en todas las cards que de verdad tienen búsquedas, no solo la primera. */
  tieneDemandaReal(nombre: string): boolean;
}

/**
 * BACKEND.md §9.1 — mismo catálogo/datos de tarjeta que
 * `getColoniasRankedByPropiedades` (descripción, precio promedio, conteo),
 * pero reordenado por DEMANDA real (búsquedas con IA + vistas + contactos de
 * los últimos 7 días, ver /ia/busqueda-inteligente y
 * /propiedades/:id(/contacto) del backend) en vez de por oferta. En ambos
 * casos (con o sin demanda real) se agrupa primero por cercanía real del
 * municipio al Centro — Centro primero, luego el resto de más cerca a más
 * lejos — pedido explícito 2026-08-19: "las colonias más buscadas" en
 * /zonas y Home deben mostrar primero la capital y expandirse hacia afuera,
 * no una lista plana por demanda/oferta sin ningún criterio geográfico.
 */
export async function getColoniasOrdenadasPorDemanda(): Promise<ColoniasOrdenadasPorDemanda> {
  const [coloniasRanked, tendencia] = await Promise.all([
    getColoniasRankedByPropiedades(),
    obtenerTendenciaColonias(),
  ]);

  const porCercaniaYOferta = [...coloniasRanked].sort((a, b) => {
    const distancia = distanciaMunicipioDesdeCentro(a.municipio) - distanciaMunicipioDesdeCentro(b.municipio);
    return distancia !== 0 ? distancia : b.propiedades - a.propiedades;
  });

  const maxTendencia = tendencia.reduce((max, t) => Math.max(max, t.total), 0);
  if (maxTendencia === 0) {
    return {
      colonias: porCercaniaYOferta,
      porDemanda: false,
      tieneDemandaReal: () => false,
    };
  }

  const totalPorColonia = new Map(
    tendencia.map((t) => [normalizarNombreParaTendencia(t.colonia), t.total]),
  );
  const colonias = [...coloniasRanked].sort((a, b) => {
    const distancia = distanciaMunicipioDesdeCentro(a.municipio) - distanciaMunicipioDesdeCentro(b.municipio);
    if (distancia !== 0) return distancia;
    return (
      (totalPorColonia.get(normalizarNombreParaTendencia(b.nombre)) ?? 0) -
      (totalPorColonia.get(normalizarNombreParaTendencia(a.nombre)) ?? 0)
    );
  });

  return {
    colonias,
    porDemanda: true,
    tieneDemandaReal: (nombre: string) =>
      (totalPorColonia.get(normalizarNombreParaTendencia(nombre)) ?? 0) > 0,
  };
}

export function getAllAgents(): Agent[] {
  return agentsData as Agent[];
}

export async function getStats() {
  return {
    propiedadesActivas: (await getAllProperties()).length,
    municipiosCubiertos: 17,
  };
}

export interface PriceContext {
  precioPorM2: number | null;
  promedioZona: number | null;
  totalComparables: number;
  m2Ref: number;
}

export async function getPriceContext(property: Property): Promise<PriceContext> {
  const m2Ref = property.tipo === 'terreno'
    ? property.m2Terreno
    : property.m2Construidos;

  if (!m2Ref || m2Ref <= 0) {
    return { precioPorM2: null, promedioZona: null, totalComparables: 0, m2Ref: 0 };
  }

  const precioPorM2 = Math.round(property.precio / m2Ref);

  const { propiedades } = await backendFetch<{ propiedades: BackendPublicProperty[] }>(
    `/propiedades?all=true&tipo=${encodeURIComponent(property.tipo)}&operacion=${encodeURIComponent(property.operacion)}&municipio=${encodeURIComponent(property.municipio)}`,
  );
  const comparables = propiedades
    .map(mapBackendProperty)
    .filter((p) =>
      p.id !== property.id &&
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

// BACKEND.md §11 — directorio de servicios, migrado al backend nuevo
// (GET /servicios público, sin datos de contacto — ver ServiceContactCard.tsx
// para el revelado con sesión).
export interface ServicioPublico {
  id: string;
  categoria: string;
  nombre: string;
  descripcion: string;
  municipio: string;
  colonia: string | null;
  foto: string | null;
  createdAt: string;
  // Opcional: GET /servicios (lista) ya filtra por activo, pero el detalle
  // de un solo recurso (GET /servicios/:id) podría no aplicar el mismo
  // filtro — si el backend lo manda, servicios/[id]/page.tsx lo respeta en
  // vez de mostrar contacto/portafolio funcionando para un servicio
  // pausado/moderado.
  activo?: boolean;
}

export interface TrabajoServicio {
  id: string;
  imagen: string;
  descripcion: string | null;
  createdAt: string;
}

export async function getAllServicios(): Promise<ServicioPublico[]> {
  return backendFetch<ServicioPublico[]>('/servicios');
}

export async function getServicioById(id: string): Promise<ServicioPublico | undefined> {
  try {
    return await backendFetch<ServicioPublico>(`/servicios/${encodeURIComponent(id)}`);
  } catch {
    return undefined;
  }
}

export async function getTrabajosServicio(id: string): Promise<TrabajoServicio[]> {
  try {
    return await backendFetch<TrabajoServicio[]>(`/servicios/${encodeURIComponent(id)}/trabajos`);
  } catch {
    return [];
  }
}
