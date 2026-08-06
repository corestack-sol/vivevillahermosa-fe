import { readJson, writeJson } from './localStore';

export type EstadoVerificacion = 'sin_solicitar' | 'en_revision';

const KEY = 'vivevillahermosa_verificacion_agencia';

/**
 * ⚠️ Vista previa — no hay revisión real de documentos porque no hay
 * backend para almacenarlos ni equipo que los revise todavía. A propósito
 * NUNCA pasa a "verificado" por su cuenta: fabricar un ✓ sin revisión real
 * sería el mismo tipo de dato falso que el resto de la plataforma evita
 * (ver por qué reportePdf.ts omite comparaciones que no puede respaldar).
 */
export function getEstadoVerificacion(): EstadoVerificacion {
  return readJson<EstadoVerificacion>(KEY, 'sin_solicitar');
}

export function solicitarVerificacion(): void {
  writeJson<EstadoVerificacion>(KEY, 'en_revision');
}
