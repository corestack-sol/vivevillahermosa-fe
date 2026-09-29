'use client';

import { backendFetch } from '@/lib/backendApi';
import { mapBackendProperty, type BackendPublicProperty } from '@/lib/api';
import type { Property } from '@/types/property';

/**
 * Forma real de POST /ia/buscar — verificada en vivo 2026-09-16 (docs/
 * BACKEND-INTEGRACION-IA-BUSCAR-16092026.md). `altamenteRelevantes`/
 * `totalAltamenteRelevantes` solo vienen presentes cuando ese grupo tiene
 * al menos un resultado — el backend los omite por completo si no.
 * `resultados` ya trae el grupo principal según `modo` (si `modo` es
 * "parcial", `resultados` es exactamente `parciales`, no un arreglo
 * vacío) — confirmado comparando ambos arreglos en la misma respuesta.
 */
export interface PropiedadConCoincidencia {
  propiedad: BackendPublicProperty;
  score: number;
  tipoCoincidencia: string;
  razones: string[];
  faltantes: string[];
}

export interface RespuestaBuscarIA {
  filtros: Record<string, unknown>;
  fueraDeCobertura: boolean;
  coberturaIncierta: boolean;
  modo: string;
  totalExactas: number;
  totalAltamenteRelevantes?: number;
  totalParciales: number;
  resultados: PropiedadConCoincidencia[];
  altamenteRelevantes?: PropiedadConCoincidencia[];
  parciales: PropiedadConCoincidencia[];
  clasificacion: {
    requeridos: Record<string, unknown>;
    preferidos: Record<string, unknown>;
    orden: Record<string, unknown>;
  };
}

export interface ResultadoBusquedaIA {
  /** Grupo principal, en el orden exacto que mandó el backend — nunca se reordena/reescora aquí. */
  propiedades: Property[];
  /** Grupo secundario ("todo lo demás") — lo que no quedó ya incluido en `propiedades`. */
  todoLoDemas: Property[];
  fueraDeCobertura: boolean;
  /**
   * `municipio`/`colonia` que extrajo el backend, si son texto (nunca se asume su forma:
   * `filtros` es `Record<string, unknown>`). Quien llama los usa para un plan B cuando
   * `propiedades`/`todoLoDemas` vienen vacíos pero la colonia SÍ es una zona catalogada
   * (ver PropertiesClient.tsx, aplicarBusquedaIA) — el backend empareja `colonia` por
   * igualdad de texto exacta contra el campo de cada propiedad, no por proximidad real,
   * así que "Centro Histórico" o "Zona Deportiva" (zonas que abarcan varias colonias,
   * ninguna con ese nombre literal) siempre dan cero ahí aunque sí haya propiedades
   * dentro de esa zona.
   *
   * Investigado 2026-09-29 si `landmark`/`categoriaLandmark`/`zonaDestacada` tenían el
   * mismo problema (probado en vivo, no solo supuesto): NO — esos ya vienen con
   * `proximidad.puntos` (lat/lng/radio reales) resueltos del lado del backend, no
   * comparación de texto, y `/ia/buscar` los usa bien. La única excepción es una
   * `zonaDestacada` cuya fuente es una COLONIA (ej. "club-campestre" → manda también
   * `colonia: "Fraccionamiento Club Campestre"`, confirmado con el mismo bug) — ese
   * caso ya cae en este mismo plan B porque solo depende de que `colonia` venga, sin
   * importar si `zonaDestacada` también vino.
   */
  filtros: { municipio?: string; colonia?: string };
}

function comoTexto(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

// Mismo margen que interpretarBusqueda.ts (backend responde vía OpenRouter,
// timeout propio de 9s del lado del backend) — no se reintenta acá: a
// diferencia de /ia/busqueda-inteligente, un fallo de /ia/buscar no cae en
// un objeto vacío silencioso, dispara el fallback explícito al flujo
// anterior (ver PropertiesClient.tsx, aplicarBusquedaIA).
const TIMEOUT_MS = 12_000;

/**
 * Separa la respuesta de /ia/buscar en "principal" (lo que se muestra como
 * "Resultados") y "secundario" ("Todo lo demás", mismo patrón visual que ya
 * usaba `resultadosSimilares` en PropertiesClient.tsx). Función pura, sin
 * red, para poder probar la lógica de agrupación por separado del fetch.
 */
export function agruparRespuestaIA(data: RespuestaBuscarIA): {
  principal: PropiedadConCoincidencia[];
  secundario: PropiedadConCoincidencia[];
} {
  const principal = data.resultados.length > 0
    ? data.resultados
    : data.altamenteRelevantes && data.altamenteRelevantes.length > 0
      ? data.altamenteRelevantes
      : data.parciales;

  const idsPrincipal = new Set(principal.map((r) => r.propiedad.id));
  const secundario = [...(data.altamenteRelevantes ?? []), ...data.parciales]
    .filter((r) => !idsPrincipal.has(r.propiedad.id));

  return { principal, secundario };
}

/**
 * Búsqueda por texto libre ya rankeada por el backend (búsqueda + clasificación
 * + ranking + proximidad ya resueltos del lado del servidor) — a diferencia de
 * `interpretarBusqueda()` (que solo EXTRAE filtros estructurados para luego
 * pasar por `applyFilters()`/`searchProperties()`), esta función devuelve
 * directamente las propiedades a mostrar, en el orden que manda el backend.
 * Quien la llama NO debe volver a ordenar/filtrar el resultado.
 *
 * Lanza en caso de timeout, error HTTP o red — quien llama debe capturarlo y
 * caer al flujo anterior (ver docs/BACKEND-INTEGRACION-IA-BUSCAR-16092026.md
 * §Fallback).
 */
export async function buscarIA(query: string): Promise<ResultadoBusquedaIA> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const data = await backendFetch<RespuestaBuscarIA>('/ia/buscar', {
      method: 'POST',
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    const { principal, secundario } = agruparRespuestaIA(data);
    return {
      propiedades: principal.map((r) => mapBackendProperty(r.propiedad)),
      todoLoDemas: secundario.map((r) => mapBackendProperty(r.propiedad)),
      fueraDeCobertura: data.fueraDeCobertura,
      filtros: { municipio: comoTexto(data.filtros?.municipio), colonia: comoTexto(data.filtros?.colonia) },
    };
  } finally {
    clearTimeout(timer);
  }
}
