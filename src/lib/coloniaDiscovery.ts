import { prisma } from './db';
import type { ColoniaCoord } from './colonias';
import { normalizarNombreColonia } from './colonias';
import { MUNICIPIO_OPTIONS } from './publishSchema';

/**
 * Descubrimiento automático de colonias — SOLO server-side (usa Prisma).
 * Nunca importar esto desde un componente cliente; para eso está
 * `GET /colonias/descubiertas` del backend + el caché del lado del
 * cliente en `colonias.ts`.
 *
 * Deliberadamente NO le pregunta al modelo de lenguaje dónde está una
 * colonia — un LLM no es un geocodificador y confiar en su memoria para
 * coordenadas es exactamente el tipo de alucinación que ya se evitó todo
 * este trabajo (ver REGLA 3 y el pipeline de resolución en ai.ts, que solo
 * eligen entre lugares YA verificados, nunca inventan uno). La fuente real
 * es OpenStreetMap/Nominatim, con el MISMO filtro de dos niveles usado para
 * verificar a mano las 70 colonias de `colonias.ts`: solo se acepta un
 * resultado `place/neighbourhood` o `leisure/park` con nombre igual al
 * buscado — nunca una calle, un negocio, o un polígono de uso de suelo
 * genérico (esos dieron falsos positivos reales durante la verificación
 * manual, ver la memoria del proyecto).
 */

const MUNICIPIOS_VALIDOS = MUNICIPIO_OPTIONS.map((m) => m.value);

function normalizarBase(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function slugify(s: string): string {
  return normalizarBase(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Nominatim exige no más de ~1 solicitud/segundo y un User-Agent real que
// identifique la app — este es el único lugar del código que le llama, así
// que basta un semáforo simple en memoria (por proceso) para respetarlo,
// sin importar cuántas búsquedas de usuarios distintos disparen un
// descubrimiento al mismo tiempo.
let ultimaLlamadaNominatim = 0;
async function esperarTurnoNominatim(): Promise<void> {
  const ahora = Date.now();
  const espera = Math.max(0, ultimaLlamadaNominatim + 1100 - ahora);
  ultimaLlamadaNominatim = ahora + espera;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

// Nombres que ya se intentaron y no dieron un resultado confiable en este
// proceso — evita re-golpear Nominatim con el mismo texto basura en cada
// búsqueda repetida de distintos usuarios mientras el servidor sigue
// corriendo. Se reinicia solo con un redeploy, igual que cualquier caché en
// memoria de este proyecto (ver cacheResolucionColonia en ai.ts).
const intentosFallidos = new Set<string>();

interface ResultadoNominatim {
  lat: string;
  lon: string;
  class: string;
  type: string;
  address?: { county?: string; state?: string };
}

async function geocodificarNominatim(nombre: string): Promise<ResultadoNominatim[]> {
  await esperarTurnoNominatim();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${nombre}, Tabasco, Mexico`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '3');
  url.searchParams.set('addressdetails', '1');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VivevillahermosaColoniaDiscovery/1.0 (contacto: soporte@vivevillahermosa.mx)' },
  });
  if (!res.ok) return [];
  return res.json();
}

/**
 * Intenta descubrir una colonia mencionada en una búsqueda que no coincidió
 * con nada catalogado (ni el catálogo estático ni las ya descubiertas
 * antes). Devuelve la colonia si Nominatim la resolvió con confianza (y ya
 * quedó guardada en la base de datos para futuras búsquedas), o `null` si
 * no — nunca lanza, nunca bloquea a quien llama por más de lo que tarda
 * Nominatim en responder.
 */
export async function descubrirColonia(nombreLibre: string): Promise<ColoniaCoord | null> {
  const cacheKey = normalizarBase(nombreLibre).trim();
  if (!cacheKey || intentosFallidos.has(cacheKey)) return null;

  // Ya descubierta antes (por esta misma búsqueda u otra persona) — no
  // hace falta volver a golpear Nominatim.
  const key = slugify(nombreLibre);
  const existente = await prisma.coloniaDescubierta.findUnique({ where: { key } });
  if (existente) return filaAColonia(existente);

  try {
    const resultados = await geocodificarNominatim(nombreLibre);
    const bueno = resultados.find(
      (r) =>
        r.address?.state?.toLowerCase() === 'tabasco' &&
        ((r.class === 'place' && r.type === 'neighbourhood') || (r.class === 'leisure' && r.type === 'park'))
    );
    if (!bueno) {
      intentosFallidos.add(cacheKey);
      return null;
    }

    const municipio = MUNICIPIOS_VALIDOS.find(
      (m) => normalizarBase(m) === normalizarBase(bueno.address?.county ?? '')
    );
    if (!municipio) {
      // Resolvió a algo real, pero fuera de los municipios que la
      // plataforma reconoce (ver MUNICIPIO_OPTIONS) — no se guarda, mismo
      // criterio que ya se aplicó a la cobertura manual (solo Centro por
      // ahora, esto simplemente lo generaliza a los otros 9 sin adivinar).
      intentosFallidos.add(cacheKey);
      return null;
    }

    const fila = await prisma.coloniaDescubierta.upsert({
      where: { key },
      create: {
        key,
        label: nombreLibre.trim(),
        municipio,
        lat: parseFloat(bueno.lat),
        lng: parseFloat(bueno.lon),
        radioKm: 1.3, // mismo default que RADIO_COLONIA_KM en colonias.ts
        fuenteTipo: `${bueno.class}/${bueno.type}`,
      },
      update: {},
    });
    return filaAColonia(fila);
  } catch (err) {
    console.error('[coloniaDiscovery] Error descubriendo colonia', err);
    intentosFallidos.add(cacheKey);
    return null;
  }
}

function filaAColonia(fila: {
  key: string; label: string; municipio: string; lat: number; lng: number; radioKm: number; aliasesJson: string | null;
}): ColoniaCoord {
  return {
    key: fila.key,
    label: fila.label,
    municipio: fila.municipio,
    lat: fila.lat,
    lng: fila.lng,
    radioKm: fila.radioKm,
    aliases: fila.aliasesJson ? JSON.parse(fila.aliasesJson) : undefined,
  };
}

/** Todas las colonias descubiertas hasta ahora — usado por la API que alimenta el caché del cliente y por el Server Component de la ficha de propiedad. */
export async function obtenerColoniasDescubiertas(): Promise<ColoniaCoord[]> {
  const filas = await prisma.coloniaDescubierta.findMany();
  return filas.map(filaAColonia);
}

/**
 * Busca por key exacta entre lo descubierto — usado por
 * `propiedades/[id]/page.tsx` (Server Component) como respaldo cuando
 * `getColoniaByKey` de colonias.ts no la encuentra: ese archivo corre
 * también en el navegador y por eso no puede consultar Prisma
 * directamente, solo su caché del lado del cliente (que un Server
 * Component nunca llega a poblar, al no ejecutarse en un navegador).
 */
export async function obtenerColoniaDescubiertaPorKey(key: string): Promise<ColoniaCoord | null> {
  const fila = await prisma.coloniaDescubierta.findUnique({ where: { key } });
  return fila ? filaAColonia(fila) : null;
}

/**
 * Busca por nombre libre entre lo YA descubierto (sin llamar a Nominatim ni
 * a la IA) — se llama ANTES de `resolverColoniaConIA` en ai.ts para no
 * gastar una llamada de pago preguntándole a la IA por una colonia que el
 * servidor ya conoce de una búsqueda anterior de cualquier usuario. El
 * catálogo de `resolverColoniaConIA` es solo las 70 estáticas (nunca
 * incluye lo descubierto), así que sin este paso esa llamada sale siempre
 * perdida para cualquier colonia descubierta después del último deploy.
 */
export async function buscarColoniaDescubiertaPorNombre(nombreLibre: string): Promise<ColoniaCoord | null> {
  const objetivo = normalizarNombreColonia(nombreLibre);
  if (!objetivo) return null;
  const todas = await obtenerColoniasDescubiertas();
  const encontrada = todas.find(
    (c) => normalizarNombreColonia(c.label) === objetivo || (c.aliases ?? []).some((a) => normalizarNombreColonia(a) === objetivo)
  );
  return encontrada ?? null;
}
