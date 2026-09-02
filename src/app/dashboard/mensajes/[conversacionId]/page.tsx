'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch, BACKEND_URL } from '@/lib/backendApi';
import { formatRelativeDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';
import type { MensajeChat } from '@/lib/mensajeria';

/**
 * Hilo de chat de una conversación — ver docs/superpowers/specs/
 * 2026-09-02-mensajeria-bidireccional-design.md. La conexión SSE (server-
 * sent events, un solo sentido servidor→navegador) solo existe MIENTRAS
 * este componente está montado — se abre al entrar, se cierra al salir
 * (cambiar de página, cerrar la pestaña). Es la pieza central de la
 * decisión de arquitectura: el número de conexiones simultáneas que el
 * backend sostiene queda acotado a "gente viendo un chat ahora mismo",
 * nunca a la base total de usuarios logueados — así se mantiene bajo el
 * consumo de memoria del servidor a escala de miles de usuarios, sin
 * necesitar WebSockets ni infraestructura nueva (Redis, gateway).
 *
 * Backend todavía sin construir — el EventSource simplemente no conecta
 * (falla en silencio, mismo criterio de "fire-and-forget" que
 * VistaTracker.tsx) hasta que exista `GET /conversaciones/:id/eventos`.
 */
export default function ConversacionPage() {
  const { conversacionId } = useParams<{ conversacionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idsVistosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!user) return;
    backendFetch<{ mensajes: MensajeChat[] }>(`/conversaciones/${conversacionId}/mensajes`)
      .then((d) => {
        const lista = d.mensajes ?? [];
        idsVistosRef.current = new Set(lista.map((m) => m.id));
        setMensajes(lista);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user, router, conversacionId]);

  // Conexión SSE — vive y muere con este componente. `withCredentials`
  // manda la cookie de sesión igual que backendFetch (`credentials:
  // 'include'`), necesaria porque el backend vive en un subdominio
  // distinto (api.vivevillahermosa.corestacksolutions.com.mx).
  useEffect(() => {
    if (!user) return;
    const es = new EventSource(`${BACKEND_URL}/conversaciones/${conversacionId}/eventos`, { withCredentials: true });
    es.addEventListener('mensaje_nuevo', (e: MessageEvent) => {
      try {
        const m = JSON.parse(e.data) as MensajeChat;
        if (idsVistosRef.current.has(m.id)) return;
        idsVistosRef.current.add(m.id);
        setMensajes((prev) => [...prev, m]);
      } catch { /* payload inesperado, se ignora — no es razón para tumbar la conexión */ }
    });
    // Sin manejo de error visible a propósito — si el backend todavía no
    // implementa esta ruta, el EventSource reintenta solo en silencio
    // (comportamiento nativo), mismo criterio "no bloquea nada mientras
    // no exista" que VistaTracker.tsx.
    return () => es.close();
  }, [user, conversacionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [mensajes]);

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    try {
      const { mensaje } = await backendFetch<{ mensaje: MensajeChat }>(`/conversaciones/${conversacionId}/mensajes`, {
        method: 'POST',
        body: JSON.stringify({ texto: limpio }),
      });
      if (!idsVistosRef.current.has(mensaje.id)) {
        idsVistosRef.current.add(mensaje.id);
        setMensajes((prev) => [...prev, mensaje]);
      }
      setTexto('');
    } catch { /* el input se queda con el texto — la persona puede reintentar sin haber perdido lo que escribió */
    } finally {
      setEnviando(false);
    }
  }

  if (authLoading || !user || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="w-48 mb-8" />
        <Skeleton variant="image" className="w-full h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col" style={{ height: 'calc(100dvh - 4rem)' }}>
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <Link href="/dashboard/mensajes" className="text-gray-400 hover:text-brand transition-colors flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-heading font-bold text-gray-900">Conversación</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-2xl p-4 space-y-2.5">
        {mensajes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin mensajes todavía — escribe el primero.</p>
        ) : (
          mensajes.map((m) => {
            const esMio = m.remitenteId === user.userId;
            return (
              <div key={m.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${esMio ? 'bg-brand text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.texto}</p>
                  <p className={`text-[10px] mt-1 ${esMio ? 'text-white/60' : 'text-gray-400'}`}>{formatRelativeDate(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 mt-3 flex-shrink-0">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Escribe un mensaje..."
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={!texto.trim() || enviando}
          aria-label="Enviar mensaje"
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand hover:bg-brand-dark text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
