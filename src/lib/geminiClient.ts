import { GoogleGenAI } from '@google/genai';

// gemini-2.5-flash dejó de estar disponible para API keys nuevas en julio
// 2026 (404 "no longer available to new users", antes de su fecha de baja
// oficial) — gemini-3-flash-preview es el modelo Flash vigente con tier
// gratuito al momento de escribir esto. Si Google vuelve a renombrar el
// modelo, este es el único lugar que hay que actualizar.
//
// Desde la migración a OpenRouter (ver openRouterClient.ts), Gemini solo se
// usa para analizar fotos (aiVision.ts) — es el único de los dos
// proveedores con un modelo de visión estable en tier gratuito.
export const GEMINI_MODEL = 'gemini-3-flash-preview';

/**
 * Cliente de Gemini — usado solo por src/lib/aiVision.ts. Igual que Resend
 * en email.ts: sin GEMINI_API_KEY es `null`, así la función se salta con un
 * aviso en consola en vez de fallar de forma ruidosa.
 */
export const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export { withTimeout } from './aiTimeout';
