import { readJson, writeJson } from './localStore';

export type RolEquipo = 'admin' | 'agente';
export type EstadoMiembro = 'activo' | 'invitado';

export interface MiembroEquipo {
  id: string;
  nombre: string;
  email: string;
  rol: RolEquipo;
  estado: EstadoMiembro;
}

const KEY = 'vivevillahermosa_equipo';

/**
 * ⚠️ Vista previa — no existen cuentas de equipo reales todavía (una
 * inmobiliaria sigue siendo, técnicamente, un solo `User`). "Invitar" solo
 * agrega una fila local en estado `invitado`: nadie recibe un correo real
 * ni puede iniciar sesión como ese miembro. Ver docs/BACKEND.md §15 — esto
 * requiere permisos y atribución de leads por persona en el backend, no
 * solo una lista visual.
 */
export function getMiembros(): MiembroEquipo[] {
  return readJson<MiembroEquipo[]>(KEY, []);
}

export function invitarMiembro(nombre: string, email: string, rol: RolEquipo): void {
  const miembros = getMiembros();
  miembros.push({ id: `miembro-${Date.now()}`, nombre, email, rol, estado: 'invitado' });
  writeJson(KEY, miembros);
}

export function eliminarMiembro(id: string): void {
  writeJson(KEY, getMiembros().filter((m) => m.id !== id));
}
