import type { PropertyType, OperationType, FloodRisk } from './property';

export type SortOption =
  | 'relevancia'
  | 'precio-asc'
  | 'precio-desc'
  | 'reciente'
  | 'colonia-asc'
  | 'm2-desc'
  | 'm2-asc';

export interface SearchFilters {
  q?: string;
  tipo?: PropertyType | '';
  operacion?: OperationType | '';
  municipio?: string;
  /**
   * Nombre libre de colonia/fraccionamiento (como lo extrae la IA, ej.
   * "Magisterial" o "col carrizal") — filters.ts intenta resolverlo por
   * coordenadas reales (src/lib/colonias.ts) y si no está catalogado cae a
   * comparar texto contra el catálogo, igual que antes.
   */
  colonia?: string;
  precioMin?: number;
  precioMax?: number;
  /** Mínimo de recámaras — "3 recámaras", "al menos 2 recámaras". */
  recamaras?: number;
  /** Máximo de recámaras — "máximo 2 recámaras", "no más de 3 recámaras". Distinto de `recamaras` (mínimo); ambos pueden combinarse para un rango. */
  recamarasMax?: number;
  /** Mínimo de baños completos — "con 2 baños", "mínimo 3 baños". */
  banos?: number;
  /** Metros cuadrados — de `m2Construidos` para todo excepto terrenos, de `m2Terreno` para terrenos (ver filters.ts). */
  m2Min?: number;
  m2Max?: number;
  /** Texto libre de una amenidad mencionada (ej. "alberca", "jardín") — coincide contra `Property.amenidades`. */
  amenidad?: string;
  riesgoInundacion?: FloodRisk | '';
  cercaDosoBocas?: boolean;
  /** Key de src/lib/landmarks.ts — "cerca de la Laguna de las Ilusiones", etc. */
  landmark?: string;
  /** 'salud' | 'educacion' | 'comercial' — "cerca de un hospital" sin nombrar cuál. */
  categoriaLandmark?: string;
  /** Key de src/lib/zonasDestacadas.ts — "zona de alta plusvalía", "zona exclusiva", etc. */
  zonaDestacada?: string;
  sort?: SortOption;
  /** Número exacto de resultados pedido — "muéstrame 5 propiedades", "top 10", "las 3 más baratas". Corta la lista ya ordenada, no reemplaza `sort`. */
  limite?: number;
  page?: number;
}
