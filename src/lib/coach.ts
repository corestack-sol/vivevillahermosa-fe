import type { Property } from '@/types/property';
import type { EstadoPublicacion, MiPropiedad } from '@/lib/misPropiedades';
import { detectarRiesgoInundacion } from '@/lib/zonas-inundacion';

/**
 * Capa 1 del "coach de calidad de anuncio" — heurística, sin IA, costo $0.
 * Corre sobre datos que ya trae GET /propiedades/mias, sin llamada extra.
 * Ver docs/BACKEND-AJUSTES-IA-21082026.md §2 para la capa 2 (IA cualitativa,
 * pendiente, atada a publicar/editar — no implementada aquí todavía).
 *
 * Solo sugerencias, nunca bloqueo — un falso positivo aquí no debe sentirse
 * como una acusación (mismo criterio ya usado para alertaFraude "medio").
 */
export interface RazonAtencion {
  clave: string;
  mensaje: string;
}

const FOTOS_SUGERIDAS = 3;
const DESCRIPCION_CORTA = 120;
const DIAS_SIN_MOVIMIENTO = 60;
const TITULO_GENERICO = 15;
const RIESGO_ORDEN: Record<'bajo' | 'medio' | 'alto', number> = { bajo: 0, medio: 1, alto: 2 };

function diasDesde(fechaIso: string): number {
  return Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86_400_000);
}

export function evaluarPropiedad(p: Property, estado: EstadoPublicacion): RazonAtencion[] {
  // vendida/rentada ya cerraron con éxito, vencida necesita "Renovar" (otro
  // flujo) — el coach solo tiene sentido para lo que sigue en circulación.
  if (estado !== 'activa' && estado !== 'pausada') return [];

  const razones: RazonAtencion[] = [];

  if (p.fotos.length < FOTOS_SUGERIDAS) {
    razones.push({
      clave: 'pocas-fotos',
      mensaje: p.fotos.length === 0
        ? 'No tiene fotos — los anuncios sin fotos casi no reciben contactos.'
        : `Solo tiene ${p.fotos.length} foto${p.fotos.length === 1 ? '' : 's'} — considera agregar más (mín. sugerido: ${FOTOS_SUGERIDAS}).`,
    });
  }

  if (p.descripcion.trim().length < DESCRIPCION_CORTA) {
    razones.push({
      clave: 'descripcion-corta',
      mensaje: 'La descripción es breve — agregar detalles sobre acabados, distribución o el entorno ayuda a generar más interés.',
    });
  }

  // No aplica a terrenos — casi nunca tienen alberca/gimnasio/etc., marcarlo
  // ahí sería ruido genérico que no encaja con ese tipo de propiedad.
  if (p.tipo !== 'terreno' && p.amenidades.length === 0) {
    razones.push({
      clave: 'sin-amenidades',
      mensaje: 'No tiene amenidades marcadas — si cuenta con alberca, seguridad, terraza, etc., agrégalas para que se vea en la ficha.',
    });
  }

  const dias = diasDesde(p.fechaPublicacion);
  if (estado === 'activa' && dias >= DIAS_SIN_MOVIMIENTO) {
    razones.push({
      clave: 'estancada',
      mensaje: `Lleva ${dias} días publicada — considera revisar el precio o actualizar las fotos.`,
    });
  }

  if (p.titulo.trim().length < TITULO_GENERICO) {
    razones.push({
      clave: 'titulo-generico',
      mensaje: 'El título es muy corto para destacar — usa "Generar título automático" al editar, o agrega colonia y características.',
    });
  }

  // Mismo catálogo (Atlas de Riesgos Municipal) que ya usa PublishForm.tsx
  // para sugerir el riesgo al publicar — aquí se vuelve a comparar contra lo
  // que la propiedad tiene GUARDADO, por si cambió de colonia al editar, o
  // se publicó antes de que esta colonia entrara al catálogo. Solo avisa
  // cuando el valor guardado es MÁS BAJO que el detectado (subestimar el
  // riesgo es lo que de verdad puede engañar a un interesado) — nunca al
  // revés, marcar un riesgo más alto del detectado no es un problema.
  const gis = detectarRiesgoInundacion(p.colonia, p.municipio);
  if (gis && RIESGO_ORDEN[p.riesgoInundacion] < RIESGO_ORDEN[gis.riesgo]) {
    razones.push({
      clave: 'riesgo-inconsistente',
      mensaje: `Tu anuncio marca riesgo de inundación "${p.riesgoInundacion}", pero el Atlas de Riesgos Municipal clasifica esta zona como "${gis.riesgo}" — revísalo antes de que alguien más lo note.`,
    });
  }

  return razones;
}

export interface PropiedadConAtencion {
  propiedad: MiPropiedad;
  razones: RazonAtencion[];
}

export function evaluarCartera(items: MiPropiedad[]): PropiedadConAtencion[] {
  return items
    .map((item) => ({ propiedad: item, razones: evaluarPropiedad(item.property, item.estado) }))
    .filter((r) => r.razones.length > 0);
}
