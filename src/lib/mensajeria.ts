// Tipos del sistema de mensajería bidireccional — ver
// docs/superpowers/specs/2026-09-02-mensajeria-bidireccional-design.md
// para el contrato completo. Backend todavía sin construir al momento de
// este archivo; las formas de aquí son el contrato acordado, no algo ya
// verificado en vivo (a diferencia de casi todo lo demás en src/lib/api.ts).

export interface MensajeChat {
  id: string;
  texto: string;
  remitenteId: string;
  createdAt: string;
}

export interface ConversacionResumen {
  id: string;
  propiedad: { id: string; titulo: string; slug: string; foto: string | null };
  otraPersona: { id: string; nombre: string };
  ultimoMensaje: { texto: string; createdAt: string; remitenteId: string } | null;
  noLeidos: number;
}
