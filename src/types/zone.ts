export interface Municipality {
  id: string;
  nombre: string;
  slug: string;
  lat: number;
  lng: number;
  propiedades: number;
  precioPromedio: number;
  descripcion: string;
  foto: string;
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
