import { gemini, GEMINI_MODEL, withTimeout } from './geminiClient';

// Análisis por foto durante Publicar — no debe dejar al usuario esperando
// minutos por una sola imagen (gemini-3-flash-preview, al ser un modelo
// preview, tardó hasta 119s en pruebas reales bajo 503 "high demand").
const TIMEOUT_MS = 15_000;

export interface ResultadoImagenIA {
  apta: boolean;
  relacionada: boolean;
  señalesFraude: string[];
  notas: string;
}

// Resultado neutral cuando no se pudo analizar de verdad (sin API key, error
// de red, timeout) — "fail open": nunca bloquear publicar por una falla de
// infraestructura ajena al contenido real de la foto. Solo un bloqueo real
// del propio filtro de seguridad de Gemini (evidencia positiva de contenido
// inapropiado) devuelve apta:false — ver el catch específico abajo.
const RESULTADO_SIN_ANALIZAR: ResultadoImagenIA = {
  apta: true, relacionada: true, señalesFraude: [], notas: '',
};

const PROMPT = `Eres un moderador de contenido para un portal inmobiliario en México. Analiza la imagen adjunta y responde ÚNICAMENTE con un objeto JSON con esta forma exacta, sin texto adicional:

{
  "apta": boolean,          // false SOLO si la imagen contiene contenido explícito/sexual, violento o de otra forma inapropiado para un anuncio público
  "relacionada": boolean,   // false si la imagen claramente NO es una foto de un inmueble (ej. selfie, meme, captura de pantalla sin relación, producto, animal). Planos, fachadas, interiores, terrenos, documentos de la propiedad SÍ cuentan como relacionada.
  "señalesFraude": string[], // señales visuales de que la foto podría ser robada de otro sitio o no ser real (marca de agua de otro portal inmobiliario, texto "muestra"/"sample", watermark de stock photo, calidad/estilo inconsistente con una foto casera). Arreglo vacío si no hay ninguna señal clara.
  "notas": string           // una frase breve en español explicando el veredicto, o "" si todo está bien y no hace falta explicar nada
}

Sé conservador: ante la duda razonable, marca apta:true y relacionada:true — este análisis es una ayuda al revisor humano, no un filtro automático estricto.`;

/**
 * Se queda en Gemini (no OpenRouter, que se usa para el resto de la IA de
 * la plataforma — ver src/lib/ai.ts) porque no se encontró todavía un
 * modelo de visión confiable en tier gratuito ahí: se probó qwen/qwen3.6-27b
 * (vía Groq, antes de migrar el resto a OpenRouter) en agosto 2026 y
 * alucinó contenido que no estaba en la imagen (marca de agua inventada),
 * además de fallar con response_format:"json_object" en modo visión.
 * Revaluar si algún modelo de visión disponible en OpenRouter soluciona
 * eso — el resto de esta plataforma ya migró para no depender de un techo
 * de tokens diario.
 *
 * ⚠️ BACKEND: esta función ya está lista para reusarse tal cual del lado
 * del servidor en `POST /api/propiedades` (docs/BACKEND.md §3 y §8 —
 * este último cubre también el control de gasto por usuario) — no hay que
 * reescribirla. Hoy solo la llama `PublishForm.tsx` desde el navegador,
 * cuya decisión de bloquear (`fotoNoApta`) es evitable con devtools.
 */
export async function analizarImagenPropiedad(dataUrl: string): Promise<ResultadoImagenIA> {
  if (!gemini) {
    console.warn('[aiVision] GEMINI_API_KEY no configurado — no se analizó la imagen');
    return RESULTADO_SIN_ANALIZAR;
  }

  const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) return RESULTADO_SIN_ANALIZAR;
  const [, mimeType, data] = match;

  try {
    const response = await withTimeout(gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data } },
        ],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            apta: { type: 'boolean' },
            relacionada: { type: 'boolean' },
            señalesFraude: { type: 'array', items: { type: 'string' } },
            notas: { type: 'string' },
          },
          required: ['apta', 'relacionada', 'señalesFraude', 'notas'],
        },
      },
    }), TIMEOUT_MS, 'Gemini');

    // Gemini puede bloquear la respuesta por su propio filtro de seguridad
    // antes de generar nada — eso es evidencia POSITIVA de contenido
    // inapropiado (a diferencia de un error de red), así que aquí sí se
    // marca apta:false en vez de fallar abierto.
    const bloqueada = response.promptFeedback?.blockReason
      || response.candidates?.[0]?.finishReason === 'SAFETY';
    if (bloqueada) {
      return {
        apta: false, relacionada: true, señalesFraude: [],
        notas: 'El contenido fue bloqueado por el filtro de seguridad del modelo — probablemente inapropiado.',
      };
    }

    const texto = response.text;
    if (!texto) return RESULTADO_SIN_ANALIZAR;

    const parsed = JSON.parse(texto);
    return {
      apta: typeof parsed.apta === 'boolean' ? parsed.apta : true,
      relacionada: typeof parsed.relacionada === 'boolean' ? parsed.relacionada : true,
      señalesFraude: Array.isArray(parsed.señalesFraude) ? parsed.señalesFraude.filter((s: unknown) => typeof s === 'string') : [],
      notas: typeof parsed.notas === 'string' ? parsed.notas : '',
    };
  } catch (err) {
    console.error('[aiVision] Error analizando imagen', err);
    return RESULTADO_SIN_ANALIZAR;
  }
}
