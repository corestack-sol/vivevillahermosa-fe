export type PropertyType =
  | 'casa'
  | 'departamento'
  | 'terreno'
  | 'local'
  | 'oficina'
  | 'bodega'
  | 'habitacion';

export type OperationType = 'venta' | 'renta';

export type FloodRisk = 'alto' | 'medio' | 'bajo';

/**
 * Solo se adjunta cuando analizarFraude (src/lib/ai.ts) devuelve riesgo
 * "alto" al publicar — "medio" se queda como aviso privado al publicador
 * (ver PublishForm.tsx) sin marcar la propiedad, porque suele salir de un
 * precio simplemente muy bueno, no necesariamente de una estafa; marcarlo
 * públicamente sería injusto para un publicador honesto. Que exista este
 * campo ya es la señal de "alto" — no hace falta guardar el nivel aparte.
 *
 * ⚠️ BACKEND (docs/BACKEND.md §3): hoy este campo lo
 * calcula el navegador (PublishForm.tsx) a partir del resultado de
 * analizarFraude() y lo mete en el objeto Property antes de "publicar" en
 * localStorage. Cuando exista `POST /api/propiedades` real, este campo debe
 * calcularlo el SERVIDOR llamando a analizarFraude() con sus propios datos
 * recién recibidos — nunca aceptar un `alertaFraude` que venga tal cual en
 * el body del request, es trivial de falsificar u omitir desde el cliente.
 */
export interface AlertaFraude {
  señales: string[];
}

export interface PropertyAgent {
  nombre: string;
  // Opcionales: quien publica elige si quiere que lo contacten por
  // teléfono, por correo o ambos — no revelar el que no eligió es la
  // decisión, no un dato faltante por error (ver PublishForm.tsx).
  tel?: string;
  email?: string;
  foto: string;
  whatsapp?: string;
  verificado?: boolean;
  // true si la cuenta dueña de esta propiedad está bloqueada por uso
  // indebido repetido del buscador con IA (docs/BACKEND.md §8) — viene
  // directo del backend, calculado sobre la relación real Property.userId.
  enRevision?: boolean;
}

export interface Property {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  tipo: PropertyType;
  operacion: OperationType;
  precio: number;
  moneda: 'MXN';
  m2Construidos: number;
  m2Terreno: number;
  recamaras: number;
  banos: number;
  mediosBanos: number;
  estacionamientos: number;
  antiguedad: number;
  amenidades: string[];
  servicios?: string[];
  fotos: string[];
  municipio: string;
  colonia: string;
  direccion: string;
  lat: number;
  lng: number;
  /**
   * Punto que se le muestra a cualquier visitante que no sea el dueño —
   * NUNCA la coordenada exacta de arriba. Lo calcula `getPuntoPublico`
   * (src/lib/colonias.ts) una sola vez, del lado que arma los datos
   * (getAllProperties en api.ts; al publicar/editar/importar en
   * propiedadesLocales.ts y sus formularios) — nunca se lee directo del
   * JSON de muestra ni se escribe a mano en un componente.
   */
  latPublico: number;
  lngPublico: number;
  riesgoInundacion: FloodRisk;
  zonaEcologica: boolean;
  cercaDosoBocas: boolean;
  featured: boolean;
  alertaFraude?: AlertaFraude;
  agente: PropertyAgent;
  /**
   * Por defecto (false/undefined) el contacto es INSTANTÁNEO para
   * cualquier usuario con sesión iniciada — tel/whatsapp/correo se
   * revelan de un clic, igual que una lona de "se renta" o un anuncio en
   * un grupo informal (así es como la gente ya espera contactar en este
   * mercado). Si el propietario activa esto, se cambia al flujo de
   * "manda un mensaje primero" (ContactForm + correo al propietario, ver
   * `POST /api/propiedades/[id]/contactar`) — pensado para quien prefiere
   * filtrar antes de compartir su número, no como comportamiento
   * obligatorio para todos.
   */
  requiereMensajePrimero?: boolean;
  fechaPublicacion: string;
  activa: boolean;
}

export interface PropertiesResponse {
  meta: {
    total: number;
    page: number;
    perPage: number;
  };
  data: Property[];
}
