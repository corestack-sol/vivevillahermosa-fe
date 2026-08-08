import { NextResponse } from 'next/server';
import { z } from 'zod';
import { busquedaInteligente, busquedaInteligenteHeuristica } from '@/lib/ai';
import { getBusquedaCache } from '@/lib/busquedaCache';
import { registrarCacheHit, registrarHeuristicaRespaldo } from '@/lib/busquedaStats';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getSession } from '@/lib/auth';

const schema = z.object({
  // .trim() antes de min(1): sin esto, un query de solo espacios pasaba la
  // validación y gastaba una llamada real a OpenRouter para terminar
  // devolviendo {} de todas formas — mismo resultado que el 400 de abajo,
  // pero pagando el costo de la llamada innecesariamente.
  query: z.string().trim().min(1).max(300),
});

/**
 * Antes, un rate-limit alcanzado o CUALQUIER error inesperado (no solo uno
 * de OpenRouter — `busquedaInteligenteInterna` ya tenía su propio respaldo
 * heurístico para eso) hacía que la búsqueda completa cayera al cliente
 * como `{}`, y de ahí a comparar la oración completa como texto literal
 * (ver interpretarBusqueda.ts) — un buscador "inteligente" que se vuelve
 * inútil en cuanto algo, lo que sea, falla no cumple su propósito. El
 * límite de tasa protege el presupuesto de OpenRouter, no el CPU — la
 * heurística no hace ninguna llamada externa, así que no hay ningún motivo
 * para negársela a alguien rate-limiteado. Este handler ahora tiene un solo
 * criterio: la ÚNICA respuesta vacía válida es cuando ni siquiera hay un
 * `query` que interpretar (400) — cualquier otra cosa que salga mal
 * responde con la heurística en vez de nada.
 */
export async function POST(request: Request) {
  let query: string | undefined;
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    query = parsed.data.query;

    // Chequeo de caché ANTES del límite de tasa (2026-08-08) — el límite
    // protege el presupuesto de OpenRouter (ver comentario de arriba), y
    // una búsqueda repetida que ya se resolvió hace menos de una hora
    // (src/lib/busquedaCache.ts) no le cuesta nada a OpenRouter, así que no
    // debería gastar ese presupuesto tampoco. Sin esto, en horas pico las
    // búsquedas más comunes ("casa en renta") competirían por el mismo cupo
    // que las que sí necesitan una llamada real. `busquedaInteligente()` ya
    // vuelve a revisar la caché por su cuenta (fuente de la verdad, por si
    // se llama desde otro lado en el futuro) — este es solo un atajo para
    // saltarse el límite de tasa cuando ya sabemos que no hace falta.
    const cacheado = getBusquedaCache(query);
    if (cacheado) {
      registrarCacheHit();
      return NextResponse.json(cacheado);
    }

    const ip = getClientIp(request);
    const limited = checkRateLimit(`ia:busqueda:${ip}`, 30, 10 * 60 * 1000);
    // Backstop global — el límite por IP de arriba se evade mandando un
    // X-Forwarded-For distinto en cada solicitud (ver getClientIp en
    // src/lib/rateLimit.ts). Esta cuenta es compartida entre todos los
    // usuarios, así que acota el peor caso aunque no distinga quién abusa.
    //
    // Subido de 300 a 900 (2026-08-08) — el tráfico esperado tiene dos
    // formas, ninguna cubierta por el número original: concentrado
    // geográficamente en Centro (mismas colonias/landmarks mencionados una
    // y otra vez) y, si la plataforma se viraliza, un pico nacional de
    // gente buscando de forma genérica ("casas en Tabasco"). Ambas formas
    // son justo donde la caché (busquedaCache.ts, ver arriba) rinde más —
    // más solicitudes NO significa más llamadas reales a OpenRouter en la
    // misma proporción, porque las búsquedas repetidas/parecidas nunca
    // llegan a este backstop (se resuelven antes, en caché). Sin cifras
    // reales de tráfico todavía, así que 900 es una cota razonada, no
    // medida — el panel de admin (/admin, tarjeta "Buscador con IA") ahora
    // trae `tasaCacheHit`/`tasaDegradacion` para volver a calibrar esto con
    // datos reales en cuanto haya tráfico de producción.
    const global = checkRateLimit('ia:busqueda:global', 900, 10 * 60 * 1000);
    if (!limited.ok || !global.ok) {
      registrarHeuristicaRespaldo();
      return NextResponse.json(busquedaInteligenteHeuristica(query));
    }

    // Con sesión iniciada, un intento de manipular el buscador se registra
    // contra la cuenta (ver moderacionBusqueda.ts) — anónimo solo sigue el
    // rate-limit por IP de arriba, no tiene cuenta que avisar/bloquear.
    const session = await getSession();
    const filtros = await busquedaInteligente(query, session?.userId);
    return NextResponse.json(filtros);
  } catch (err) {
    console.error('[busqueda-inteligente] Error inesperado, cae a heurística', err);
    // Si ya se alcanzó a leer `query` (el error fue después), la heurística
    // sigue siendo mejor que nada. Si ni siquiera eso se logró (body
    // malformado, etc.), ahí sí no hay nada que interpretar.
    if (query) {
      registrarHeuristicaRespaldo();
      return NextResponse.json(busquedaInteligenteHeuristica(query));
    }
    return NextResponse.json({ error: 'Error al interpretar la búsqueda' }, { status: 500 });
  }
}
