/**
 * Lógica pura de alertas de propiedades (formulario de /alertas), extraída
 * para poder probarla sin montar la página.
 */

/**
 * Alertas por colonia — pedido 2026-09-23. El backend la soporta desde su
 * PR #145 (verificado en vivo el mismo día contra producción: 201 con
 * `colonia` en la respuesta, 400 `COLONIA_REQUIERE_MUNICIPIO` sin municipio,
 * 400 con colonia vacía, y una propiedad en la colonia dispara UN aviso
 * "Nueva propiedad en <colonia>" mientras que otra colonia no dispara nada).
 * Antes de eso el body con `colonia` daba 400 y rompía toda creación de
 * alertas, por eso vivía apagada. Contrato: docs/BACKEND-ALERTAS-COLONIA-23092026.md.
 */
export const ALERTAS_POR_COLONIA_DISPONIBLE = true;

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
  f: Pick<FiltrosAlerta, 'municipio' | 'colonia'> & { coloniaEscrita?: string },
  { coloniaHabilitada = ALERTAS_POR_COLONIA_DISPONIBLE }: { coloniaHabilitada?: boolean } = {},
): string | null {
  // El backend empareja por el NOMBRE exacto (normalizado) de la colonia: solo
  // sirve una colonia elegida de la lista de sugerencias, no texto libre.
  if (coloniaHabilitada && f.coloniaEscrita?.trim() && !f.colonia?.trim()) {
    return 'Elige una colonia de la lista de sugerencias, o deja el campo vacío.';
  }
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

const norm = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? null : String(v).trim().toLowerCase());

/**
 * ¿Ya existe una alerta con exactamente los mismos criterios? El backend NO
 * deduplica (verificado en vivo 2026-09-23: 3 envíos idénticos guardaron 3
 * alertas) y cada alerta repetida genera su propio aviso por cada propiedad
 * que coincide — con 4 iguales, la misma propiedad avisa 4 veces.
 */
export function esAlertaDuplicada(existentes: AlertaGuardada[], nueva: CuerpoAlerta): boolean {
  return existentes.some((a) =>
    norm(a.municipio) === norm(nueva.municipio)
    && norm(a.colonia) === norm(nueva.colonia)
    && norm(a.tipo) === norm(nueva.tipo)
    && norm(a.operacion) === norm(nueva.operacion)
    && norm(a.precioMax) === norm(nueva.precioMax)
    && !!a.dosBocas === !!nueva.dosBocas
    && !!a.sinRiesgo === !!nueva.sinRiesgo);
}
