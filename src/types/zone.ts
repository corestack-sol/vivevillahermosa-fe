export interface Municipality {
  id: string;
  nombre: string;
  slug: string;
  lat: number;
  lng: number;
  propiedades: number;
  descripcion: string;
  // Opcional — auditoría de derechos de autor 17/09/2026 (docs/AUDITORIA-
  // FOTOS-MUNICIPIOS-17092026.md): 2 de 17 fotos no tenían fuente
  // verificable en Wikimedia Commons y se quitaron. Sin foto, la UI cae
  // a un ícono genérico (zonas/[slug]/page.tsx) en vez de romper.
  foto?: string;
  cercaDosoBocas?: boolean;
}

/**
 * Contenido editorial ampliado de un municipio (src/data/municipios-contenido.json).
 * Redactado con palabras propias a partir de las fuentes listadas en `fuentes`
 * — cada cifra sale de una de ellas, nunca de memoria — y comparado contra
 * cada fuente para que no copie frases (las secuencias idénticas que quedan
 * son nombres propios, fechas y cifras). Motivo: las páginas de municipio
 * tenían 14–28 palabras propias y AdSense las marcó como "contenido de
 * bajo valor" (auditoría 2026-09-20).
 */
export interface MunicipioContenido {
  datos: { poblacion2020: number; cabecera: string };
  secciones: { titulo: string; texto: string }[];
  fuentes: { nombre: string; url?: string }[];
  /** Fecha ISO (YYYY-MM-DD) en que se consultaron las fuentes. */
  consultado: string;
}

export interface Zone {
  id: string;
  nombre: string;
  slug: string;
  municipio: string;
  lat: number;
  lng: number;
  propiedades: number;
  precioPromedioRenta: number;
  precioPromedioVenta: number;
  descripcion: string;
  foto: string;
  destacada: boolean;
}

export interface FloodZoneFeature {
  type: 'Feature';
  properties: {
    colonia: string;
    municipio: string;
    riesgo: 'alto' | 'medio' | 'bajo';
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface FloodZonesGeoJSON {
  type: 'FeatureCollection';
  features: FloodZoneFeature[];
}
