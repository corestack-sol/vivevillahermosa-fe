import { distanciaKm, coloniaCercana, type ColoniaCoord } from './colonias';

/**
 * Lógica pura del sistema de 3 niveles de fraude y sus señales
 * independientes del texto (pedido explícito 2026-08-31) — extraída de
 * PublishForm.tsx para poder probarla sin montar el formulario completo
 * (que depende de react-hook-form, MapPicker dinámico, exifr, backendFetch,
 * etc.). PublishForm.tsx importa estas mismas funciones, no las duplica.
 */

export type ResultadoGPSFoto =
  | { tipo: 'sugerencia'; coords: { lat: number; lng: number }; coloniaSugerida?: ColoniaCoord }
  | { tipo: 'contradiccion'; distanciaKm: number };

/**
 * Clasifica el GPS de una foto contra la colonia/municipio ya declarados —
 * la mitad "matemática" de analizarGPSFoto() en PublishForm.tsx (la otra
 * mitad, leer el EXIF del archivo, es I/O y se queda allá). `null` significa
 * "no hay nada confiable contra qué comparar" (sin colonia catalogada ni
 * centro de municipio conocido) — ni sugiere ni marca contradicción, nunca
 * a ciegas.
 *
 * Umbrales: 3km para colonia (área real, no un punto — mismo criterio que
 * pinLejosDeColonia), 20km para el centro del municipio (mucho más grande,
 * margen generoso a propósito).
 */
export function clasificarGPSFoto(
  gps: { latitude: number; longitude: number },
  params: {
    coloniaVerificada?: { lat: number; lng: number } | null;
    municipio?: string;
    municipioCenter?: readonly [number, number];
  },
): ResultadoGPSFoto | null {
  const { coloniaVerificada, municipio, municipioCenter } = params;

  if (coloniaVerificada) {
    const d = distanciaKm(gps.latitude, gps.longitude, coloniaVerificada.lat, coloniaVerificada.lng);
    if (d > 3) return { tipo: 'contradiccion', distanciaKm: d };
    return { tipo: 'sugerencia', coords: { lat: gps.latitude, lng: gps.longitude } };
  }

  if (municipioCenter) {
    const [clat, clng] = municipioCenter;
    const d = distanciaKm(gps.latitude, gps.longitude, clat, clng);
    if (d > 20) return { tipo: 'contradiccion', distanciaKm: d };
    const coords = { lat: gps.latitude, lng: gps.longitude };
    const cercana = coloniaCercana(gps.latitude, gps.longitude, 2, municipio);
    return cercana ? { tipo: 'sugerencia', coords, coloniaSugerida: cercana } : { tipo: 'sugerencia', coords };
  }

  return null;
}

/**
 * Nivel 3 del sistema (pedido explícito 2026-08-31): bloquea publicar
 * cuando el backend marcó `bloqueado` (texto extremo, ver ai.ts) O cuando
 * clasificó `riesgo: 'alto'` — antes 'alto' solo mostraba una advertencia y
 * dejaba publicar, que era exactamente el hueco señalado ("actualmente no
 * se bloquean"). `bajo`/`medio` nunca bloquean aquí.
 */
export function esPublicacionBloqueada(fraudCheck: { bloqueado?: boolean; riesgo?: string } | null): boolean {
  return fraudCheck?.bloqueado === true || fraudCheck?.riesgo === 'alto';
}

/**
 * Filtro para el watch() de react-hook-form que dispara el re-chequeo de
 * fraude — SOLO título/descripción deben re-evaluarlo. `undefined` es la
 * primera llamada de watch() al suscribirse (sin campo asociado todavía),
 * se deja pasar a propósito para no romper la evaluación inicial.
 *
 * Bug real que esto corrige (reproducido en vivo 2026-08-31): sin este
 * filtro, llenar teléfono/correo en el paso de Contacto también
 * re-evaluaba título/descripción SIN que ese texto cambiara — y como el
 * modelo de IA no es determinista, la misma descripción fraudulenta podía
 * salir "alto" una vez y no la siguiente, dejando pasar una publicación
 * que ya se había marcado como bloqueada.
 */
export function debeReevaluarFraude(fieldName: string | undefined): boolean {
  return fieldName === undefined || fieldName === 'titulo' || fieldName === 'descripcion';
}

/**
 * Cuenta cuántas propiedades YA usan este mismo teléfono/WhatsApp — señal
 * de "contacto reutilizado" (pedido explícito 2026-08-31). Un agente/casero
 * real con varias propiedades también da un número aquí a propósito — esta
 * función solo cuenta, la decisión de "esto es sospechoso" nunca se toma
 * aquí ni en el frontend.
 */
export function contarContactoReutilizado(
  propiedades: { agente: { tel?: string; whatsapp?: string } }[],
  tel: string,
): number {
  const t = tel.trim();
  if (!t) return 0;
  return propiedades.filter((p) => p.agente.tel === t || p.agente.whatsapp === t).length;
}
