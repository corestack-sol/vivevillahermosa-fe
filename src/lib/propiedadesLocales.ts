import type { Property } from '@/types/property';
import type { MiPropiedad, EstadoPublicacion } from './misPropiedadesDemo';
import { getMisPropiedadesDemo } from './misPropiedadesDemo';
import { readJson, writeJson } from './localStore';
import { getEstadoOverride } from './estadoOverrides';
import { getPuntoPublico } from './colonias';

const KEY_CREADAS = 'vivevillahermosa_propiedades_creadas';
const KEY_EDICIONES = 'vivevillahermosa_propiedades_ediciones';
const KEY_ELIMINADAS = 'vivevillahermosa_propiedades_eliminadas';
const KEY_DESTACADOS = 'vivevillahermosa_propiedades_destacados';

// Igual que ESTADO_OVERRIDE_EVENT en estadoOverrides.ts: el evento nativo
// "storage" del navegador no dispara en la misma pestaña que hizo el
// cambio, así que Publicar/Editar/Eliminar/Importar necesitan avisar por su
// cuenta a quien esté escuchando (dashboard, OwnerActionsBar) en esa misma
// página.
export const PROPIEDADES_LOCALES_EVENT = 'vive-propiedades-locales-cambio';

function emitirCambio() {
  window.dispatchEvent(new CustomEvent(PROPIEDADES_LOCALES_EVENT));
}

/**
 * ⚠️ DATOS DE MUESTRA, PERSISTIDOS SOLO EN ESTE NAVEGADOR — no hay
 * `POST /api/propiedades` real todavía (ver docs/BACKEND.md).
 * Publicar/editar/eliminar aquí se siente real (persiste, sobrevive un
 * refresh, se refleja en el reporte y en la ficha pública) pero es una
 * simulación de un solo navegador, igual que src/lib/estadoOverrides.ts —
 * no dos personas ven las mismas propiedades "creadas". Cuando exista el
 * backend, este módulo se reemplaza por llamadas reales sin tocar las
 * páginas que lo consumen (mismo patrón "quirúrgico" ya usado para pausar/
 * archivar).
 */

/**
 * Repara al vuelo una propiedad guardada en localStorage ANTES de que
 * `latPublico`/`lngPublico` existieran en el tipo `Property` (ver el fix de
 * privacidad de ubicación) — sin esto, esas propiedades viejas traen
 * `latPublico`/`lngPublico` en `undefined`, y `jitterCoord` los convierte en
 * `NaN`, lo que hace que Leaflet truene (`Invalid LatLng object: (NaN,
 * NaN)`) a medio dibujar los pines — no solo se ve mal esa propiedad, deja
 * de agregar el resto de los pines del mapa también, porque el error corta
 * el `forEach` a la mitad.
 */
function conPuntoPublico(p: Property): Property {
  if (typeof p.latPublico === 'number' && typeof p.lngPublico === 'number') return p;
  const punto = getPuntoPublico(p.id, p.lat, p.lng, p.colonia);
  return { ...p, latPublico: punto.lat, lngPublico: punto.lng };
}

export function getPropiedadesCreadas(): Property[] {
  return readJson<Property[]>(KEY_CREADAS, []).map(conPuntoPublico);
}

export function crearPropiedad(property: Property): void {
  const creadas = getPropiedadesCreadas();
  creadas.unshift(property);
  writeJson(KEY_CREADAS, creadas);
  emitirCambio();
}

export function crearPropiedades(properties: Property[]): void {
  const creadas = getPropiedadesCreadas();
  writeJson(KEY_CREADAS, [...properties, ...creadas]);
  emitirCambio();
}

/**
 * Resuelve una propiedad creada en este navegador por id o slug — usado por
 * LocalPropertyDetail.tsx, la contraparte de `getPropertyById` (src/lib/api.ts)
 * para ids `local-...`, que nunca están en el catálogo estático server-side.
 * A propósito NO filtra por estado pausado/archivado (a diferencia de
 * `aplicarOverridesPublicos`, pensado para listados públicos) — mismo
 * comportamiento que ya tiene `getPropertyById` con las propiedades de
 * muestra: pausar oculta de la búsqueda, pero la ficha sigue siendo
 * visible/gestionable por su dueño desde su propia URL.
 *
 * ⚠️ BACKEND: esta función entera (y LocalPropertyDetail.tsx, que la usa)
 * deja de hacer falta con `GET /api/propiedades/:id` real — hoy existe solo
 * porque un id `local-...` no vive en ningún lado que el servidor pueda
 * consultar. Con Property en Prisma, un solo `getPropertyById` (server-side,
 * ver comentario en src/lib/api.ts) sirve para todos los casos.
 */
export function obtenerPropiedadLocalPorId(id: string): Property | undefined {
  const eliminadas = new Set(getEliminadas());
  const ediciones = getEdiciones();
  const encontrada = getPropiedadesCreadas().find((p) => p.id === id || p.slug === id);
  if (!encontrada || eliminadas.has(encontrada.id)) return undefined;
  const cambios = ediciones[encontrada.id];
  return cambios ? { ...encontrada, ...cambios } : encontrada;
}

function getEdiciones(): Record<string, Partial<Property>> {
  return readJson<Record<string, Partial<Property>>>(KEY_EDICIONES, {});
}

/**
 * Si `id` es una propiedad creada localmente, el cambio se aplica directo a
 * su registro. Si es una de las 4 propiedades del catálogo estático de
 * muestra, no se puede mutar ese JSON — se guarda solo el diff y se aplica
 * al leer (ver `getMisPropiedadesConOverrides`).
 */
export function editarPropiedad(id: string, cambios: Partial<Property>): void {
  const creadas = getPropiedadesCreadas();
  const idx = creadas.findIndex((p) => p.id === id);
  if (idx !== -1) {
    creadas[idx] = { ...creadas[idx], ...cambios };
    writeJson(KEY_CREADAS, creadas);
    emitirCambio();
    return;
  }

  const ediciones = getEdiciones();
  ediciones[id] = { ...ediciones[id], ...cambios };
  writeJson(KEY_EDICIONES, ediciones);
  emitirCambio();
}

function getEliminadas(): string[] {
  return readJson<string[]>(KEY_ELIMINADAS, []);
}

/** Soft-delete — aplica tanto a propiedades del catálogo demo como a las creadas localmente. */
export function eliminarPropiedad(id: string): void {
  const eliminadas = new Set(getEliminadas());
  eliminadas.add(id);
  writeJson(KEY_ELIMINADAS, Array.from(eliminadas));
  emitirCambio();
}

function getDestacadosMap(): Record<string, string> {
  return readJson<Record<string, string>>(KEY_DESTACADOS, {});
}

/**
 * Marca una propiedad como destacada por `dias` días. Reutiliza
 * `Property.featured` (ya existía en el tipo pero ninguna UI lo leía) para
 * el estado on/off, y guarda la fecha de expiración aparte porque no es un
 * dato intrínseco de la propiedad sino de la campaña de destacado.
 *
 * Límite de alcance a propósito: esto NO reordena los resultados de
 * búsqueda/zonas públicas (esas páginas leen el catálogo estático). Afectar
 * ese orden solo en tu propio navegador no demuestra el valor real de la
 * función — aparecer primero para *otros* usuarios — así que no vale la
 * pena el hack solo-cliente. Reordenar de verdad es trivial una vez exista
 * `Property` real en base de datos.
 */
export function destacarPropiedad(id: string, dias: number): void {
  const hasta = new Date(Date.now() + dias * 86_400_000).toISOString();
  const mapa = getDestacadosMap();
  mapa[id] = hasta;
  writeJson(KEY_DESTACADOS, mapa);
  editarPropiedad(id, { featured: true });
}

/** Fecha ISO de expiración si la propiedad sigue destacada, o null si nunca se destacó o ya expiró. */
export function getDestacadoHasta(id: string): string | null {
  const hasta = getDestacadosMap()[id];
  if (!hasta) return null;
  return new Date(hasta).getTime() > Date.now() ? hasta : null;
}

/**
 * Días restantes hasta que expire el destacado. Vive aquí (y no como
 * función local en la página) porque el linter de pureza de React marca
 * cualquier `Date.now()` que sea visible dentro del cuerpo de un
 * componente — moverlo a otro módulo, igual que `getDestacadoHasta`, evita
 * el falso positivo sin perder la lógica.
 */
export function diasRestantesDestacado(hasta: string): number {
  return Math.max(1, Math.ceil((new Date(hasta).getTime() - Date.now()) / 86_400_000));
}

function publicadaHaceTexto(fechaPublicacion: string): string {
  const dias = Math.floor((Date.now() - new Date(fechaPublicacion).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'hace 1 día';
  return `hace ${dias} días`;
}

/**
 * Aplica creadas/ediciones/eliminadas sobre el resultado de
 * `getMisPropiedadesDemo()`. Debe llamarse solo desde un efecto de cliente
 * (nunca como valor inicial de useState) — igual que
 * `getEstadoOverride`/`ESTADO_OVERRIDE_EVENT`, lee `localStorage` y por lo
 * tanto solo puede resolverse después de la hidratación, para que el primer
 * render en servidor y cliente coincidan.
 */
export function getMisPropiedadesConOverrides(base: MiPropiedad[]): MiPropiedad[] {
  const eliminadas = new Set(getEliminadas());
  const ediciones = getEdiciones();

  const catalogo = base
    .filter((mp) => !eliminadas.has(mp.property.id))
    .map((mp) => {
      const cambios = ediciones[mp.property.id];
      return cambios ? { ...mp, property: { ...mp.property, ...cambios } } : mp;
    });

  const creadas: MiPropiedad[] = getPropiedadesCreadas()
    .filter((p) => !eliminadas.has(p.id))
    .map((p) => ({
      property: p,
      estado: 'activa',
      vistas: 0,
      contactos: 0,
      favoritos: 0,
      publicadaHace: publicadaHaceTexto(p.fechaPublicacion),
    }));

  return [...creadas, ...catalogo];
}

/**
 * Límite gratuito de propiedades ACTIVAS por cuenta (2026-08-09, pedido
 * explícito del usuario) — a propósito por ACTIVIDAD (cuántas propiedades
 * activas tiene la cuenta), no por `rol`: hoy `rol` solo distingue
 * 'buscador'|'propietario'|'agente' a nivel de registro, sin ninguna forma
 * real de separar a un agente independiente de una inmobiliaria — un
 * volumen alto de propiedades activas es la señal real de que se trata de
 * uso comercial, sin importar qué rol se haya elegido al registrarse. Un
 * usuario normal (dueño publicando su propia casa) rara vez pasa de 1-2;
 * alguien con cartera de verdad topa rápido y necesita un plan.
 *
 * ⚠️ Esto es una verificación de FRONTEND, evadible como cualquier otra en
 * esta simulación de un solo navegador (localStorage, sin `Property.userId`
 * real) — borrar el storage o abrir otro navegador la resetea. La versión
 * que de verdad cumple esto tiene que vivir en el backend nuevo — ver
 * docs/BACKEND.md §3 (nota "Límite de propiedades activas por cuenta").
 */
export const LIMITE_PROPIEDADES_GRATIS = 4;

/** Cuenta las propiedades ACTIVAS de "mis propiedades" (creadas en este
 *  navegador + el catálogo demo con sus overrides) — mismo criterio que ya
 *  usa el resto de la plataforma para "activa" (ver EstadoPublicacion).
 *  Debe llamarse solo desde un efecto de cliente, mismo motivo que
 *  `getMisPropiedadesConOverrides` (lee localStorage). */
export function contarPropiedadesActivas(): number {
  return getMisPropiedadesConOverrides(getMisPropiedadesDemo())
    .filter((mp) => mp.estado === 'activa')
    .length;
}

/**
 * Aplica creadas/ediciones/eliminadas/pausadas sobre una lista pública de
 * `Property[]` (catálogo estático o el resultado de `getAllProperties()`) —
 * a diferencia de `getMisPropiedadesConOverrides` (para "Mis propiedades",
 * que muestra TODO sin importar el estado), esto es para las páginas que
 * cualquier visitante puede ver (`/propiedades`, `/mapa`, favoritos,
 * comparar): antes de esto, publicar una propiedad la guardaba en
 * localStorage pero ninguna búsqueda pública la leía de ahí — publicar y
 * buscar eran dos sistemas que nunca se cruzaban, ni siquiera para quien
 * la acababa de publicar. Sigue siendo una simulación de un solo navegador
 * (sin backend real no hay forma de que otro usuario la vea), pero ahora al
 * menos ese navegador es internamente consistente: lo que publicas aparece
 * en tu propia búsqueda, lo que pausas desaparece de ella, lo que editas se
 * refleja, lo que eliminas se va.
 *
 * Debe llamarse solo desde un efecto de cliente (mismo motivo que
 * `getMisPropiedadesConOverrides`) — nunca como valor inicial de useState.
 *
 * ⚠️ BACKEND: esta función (y cada lugar que la llama — PropertiesClient.tsx,
 * MapaClient.tsx, favoritos/page.tsx, comparar/page.tsx) deja de hacer falta
 * en cuanto `GET /api/propiedades` filtre por `estado`/`activa` del lado del
 * servidor. El `estado` (activa/pausada/vencida/vendida/rentada) que hoy lee
 * de estadoOverrides.ts necesita ser una columna real en `Property` — ver el
 * modelo sugerido al final de prisma/schema.prisma.
 */
export function aplicarOverridesPublicos(base: Property[]): Property[] {
  const eliminadas = new Set(getEliminadas());
  const ediciones = getEdiciones();

  function estaActiva(id: string): boolean {
    const estado: EstadoPublicacion = getEstadoOverride(id) ?? 'activa';
    return estado === 'activa';
  }

  const catalogo = base
    .filter((p) => !eliminadas.has(p.id) && estaActiva(p.id))
    .map((p) => {
      const cambios = ediciones[p.id];
      return cambios ? { ...p, ...cambios } : p;
    });

  const creadas = getPropiedadesCreadas()
    .filter((p) => !eliminadas.has(p.id) && estaActiva(p.id))
    .map((p) => {
      const cambios = ediciones[p.id];
      return cambios ? { ...p, ...cambios } : p;
    });

  return [...creadas, ...catalogo];
}
