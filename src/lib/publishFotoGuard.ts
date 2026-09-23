/**
 * Lógica pura del bloqueo de publicar por fotos — extraída de
 * PublishForm.tsx (mismo criterio que publishFraudGuard.ts) para poder
 * probarla sin montar el formulario completo.
 *
 * Auditoría 2026-09-23, a partir de un reporte real ("subo 1 foto y no
 * puedo publicar", "subo 2, una carga bien, y aun así no puedo publicar").
 * Verificado en vivo contra POST /ia/analizar-imagen (cuenta desechable,
 * 6 fotos reales/sintéticas distintas): NINGUNA de las 6 volvió con
 * `apta: false` — pero CUATRO de las 6 (una cueva, una fachada de museo,
 * una playa, una foto completamente negra) volvieron con
 * `relacionada: false`, con notas como "La imagen muestra un museo, no
 * una propiedad en venta." Eso confirma que el bloqueo real que más
 * ocurre en la práctica es el de UNA sola foto con `relacionada: false`
 * (`unicaFotoConAdvertencia`), no el de `apta: false` (`fotoNoApta`, que
 * en 6 intentos nunca se disparó) — el modelo de IA es más estricto
 * juzgando "¿esto parece una propiedad en venta?" que detectando
 * contenido inapropiado.
 */

export interface ResultadoImagenIA {
  apta: boolean;
  relacionada: boolean;
  señalesFraude: string[];
  notas: string;
  amenidadesDetectadas?: string[];
}

export type AnalisisFoto = 'pendiente' | ResultadoImagenIA;

export interface EstadoFoto {
  pendiente: boolean;
  /** IA terminó y marcó la foto como no apta (contenido inapropiado). */
  noApta: boolean;
  /** IA terminó, apta, pero no parece del inmueble o trae señal de fraude. */
  advertencia: boolean;
}

export interface EvaluacionFotos {
  sinFotos: boolean;
  /** Alguna foto (de cualquier cantidad) marcada no apta — bloquea siempre. */
  fotoNoApta: boolean;
  /** La ÚNICA foto del set trae advertencia — bloquea solo en ese caso. */
  unicaFotoConAdvertencia: boolean;
  /** true si CUALQUIERA de los dos anteriores bloquea publicar. */
  bloqueaPublicar: boolean;
  /** Mismo estado por foto que ya pinta cada miniatura (orden = `fotos`). */
  porFoto: EstadoFoto[];
}

function estadoDe(analisis: AnalisisFoto): EstadoFoto {
  const pendiente = analisis === 'pendiente';
  const noApta = !pendiente && !analisis.apta;
  const advertencia = !pendiente && analisis.apta
    && (!analisis.relacionada || analisis.señalesFraude.length > 0);
  return { pendiente, noApta, advertencia };
}

/**
 * Único punto de verdad de "¿esta foto/este set de fotos deja publicar?" —
 * PublishForm.tsx llama esto mismo para el botón Siguiente/Publicar Y para
 * pintar cada miniatura, así los dos nunca pueden desincronizarse.
 */
export function evaluarFotos(fotos: { analisis: AnalisisFoto }[]): EvaluacionFotos {
  const porFoto = fotos.map((f) => estadoDe(f.analisis));
  const sinFotos = fotos.length === 0;
  const fotoNoApta = porFoto.some((e) => e.noApta);
  const unicaFotoConAdvertencia = fotos.length === 1 && porFoto[0].advertencia;
  return {
    sinFotos,
    fotoNoApta,
    unicaFotoConAdvertencia,
    bloqueaPublicar: fotoNoApta || unicaFotoConAdvertencia,
    porFoto,
  };
}
