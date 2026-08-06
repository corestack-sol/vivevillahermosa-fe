import type { PropertyType, OperationType, FloodRisk } from './property';

export type SortOption =
  | 'relevancia'
  | 'precio-asc'
  | 'precio-desc'
  | 'reciente';

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
  recamaras?: number;
  riesgoInundacion?: FloodRisk | '';
  cercaDosoBocas?: boolean;
  /** Key de src/lib/landmarks.ts — "cerca de la Laguna de las Ilusiones", etc. */
  landmark?: string;
  /** 'salud' | 'educacion' | 'comercial' — "cerca de un hospital" sin nombrar cuál. */
  categoriaLandmark?: string;
  sort?: SortOption;
  page?: number;
}
