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
