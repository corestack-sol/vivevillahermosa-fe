'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Phone, Mail, MessageCircle, Eye, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { loginRedirectUrl } from '@/lib/authRedirect';
import { backendFetch } from '@/lib/backendApi';
import { whatsappUrl } from '@/lib/phone';

interface Contacto {
  telefono: string;
  whatsapp: string | null;
  email: string | null;
}

/**
 * Mismo patrón de revelado que AgentCard.tsx (propiedades): instantáneo con
 * sesión iniciada, cero acceso anónimo — el servidor (contacto/route.ts)
 * exige sesión, así que ni se intenta el fetch si `user` es null.
 */
export function ServiceContactCard({ servicioId, nombre }: { servicioId: string; nombre: string }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function revelar() {
    setLoading(true);
    setError(false);
    try {
      setContacto(await backendFetch<Contacto>(`/servicios/${servicioId}/contacto`));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <Link
          href={loginRedirectUrl(pathname)}
          className="flex items-center justify-center gap-2 w-full bg-brand hover:bg-brand-dark text-white font-semibold text-sm py-2.5 rounded-xl transition-all active:scale-[0.98]"
        >
          <LogIn size={16} /> Inicia sesión para ver el contacto
        </Link>
        <p className="text-xs mt-2 text-center text-gray-400">
          Así evitamos que bots cosechen números en lote — a las personas reales no les cuesta nada de más.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
      {contacto ? (
        <>
          {contacto.whatsapp && (
            <a
              href={whatsappUrl(contacto.whatsapp, `Hola, vi tu servicio "${nombre}" en Vive Villahermosa y me interesa.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] text-white"
              style={{ backgroundColor: '#25D366' }}
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          )}
          <a
            href={`tel:${contacto.telefono}`}
            className="flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl border border-brand text-brand hover:bg-brand-pale transition-all active:scale-[0.98]"
          >
            <Phone size={16} /> Llamar
          </a>
          {contacto.email && (
            <a
              href={`mailto:${contacto.email}?subject=${encodeURIComponent(`Consulta: ${nombre}`)}`}
              className="flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl border border-brand text-brand hover:bg-brand-pale transition-all active:scale-[0.98]"
            >
              <Mail size={16} /> Correo
            </a>
          )}
        </>
      ) : (
        <div>
          <button
            type="button"
            onClick={revelar}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full bg-brand hover:bg-brand-dark text-white font-semibold text-sm py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            {loading ? 'Cargando...' : 'Ver información de contacto'}
          </button>
          {error && <p className="text-xs mt-2 text-center text-red-500">No se pudo cargar el contacto. Intenta de nuevo.</p>}
        </div>
      )}
    </div>
  );
}
