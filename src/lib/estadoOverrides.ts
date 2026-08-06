import type { EstadoPublicacion } from './misPropiedadesDemo';
import { readJson, writeJson } from './localStore';

const KEY = 'vivevillahermosa_estado_propiedades_demo';

// El evento nativo "storage" del navegador solo dispara en OTRAS pestañas,
// nunca en la que hizo el cambio — así que sin esto, pausar desde
// OwnerActionsBar no avisaba a ContactForm/AgentCard/MobileContactCta en
// esa misma página hasta recargar. Este evento sí llega a todos los que
// escuchan en la misma pestaña.
export const ESTADO_OVERRIDE_EVENT = 'vive-estado-propiedad-cambio';

/**
 * Persiste en localStorage los cambios de estado (pausar/reactivar) de
 * cualquier propiedad — de muestra o creada en este navegador. Sin esto,
 * "Pausar" solo cambiaba estado dentro del componente que lo tocara — se
 * perdía al recargar y no lo veía nada más en la misma página (ni el
 * panel, ni la ficha pública, ni el formulario de contacto). Sigue siendo
 * una simulación de un solo navegador — pero ahora el estado se comparte de
 * forma consistente entre todo lo que lo lee en ese navegador, INCLUYENDO
 * la búsqueda pública (ver aplicarOverridesPublicos en
 * propiedadesLocales.ts) — pausar ya oculta de verdad de /propiedades,
 * /mapa, favoritos y comparar dentro de este navegador.
 *
 * ⚠️ BACKEND: este `estado` (activa/pausada/vencida/vendida/rentada) tiene
 * que ser una columna real en `Property` — ver el modelo sugerido al final
 * de prisma/schema.prisma. Es MVP, no solo "panel profesional": sin esto,
 * "Pausar"/"Eliminar" (parte explícita del alcance del MVP) no tienen
 * ningún efecto fuera del navegador de quien los usa.
 */
function readAll(): Record<string, EstadoPublicacion> {
  return readJson<Record<string, EstadoPublicacion>>(KEY, {});
}

export function getEstadoOverride(propertyId: string): EstadoPublicacion | null {
  return readAll()[propertyId] ?? null;
}

export function setEstadoOverride(propertyId: string, estado: EstadoPublicacion): void {
  const all = readAll();
  all[propertyId] = estado;
  writeJson(KEY, all);
  window.dispatchEvent(new CustomEvent(ESTADO_OVERRIDE_EVENT, { detail: { propertyId, estado } }));
}
