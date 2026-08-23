import { TIPO_OPTIONS } from '@/lib/publishSchema';

/**
 * Título automático por plantilla — deliberadamente NO se llama "con IA"
 * (a diferencia de generarConIA() para la descripción, que sí llama al
 * backend): es una plantilla determinista sobre los datos que la persona
 * ya llenó, sin ninguna llamada de red. Mismo criterio de honestidad ya
 * usado en el resto de la plataforma (no presentar como IA/medido algo que
 * no lo es).
 */
export interface DatosTitulo {
  tipo: string;
  operacion: string;
  colonia?: string;
  municipio?: string;
  recamaras?: number;
  m2Construidos?: number;
  m2Terreno?: number;
}

export function generarTituloAutomatico(datos: DatosTitulo): string {
  const tipoLabel = TIPO_OPTIONS.find((t) => t.value === datos.tipo)?.label ?? 'Propiedad';
  const operacionLabel = datos.operacion === 'venta' ? 'en venta' : datos.operacion === 'renta' ? 'en renta' : '';

  const municipioLabel = datos.municipio === 'Centro' ? 'Villahermosa' : datos.municipio;
  const lugar = datos.colonia?.trim()
    ? `${datos.colonia.trim()}${municipioLabel ? `, ${municipioLabel}` : ''}`
    : municipioLabel;

  let titulo = [tipoLabel, operacionLabel].filter(Boolean).join(' ');
  if (lugar) titulo += ` en ${lugar}`;

  const detalles: string[] = [];
  if (datos.recamaras) detalles.push(`${datos.recamaras} rec`);
  const m2 = datos.m2Construidos || datos.m2Terreno;
  if (m2) detalles.push(`${m2} m²`);
  if (detalles.length > 0) titulo += ` — ${detalles.join(', ')}`;

  return titulo;
}
