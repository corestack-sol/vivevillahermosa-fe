'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Phone, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';
import { formatRelativeDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';

interface MensajeRecibido {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  mensaje: string;
  leido: boolean;
  createdAt: string;
}

/**
 * Antes de esto, un propietario que recibía una notificación de contacto
 * no tenía a dónde ir a ver quién le escribió — la notificación mandaba a
 * la ficha pública de su propia propiedad, que no muestra nada de eso
 * (pedido explícito 2026-09-01/02, ver docs/BACKEND-INBOX-MENSAJES-
 * 01092026.md, confirmado en vivo 2026-09-02 que ya existe del lado del
 * backend). Sin acción de "marcar leído" a propósito — el endpoint no la
 * expone hoy, y el punto no leído/leído (`m.leido`) solo se usa como
 * indicador visual, no como algo que esta pantalla pueda cambiar.
 */
export default function MensajesPropiedadPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [titulo, setTitulo] = useState('');
  const [mensajes, setMensajes] = useState<MensajeRecibido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!user) return;
    Promise.all([
      backendFetch<{ titulo: string }>(`/propiedades/${id}`),
      backendFetch<{ mensajes: MensajeRecibido[] }>(`/propiedades/${id}/mensajes`),
    ])
      .then(([p, m]) => {
        setTitulo(p.titulo);
        setMensajes(m.mensajes ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user, router, id]);

  if (authLoading || !user || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="w-48 mb-8" />
        <Skeleton variant="image" className="w-full h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/propiedades" className="text-gray-400 hover:text-brand transition-colors flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-gray-900">Mensajes recibidos</h1>
          {titulo && <p className="text-sm text-gray-500 truncate">{titulo}</p>}
        </div>
      </div>

      {mensajes.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle size={32} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Sin mensajes todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mensajes.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  {!m.leido && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                  {m.nombre}
                </p>
                <p className="text-xs text-gray-400 flex-shrink-0">{formatRelativeDate(m.createdAt)}</p>
              </div>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-3 leading-relaxed">{m.mensaje}</p>
              <div className="flex items-center gap-4 flex-wrap">
                <a href={`tel:${m.telefono}`} className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline">
                  <Phone size={13} /> {m.telefono}
                </a>
                {m.email && (
                  <a href={`mailto:${m.email}`} className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline">
                    <Mail size={13} /> {m.email}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
