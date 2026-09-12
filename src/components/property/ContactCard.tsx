'use client';

import { ContactForm } from '@/components/forms/ContactForm';
import { useEsMiPropiedad } from '@/hooks/useEsMiPropiedad';

interface ContactCardProps {
  propertyId: string;
  propertyTitle: string;
  ownerName: string;
}

/**
 * Card "Enviar mensaje" completa — desaparece del todo si quien ve la
 * propiedad es su propio dueño (pedido explícito 2026-09-01: antes se
 * quedaba el mismo recuadro con un mensaje adentro, "no tiene sentido que
 * aparezca en absoluto"). OwnerActionsBar ya cubre la gestión real de la
 * propiedad para el dueño, esta card no le sirve de nada.
 *
 * `!== false` (no solo el `true` de dueño confirmado) — mientras
 * useEsMiPropiedad todavía no sabe (`null`), también se esconde: mostrarla
 * de entrada y quitarla un instante después, si resulta que sí es el
 * dueño, era justo el parpadeo reportado 2026-09-02.
 */
export function ContactCard({ propertyId, propertyTitle, ownerName }: ContactCardProps) {
  const esMiPropiedad = useEsMiPropiedad(propertyId);
  if (esMiPropiedad !== false) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-20" id="contacto">
      <div className="px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-1.5">Enviar mensaje</p>
        {/* Esta card solo aparece cuando Property.requiereMensajePrimero es
            true (ver PropertyDetailView.tsx) — sin esta línea, quien la ve
            no tiene forma de saber POR QUÉ le toca escribir un mensaje en
            vez del contacto directo de siempre (pedido explícito
            2026-09-12). */}
        <p className="text-sm text-gray-500 mb-4">
          {ownerName} prefiere recibir un mensaje antes de compartir su contacto directo.
        </p>
        <ContactForm propertyTitle={propertyTitle} propertyId={propertyId} ownerName={ownerName} />
      </div>
    </div>
  );
}
