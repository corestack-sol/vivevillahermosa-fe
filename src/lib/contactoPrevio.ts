/**
 * Datos de contacto de la ÚLTIMA propiedad publicada por la misma persona
 * (GET /propiedades/mias los devuelve), para precargar el WhatsApp y sus
 * preferencias de contacto en el formulario de publicar — quien ya publicó
 * antes no debería reescribirlos cada vez. Nombre y correo NO salen de aquí:
 * vienen fijos de la cuenta (ver CampoDeCuenta.tsx).
 */
export interface MiaContacto {
  createdAt?: string;
  agenteWhatsapp?: string | null;
  agenteEmail?: string | null;
  requiereMensajePrimero?: boolean | null;
}

export interface ContactoPrevio {
  whatsapp?: string;
  metodo: 'whatsapp' | 'correo' | 'ambos';
  requiereMensajePrimero: boolean;
}

export function contactoDeUltimaPropiedad(propiedades: MiaContacto[]): ContactoPrevio | null {
  const conContacto = propiedades.filter((p) => p.agenteWhatsapp?.trim() || p.agenteEmail?.trim());
  if (conContacto.length === 0) return null;
  const ultima = [...conContacto].sort((a, b) => (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0))[0];
  const whatsapp = ultima.agenteWhatsapp?.trim() || undefined;
  const correo = !!ultima.agenteEmail?.trim();
  return {
    whatsapp,
    metodo: whatsapp && correo ? 'ambos' : whatsapp ? 'whatsapp' : 'correo',
    requiereMensajePrimero: !!ultima.requiereMensajePrimero,
  };
}
