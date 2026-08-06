import OpenAI from 'openai';

/**
 * Llama 3.3 70B Instruct, vía OpenRouter — mismo modelo que se usaba
 * directo en Groq (antes `llama-3.3-70b-versatile`), así que ningún prompt
 * de src/lib/ai.ts necesitó reescribirse. Se migró de Groq a OpenRouter
 * porque el cuello de botella real era el límite de TOKENS POR DÍA de Groq
 * (100,000 TPD, se agotó dos veces en la misma sesión solo con pruebas de
 * desarrollo).
 *
 * ⚠️ Usa el slug DE PAGO (`meta-llama/llama-3.3-70b-instruct`), no
 * `:free` — se probó la variante gratuita primero, pero devolvió un 404
 * real en pruebas: "This model is unavailable for free. The paid version
 * is available now" — OpenRouter presta la capacidad gratuita de este
 * modelo de mejor esfuerzo, compartida entre todos sus usuarios, y puede
 * desaparecer sin aviso. La variante de pago no tiene ese problema y sale
 * MÁS BARATA que llamar a Groq directo ($0.10/$0.32 por 1M tokens vs.
 * $0.59/$0.79), sin techo diario — solo requiere que la cuenta de
 * OpenRouter tenga saldo cargado.
 */
export const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct';

/**
 * Cliente de OpenRouter — usado por src/lib/ai.ts para búsqueda
 * inteligente, detección de fraude en texto, generación de descripciones y
 * resumen de reportes. Igual que Resend en email.ts: sin
 * OPENROUTER_API_KEY es `null`, así cada función se salta con un aviso en
 * consola en vez de fallar de forma ruidosa.
 *
 * OpenRouter expone una API compatible con el SDK de OpenAI (por eso se usa
 * el paquete `openai`, no uno propio) — solo cambia `baseURL` y el nombre
 * del modelo. `defaultHeaders` es opcional pero recomendado por OpenRouter
 * para que las llamadas de esta app aparezcan atribuidas en su dashboard
 * (no afecta el comportamiento del modelo).
 *
 * La visión (análisis de fotos) se queda en Gemini — ver geminiClient.ts.
 */
export const openrouter = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Vive Villahermosa',
      },
    })
  : null;

export { withTimeout } from './aiTimeout';
