/**
 * Lógica pura de alertas de propiedades (formulario de /alertas), extraída
 * para poder probarla sin montar la página.
 */

/**
 * Alertas por colonia — pedido 2026-09-23. Verificado en vivo contra el
 * backend real ese mismo día: POST /alertas con `colonia` en el body
 * responde 400 ("property colonia should not exist") y como query param
 * lo acepta pero lo descarta sin guardarlo. Mientras el backend no la
 * guarde ni la use al emparejar publicaciones, ofrecerla en el formulario
 * rompería TODA creación de alertas. Cambiar a `true` SOLO cuando el
 * backend confirme el contrato de docs/BACKEND-ALERTAS-COLONIA-23092026.md.
 */
export const ALERTAS_POR_COLONIA_DISPONIBLE = false;

export interface FiltrosAlerta {
  municipio?: string;
  colonia?: string;
  tipo?: string;
  operacion?: string;
  precioMax?: string | number | null;
  dosBocas: boolean;
  sinRiesgo: boolean;
}

export interface CuerpoAlerta {
  municipio?: string;
  colonia?: string;
  tipo?: string;
  operacion?: string;
  precioMax?: number;
  dosBocas: boolean;
  sinRiesgo: boolean;
}

/** Mensaje de error del formulario, o `null` si los filtros son válidos. */
export function validarFiltrosAlerta(
  f: Pick<FiltrosAlerta, 'municipio' | 'colonia'>,
  { coloniaHabilitada = ALERTAS_POR_COLONIA_DISPONIBLE }: { coloniaHabilitada?: boolean } = {},
): string | null {
  // Muchos nombres de colonia se repiten entre municipios (ej. "Centro") —
  // sin municipio la alerta avisaría de propiedades de cualquier lado.
  if (coloniaHabilitada && f.colonia?.trim() && !f.municipio) {
    return 'Elige el municipio para poder alertar por colonia.';
  }
  return null;
}

export function construirCuerpoAlerta(
  f: FiltrosAlerta,
  { coloniaHabilitada = ALERTAS_POR_COLONIA_DISPONIBLE }: { coloniaHabilitada?: boolean } = {},
): CuerpoAlerta {
  const colonia = f.colonia?.trim();
  const precio = f.precioMax === '' || f.precioMax == null ? undefined : Number(f.precioMax);
  return {
    municipio: f.municipio || undefined,
    // Solo se manda si el backend ya la soporta Y hay un municipio — el
    // backend rechaza campos desconocidos con 400, no basta con ignorarlos.
    ...(coloniaHabilitada && colonia && f.municipio ? { colonia } : {}),
    tipo: f.tipo || undefined,
    operacion: f.operacion || undefined,
    precioMax: precio && precio > 0 ? precio : undefined,
    dosBocas: f.dosBocas,
    sinRiesgo: f.sinRiesgo,
  };
}

export function alertaSinFiltros(c: CuerpoAlerta): boolean {
  return !c.municipio && !c.colonia && !c.tipo && !c.operacion && !c.precioMax && !c.dosBocas && !c.sinRiesgo;
}

export interface AlertaGuardada {
  municipio?: string | null;
  colonia?: string | null;
  tipo?: string | null;
  operacion?: string | null;
  precioMax?: number | null;
  dosBocas: boolean;
  sinRiesgo: boolean;
}

export function etiquetaAlerta(a: AlertaGuardada): string {
  const partes: string[] = [];
  if (a.operacion) partes.push(a.operacion === 'renta' ? 'Renta' : 'Venta');
  if (a.tipo) partes.push(a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1));
  if (a.colonia) partes.push(a.colonia);
  if (a.municipio) partes.push(a.municipio === 'Centro' ? 'Villahermosa' : a.municipio);
  if (a.precioMax) partes.push(`hasta $${a.precioMax.toLocaleString('es-MX')}`);
  if (a.dosBocas) partes.push('Dos Bocas');
  if (a.sinRiesgo) partes.push('zona segura');
  return partes.length ? partes.join(' · ') : 'Todas las propiedades';
}
