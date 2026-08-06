import { readJson, writeJson } from './localStore';

export type EstadoLead = 'nuevo' | 'contactado' | 'visito' | 'negociando' | 'cerrado' | 'perdido';

export const ESTADO_LEAD_CFG: Record<EstadoLead, { label: string; cls: string }> = {
  nuevo:      { label: 'Nuevo',       cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  contactado: { label: 'Contactado',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  visito:     { label: 'Visitó',      cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  negociando: { label: 'Negociando',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  cerrado:    { label: 'Cerrado',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  perdido:    { label: 'Perdido',     cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export const ORDEN_PIPELINE: EstadoLead[] = ['nuevo', 'contactado', 'visito', 'negociando', 'cerrado', 'perdido'];

export interface Lead {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  propiedadId: string | null;
  propiedadTitulo: string | null;
  origen: 'Formulario de contacto' | 'Llamada' | 'Referido';
  fecha: string;
  notas: string | null;
}

const KEY_ESTADOS = 'vivevillahermosa_leads_estados';

/**
 * ⚠️ DATOS DE MUESTRA — no existe todavía una entidad "lead" real en el
 * backend (ver docs/BACKEND.md §15). Cuando el
 * formulario de contacto persista de verdad, cada mensaje nuevo debería
 * crear un registro aquí automáticamente; por ahora esta lista es fija y
 * solo el `estado` de cada lead se puede cambiar (persistido en
 * localStorage, igual que el resto del panel profesional).
 */
function getLeadsBase(): Lead[] {
  return [
    { id: 'lead-01', nombre: 'Roberto Gómez', telefono: '9931110001', email: null, propiedadId: 'prop-001', propiedadTitulo: 'Casa en Tabasco 2000 con jardín y alberca', origen: 'Formulario de contacto', fecha: diasAtras(1), notas: 'Preguntó si acepta mascotas.' },
    { id: 'lead-02', nombre: 'Lucía Fernández', telefono: null, email: 'lucia.fernandez@example.com', propiedadId: 'prop-003', propiedadTitulo: 'Departamento moderno en Carrizal, amueblado', origen: 'Formulario de contacto', fecha: diasAtras(2), notas: null },
    { id: 'lead-03', nombre: 'Marco Antonio Ruiz', telefono: '9932220002', email: null, propiedadId: 'prop-004', propiedadTitulo: 'Terreno 600 m² en Paraíso, cerca de Dos Bocas', origen: 'Llamada', fecha: diasAtras(3), notas: 'Interesado en construir para renta a trabajadores de Dos Bocas.' },
    { id: 'lead-04', nombre: 'Ana Paula Torres', telefono: '9933330003', email: 'anapaula.torres@example.com', propiedadId: 'prop-002', propiedadTitulo: 'Casa en renta en Gaviotas Norte, 3 recámaras', origen: 'Formulario de contacto', fecha: diasAtras(4), notas: 'Busca casa para su familia, viene con esposo.' },
    { id: 'lead-05', nombre: 'Diego Hernández', telefono: '9934440004', email: null, propiedadId: null, propiedadTitulo: null, origen: 'Referido', fecha: diasAtras(5), notas: 'Lo refirió Roberto Gómez — todavía sin propiedad definida.' },
    { id: 'lead-06', nombre: 'Sofía Jiménez', telefono: '9935550005', email: 'sofia.jimenez@example.com', propiedadId: 'prop-003', propiedadTitulo: 'Departamento moderno en Carrizal, amueblado', origen: 'Formulario de contacto', fecha: diasAtras(7), notas: 'Amueblado es requisito.' },
    { id: 'lead-07', nombre: 'Contratista PEMEX — Grupo Ibarra', telefono: '9936660006', email: null, propiedadId: 'prop-004', propiedadTitulo: 'Terreno 600 m² en Paraíso, cerca de Dos Bocas', origen: 'Llamada', fecha: diasAtras(9), notas: 'Preguntar por permisos de uso de suelo.' },
    { id: 'lead-08', nombre: 'Karla Méndez', telefono: null, email: null, propiedadId: null, propiedadTitulo: null, origen: 'Formulario de contacto', fecha: diasAtras(11), notas: null },
    { id: 'lead-09', nombre: 'Fernando Castillo', telefono: '9937770007', email: 'fernando.castillo@example.com', propiedadId: 'prop-002', propiedadTitulo: 'Casa en renta en Gaviotas Norte, 3 recámaras', origen: 'Formulario de contacto', fecha: diasAtras(15), notas: 'Viene de fuera, solo disponible los fines de semana.' },
    { id: 'lead-10', nombre: 'Patricia Reyes', telefono: '9938880008', email: null, propiedadId: 'prop-001', propiedadTitulo: 'Casa en Tabasco 2000 con jardín y alberca', origen: 'Referido', fecha: diasAtras(20), notas: 'La refirió Roberto Gómez.' },
  ];
}

function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Estado inicial de cada lead de muestra — separado del array base para que
// el override de localStorage tenga algo determinístico contra qué
// comparar (si no hay override guardado, se usa este valor).
const ESTADO_INICIAL: Record<string, EstadoLead> = {
  'lead-01': 'negociando',
  'lead-02': 'contactado',
  'lead-03': 'cerrado',
  'lead-04': 'visito',
  'lead-05': 'nuevo',
  'lead-06': 'contactado',
  'lead-07': 'visito',
  'lead-08': 'nuevo',
  'lead-09': 'perdido',
  'lead-10': 'nuevo',
};

function getEstados(): Record<string, EstadoLead> {
  return readJson<Record<string, EstadoLead>>(KEY_ESTADOS, {});
}

export type LeadConEstado = Lead & { estado: EstadoLead };

/**
 * Versión pura (no toca localStorage) — segura como valor inicial de
 * useState, para que el primer render en servidor y cliente coincidan.
 * `aplicarEstadosGuardados` se encarga de traer los cambios reales desde un
 * efecto, igual que el resto del panel profesional.
 */
export function getLeadsDemo(): LeadConEstado[] {
  return getLeadsBase().map((lead) => ({
    ...lead,
    estado: ESTADO_INICIAL[lead.id] ?? 'nuevo',
  }));
}

export function aplicarEstadosGuardados(leads: LeadConEstado[]): LeadConEstado[] {
  const overrides = getEstados();
  return leads.map((lead) => (overrides[lead.id] ? { ...lead, estado: overrides[lead.id] } : lead));
}

export function moverLead(id: string, estado: EstadoLead): void {
  const overrides = getEstados();
  overrides[id] = estado;
  writeJson(KEY_ESTADOS, overrides);
}
