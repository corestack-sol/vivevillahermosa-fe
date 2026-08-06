'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PropertyAgent } from '@/types/property';
import { Mail, BadgeCheck, Eye, Loader2, PauseCircle, Archive, MessageCircle, Phone, LogIn, ShieldAlert } from 'lucide-react';
import { usePropiedadEstado } from '@/hooks/usePropiedadEstado';
import { useAuth } from '@/context/AuthContext';
import { loginRedirectUrl } from '@/lib/authRedirect';

// Subconjunto público y seguro de mostrar de entrada — nombre y estado de
// verificación no son datos sensibles.
type PublicAgentInfo = Pick<PropertyAgent, 'nombre' | 'verificado'>;
type Contacto = Pick<PropertyAgent, 'tel' | 'email' | 'whatsapp'>;

interface AgentCardProps {
  agent: PublicAgentInfo;
  propiedadId: string;
  propertyTitle: string;
  // Ver Property.requiereMensajePrimero en src/types/property.ts — por
  // defecto (false/undefined) el contacto es de revelado instantáneo.
  requiereMensajePrimero?: boolean;
  // true cuando la cuenta detrás de esta propiedad quedó bloqueada por uso
  // indebido repetido del buscador (3 intentos confirmados, ver
  // src/lib/moderacionBusqueda.ts) — ver el comentario junto al badge más
  // abajo para el criterio de tono/lenguaje.
  enRevision?: boolean;
  naked?: boolean;
  dark?: boolean;
}

export function AgentCard({ agent, propiedadId, propertyTitle, requiereMensajePrimero = false, enRevision = false, naked = false, dark = false }: AgentCardProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  // Privacidad real (no solo visual): el contacto no viaja en el HTML
  // inicial de la página — se pide al servidor recién cuando el visitante
  // decide explícitamente verlo. El servidor además exige sesión iniciada
  // (ver route.ts) — un visitante sin cuenta nunca llega a tener éxito en
  // este fetch, así que ni lo intentamos si `user` es null.
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const estadoNoDisponible = usePropiedadEstado(propiedadId);
  const archivada = estadoNoDisponible === 'vendida' || estadoNoDisponible === 'rentada';

  async function revelar() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/propiedades/${propiedadId}/contacto`);
      if (!res.ok) throw new Error('request failed');
      const data: Contacto = await res.json();
      setContacto(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={naked ? '' : 'bg-white border border-gray-200 rounded-2xl p-5 shadow-sm'}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-lg ${dark ? 'bg-white/20 text-white' : 'bg-brand-pale text-brand'}`}>
          {agent.nombre.charAt(0)}
        </div>
        <div>
          <p className={`font-semibold text-sm ${dark ? 'text-white' : 'text-gray-800'}`}>{agent.nombre}</p>
          {agent.verificado ? (
            <span className={`inline-flex items-center gap-1 text-xs ${dark ? 'text-white/60' : 'text-brand'}`}>
              <BadgeCheck size={12} /> Agente verificado
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>
              Contacto directo
            </span>
          )}
          {/* Lenguaje deliberadamente neutral ("en revisión", no "sospechoso"
              ni "poco confiable") — es una señal de precaución para quien
              visita, no una acusación pública permanente. Solo aparece
              cuando la cuenta llegó al 3er intento confirmado de manipular
              el buscador (ver moderacionBusqueda.ts), nunca antes. */}
          {enRevision && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full mt-1 w-fit"
              title="Nuestro sistema detectó actividad inusual en esta cuenta. Te recomendamos verificar con cuidado antes de continuar."
            >
              <ShieldAlert size={11} className="flex-shrink-0" /> En revisión
            </span>
          )}
        </div>
      </div>

      {estadoNoDisponible ? (
        <p className={`flex items-center justify-center gap-1.5 text-xs text-center rounded-xl px-3 py-2.5 ${
          dark ? 'text-white/50 bg-white/5 border border-white/10' : 'text-gray-400 bg-gray-50 border border-gray-100'
        }`}>
          {archivada ? <Archive size={14} className="flex-shrink-0" /> : <PauseCircle size={14} className="flex-shrink-0" />}
          {estadoNoDisponible === 'vendida' ? 'Propiedad vendida — sin contacto disponible'
            : estadoNoDisponible === 'rentada' ? 'Propiedad rentada — sin contacto disponible'
            : 'Publicación pausada — sin contacto disponible'}
        </p>
      ) : !user ? (
        // Sin sesión no hay ningún camino para ver tel/whatsapp/correo —
        // ni siquiera se intenta el fetch, el servidor lo rechazaría igual.
        <div>
          <Link
            href={loginRedirectUrl(pathname)}
            className={`flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] ${
              dark ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' : 'bg-brand hover:bg-brand-dark text-white'
            }`}
          >
            <LogIn size={16} />
            Inicia sesión para ver el contacto
          </Link>
          <p className={`text-xs mt-2 text-center ${dark ? 'text-white/50' : 'text-gray-400'}`}>
            Así evitamos que bots cosechen números en lote — a las personas reales no les cuesta nada de más.
          </p>
        </div>
      ) : requiereMensajePrimero ? (
        <div className="space-y-2">
          {contacto ? (
            contacto.email && (
              <a
                href={`mailto:${contacto.email}?subject=${encodeURIComponent(`Consulta: ${propertyTitle}`)}`}
                className={`flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] border ${
                  dark
                    ? 'border-white/30 text-white hover:bg-white/10'
                    : 'border-brand text-brand hover:bg-brand-pale'
                }`}
              >
                <Mail size={16} />
                Correo
              </a>
            )
          ) : (
            <div>
              <button
                type="button"
                onClick={revelar}
                disabled={loading}
                className={`flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 ${
                  dark
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                    : 'bg-brand hover:bg-brand-dark text-white'
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                {loading ? 'Cargando...' : 'Ver correo de contacto'}
              </button>
              {error && (
                <p className={`text-xs mt-2 text-center ${dark ? 'text-red-300' : 'text-red-500'}`}>
                  No se pudo cargar el contacto. Intenta de nuevo.
                </p>
              )}
            </div>
          )}
          {/* El propietario de esta propiedad activó "mensaje primero" al
              publicar — su WhatsApp no se revela aquí, hay que escribirle
              y es él quien decide si responde y comparte su número. */}
          <p className={`flex items-center justify-center gap-1.5 text-xs text-center ${dark ? 'text-white/50' : 'text-gray-400'}`}>
            <MessageCircle size={13} className="flex-shrink-0" />
            ¿Prefieres WhatsApp? Escríbele un mensaje abajo.
          </p>
        </div>
      ) : contacto ? (
        <div className="space-y-2">
          {contacto.whatsapp && (
            <a
              href={`https://wa.me/${contacto.whatsapp.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(`Hola, vi tu propiedad "${propertyTitle}" en Vive Villahermosa y me interesa.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] text-white"
              style={{ backgroundColor: '#25D366' }}
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
          )}
          {contacto.tel && (
            <a
              href={`tel:${contacto.tel}`}
              className={`flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] border ${
                dark ? 'border-white/30 text-white hover:bg-white/10' : 'border-brand text-brand hover:bg-brand-pale'
              }`}
            >
              <Phone size={16} />
              Llamar
            </a>
          )}
          {contacto.email && (
            <a
              href={`mailto:${contacto.email}?subject=${encodeURIComponent(`Consulta: ${propertyTitle}`)}`}
              className={`flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] border ${
                dark ? 'border-white/30 text-white hover:bg-white/10' : 'border-brand text-brand hover:bg-brand-pale'
              }`}
            >
              <Mail size={16} />
              Correo
            </a>
          )}
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={revelar}
            disabled={loading}
            className={`flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 ${
              dark
                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                : 'bg-brand hover:bg-brand-dark text-white'
            }`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            {loading ? 'Cargando...' : 'Ver información de contacto'}
          </button>
          {error && (
            <p className={`text-xs mt-2 text-center ${dark ? 'text-red-300' : 'text-red-500'}`}>
              No se pudo cargar el contacto. Intenta de nuevo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
