// Google AdSense — pedido explícito 2026-09-08: "por unos meses no se
// cobrará un peso, hay que pagar servicios para que la plataforma se
// mantenga funcionando". Plomería lista para activarse el día que existan
// credenciales reales (NEXT_PUBLIC_ADSENSE_CLIENT_ID + un ID de bloque por
// espacio) — hasta entonces, AdSlot.tsx cae a un placeholder inerte, nunca
// carga el script de Google ni reserva la cookie de terceros que ese
// script trae consigo. Ver el comentario grande en AdSlot.tsx para el
// resto del contrato.
export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '';

export const ADSENSE_ENABLED = ADSENSE_CLIENT_ID.length > 0;

// Un ID de bloque de anuncio por espacio — pedido explícito de mantenerlos
// centralizados (no uno hardcodeado por página) para que activar/mover un
// espacio sea cambiar una env var, nunca tocar el JSX de la página. Cada
// NEXT_PUBLIC_ADSENSE_SLOT_* se crea en el panel de AdSense por separado
// (un "bloque de anuncios" = un ID de slot), incluso si varios espacios
// comparten el mismo tamaño/formato — Google los reporta por separado.
export const ADSENSE_SLOTS = {
  guiaArticulo: process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIA ?? '',
  propiedadesInFeed: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PROPIEDADES ?? '',
  homeInline: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME ?? '',
  zonasInline: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ZONAS ?? '',
  propiedadSidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PROPIEDAD_SIDEBAR ?? '',
} as const;

export type AdSlotKey = keyof typeof ADSENSE_SLOTS;

/**
 * Auditoría 2026-09-29: AdSense marcó el sitio con "Anuncios publicados por Google en
 * pantallas sin contenido de publicadores" + "Contenido de bajo valor". Google define
 * "bajo valor" como texto de relleno sin valor real para quien lo lee (su propio
 * ejemplo: "lorem ipsum") — y el catálogo de demostración tiene justo eso: 30 de 31
 * propiedades reales en producción comparten la descripción "Anuncio de demostración
 * para revisar el catálogo del sitio..." palabra por palabra. Cada una de esas fichas
 * ya lleva `AdSlot slot="propiedadSidebar"` al lado — exactamente "anuncio junto a
 * pantalla sin contenido real" para el rastreador de Google.
 *
 * Marcador literal y exacto (nunca lo escribiría el dueño real de una propiedad) —
 * cero riesgo de falso positivo contra una descripción real, aunque sea corta o
 * genérica. No intenta detectar la SEGUNDA plantilla de demo (más parecida a lo que
 * escribiría una persona real) porque ahí sí hay riesgo real de apagar el anuncio en
 * una propiedad legítima por error — esa se resuelve reemplazando el dato en el
 * backend, no adivinando un patrón de texto aquí.
 */
const MARCADOR_DESCRIPCION_DEMO = 'Anuncio de demostración';

export function esDescripcionDemo(descripcion: string): boolean {
  return descripcion.includes(MARCADOR_DESCRIPCION_DEMO);
}
