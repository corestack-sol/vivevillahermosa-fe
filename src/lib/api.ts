import type { FloodRisk, OperationType, Property, PropertyType } from '@/types/property';
import type { Municipality, Zone } from '@/types/zone';
import type { Agent } from '@/types/agent';

import municipalitiesData from '@/data/municipalities.json';
import zonesData from '@/data/zones.json';
import agentsData from '@/data/agents.json';
import { backendFetch } from '@/lib/backendApi';

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
// getAgenteContacto() sigue leyendo el JSON estático por ahora — se corrige
// en la fase siguiente (contacto/reportes, BACKEND.md §10) junto con
// GET /propiedades/:id/contacto real. Hasta entonces, el tel/email/whatsapp
// de una propiedad creada de verdad (no del catálogo de muestra) no se
// resuelve por este camino.
import propertiesData from '@/data/properties.json';

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
  activa: boolean;
  agente: { nombre: string; foto: string | null; verificado: boolean };
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
 * Único camino real para obtener el tel/email/whatsapp de contacto de una
 * propiedad de muestra — lee directo del JSON estático, nunca de
 * getAllProperties(). ⚠️ Temporal: solo resuelve propiedades del catálogo de
 * muestra, no propiedades reales creadas vía el backend — se reemplaza por
 * GET /propiedades/:id/contacto en la fase de contacto/reportes.
 */
export function getAgenteContacto(id: string): Pick<Property['agente'], 'tel' | 'email' | 'whatsapp'> | undefined {
  const seed = (propertiesData as { data: { id: string; slug: string; agente: { tel?: string; email?: string; whatsapp?: string } }[] }).data
    .find((p) => p.id === id || p.slug === id);
  if (!seed) return undefined;
  const { tel, email, whatsapp } = seed.agente;
  return { tel, email, whatsapp };
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

export function getAllZones(): Zone[] {
  return zonesData as Zone[];
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
 * valores editoriales fijos (catálogo de zonas/municipios con ficha —
 * BACKEND.md §9.3, todavía no es una tabla real). Esta función solo
 * recalcula el conteo en vivo contra Property, que sí es real desde esta
 * fase.
 */
export async function getMunicipalitiesWithLiveStats(): Promise<Municipality[]> {
  const all = await getAllProperties();
  return getAllMunicipalities().map((m) => {
    const props = propertiesInMunicipality(all, m);
    return { ...m, propiedades: props.length };
  });
}

export async function getZonesWithLiveStats(): Promise<Zone[]> {
  const all = await getAllProperties();
  return getAllZones().map((z) => {
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
 * Ranking por OFERTA (cuántas propiedades activas tiene la colonia), no por
 * DEMANDA — ver docs/BACKEND.md §9.1.
 */
export async function getColoniasRankedByPropiedades(): Promise<ColoniaCard[]> {
  const all = await getAllProperties();
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
