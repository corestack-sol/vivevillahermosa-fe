import type { PublishFormData } from './publishSchema';
import type { Coords } from '@/components/forms/MapPicker';

// Pedido explícito 2026-09-11: si algo falla al publicar (ej. una foto no
// se sube) o la persona simplemente cierra la pestaña a medias, antes no
// había forma de recuperar lo ya escrito — había que llenar el formulario
// completo otra vez desde cero. Este borrador guarda todo lo que SÍ se
// puede serializar a localStorage; las fotos (objetos File en memoria) no
// sobreviven un recargo de página sin IndexedDB, así que deliberadamente
// NO se guardan — quien retome el borrador solo necesita volver a
// seleccionarlas, más simple que la complejidad de guardar blobs.
//
// Escaneado por cuenta (mismo criterio que recentlyViewed.ts, bug real de
// esta sesión: sin esto, un borrador de una cuenta aparecía al entrar con
// otra en el mismo navegador) — `userId` null para quien no ha iniciado
// sesión (público puede empezar a llenar el formulario antes de loguearse).
const DIAS_EXPIRACION = 7;

export interface PublishDraft {
  valores: Partial<PublishFormData>;
  amenidades: string[];
  servicios: string[];
  coords: Coords | null;
  step: number;
  guardadoEn: string; // ISO 8601
}

function claveBorrador(userId: string | null): string {
  return userId ? `publishDraft:${userId}` : 'publishDraft:anon';
}

export function guardarBorrador(userId: string | null, datos: Omit<PublishDraft, 'guardadoEn'>): void {
  if (typeof window === 'undefined') return;
  try {
    const borrador: PublishDraft = { ...datos, guardadoEn: new Date().toISOString() };
    localStorage.setItem(claveBorrador(userId), JSON.stringify(borrador));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena) — no es crítico, solo se pierde el autoguardado.
  }
}

/** `null` si no hay borrador, o si el que hay ya expiró (más de 7 días). */
export function leerBorrador(userId: string | null): PublishDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(claveBorrador(userId));
    if (!raw) return null;
    const borrador = JSON.parse(raw) as PublishDraft;
    const edadMs = Date.now() - new Date(borrador.guardadoEn).getTime();
    if (edadMs > DIAS_EXPIRACION * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(claveBorrador(userId));
      return null;
    }
    return borrador;
  } catch {
    return null;
  }
}

export function borrarBorrador(userId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(claveBorrador(userId));
  } catch {
    // No crítico.
  }
}

/** true si el borrador tiene algo real que valga la pena ofrecer recuperar — evita el prompt de "¿continuar?" para un formulario vacío que nunca se tocó. */
export function borradorTieneContenido(borrador: PublishDraft): boolean {
  const v = borrador.valores;
  return !!(
    (v.titulo && v.titulo.trim()) ||
    (v.descripcion && v.descripcion.trim()) ||
    v.precio ||
    v.tipo ||
    v.municipio ||
    (v.colonia && v.colonia.trim()) ||
    borrador.amenidades.length > 0 ||
    borrador.servicios.length > 0 ||
    borrador.coords !== null
  );
}
