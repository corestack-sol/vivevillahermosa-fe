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
