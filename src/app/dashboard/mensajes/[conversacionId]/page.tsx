'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch, BACKEND_URL } from '@/lib/backendApi';
import { formatRelativeDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';
import type { MensajeChat, ConversacionResumen } from '@/lib/mensajeria';

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
 * Backend confirmado en vivo 2026-09-06 (`GET /conversaciones/:id/
 * eventos`, `GET`/`POST /conversaciones/:id/mensajes`, `POST
 * /propiedades/:id/mensajes` para el primer contacto).
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
  // Mini-ficha de la propiedad + nombre completo de la otra persona en el
  // header — pedido explícito 2026-09-06/07 ("quiero ver el nombre
  // completo del interesado"). No existe un GET /conversaciones/:id que
  // devuelva esto solo (confirmado en vivo: 404), así que se reusa GET
  // /mensajes/conversaciones (la bandeja completa, que SÍ trae `propiedad`
  // y `otraPersona` por conversación) y se busca la que coincide con este
  // id — un viaje de más contra tener que pedirle al backend un endpoint
  // nuevo solo para esto.
  const [propiedad, setPropiedad] = useState<ConversacionResumen['propiedad'] | null>(null);
  const [otraPersona, setOtraPersona] = useState<ConversacionResumen['otraPersona'] | null>(null);

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
    backendFetch<{ conversaciones: ConversacionResumen[] }>('/mensajes/conversaciones')
      .then((d) => {
        const conv = (d.conversaciones ?? []).find((c) => c.id === conversacionId);
        if (conv) {
          setPropiedad(conv.propiedad);
          setOtraPersona(conv.otraPersona);
        }
      })
      .catch(() => {});
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
        {/* Nombre completo de la otra persona — pedido explícito
            2026-09-07, antes decía siempre "Conversación" a secas sin
            decir con quién. */}
        <h1 className="text-lg font-heading font-bold text-gray-900 truncate">{otraPersona?.nombre ?? 'Conversación'}</h1>
      </div>

      {/* Mini-ficha de la propiedad — pedido explícito 2026-09-06: "una
          foto mini de la propiedad por la cual se le contactó, y que al
          presionarla envíe a la página de la propiedad misma". Enlaza a
          la ficha pública; el resto de la pantalla (leer/responder) se
          queda aquí mismo. */}
      {propiedad && (
        <Link
          href={`/propiedades/${propiedad.slug}`}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-4 flex-shrink-0 hover:border-brand/30 hover:shadow-sm transition-all"
        >
          <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
            {propiedad.foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- mismo patrón que dashboard/mensajes/page.tsx
              <img src={propiedad.foto} alt="" className="w-full h-full object-cover" />
            ) : (
              <Building2 size={18} className="text-gray-300" />
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate min-w-0">{propiedad.titulo}</p>
        </Link>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        {mensajes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin mensajes todavía — escribe el primero.</p>
        ) : (
          mensajes.map((m, i) => {
            const esMio = m.remitenteId === user.userId;
            // Estructura de chat real — pedido explícito 2026-09-07: antes
            // solo cambiaba el color/lado de la burbuja, sin nada que diga
            // de quién es cada mensaje. Ahora cada uno lleva un avatar
            // (inicial) del lado que le toca y, cuando cambia el remitente
            // respecto al mensaje anterior, una etiqueta con el nombre
            // ("Tú" para los propios) — no se repite en cada burbuja
            // seguida del mismo remitente, para no saturar.
            const nombreRemitente = esMio ? 'Tú' : (otraPersona?.nombre ?? 'Interesado');
            const cambioDeRemitente = i === 0 || mensajes[i - 1].remitenteId !== m.remitenteId;
            const inicial = nombreRemitente.trim().charAt(0).toUpperCase();
            return (
              <div key={m.id} className={`flex items-end gap-2 ${esMio ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${esMio ? 'bg-brand text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {inicial}
                </div>
                <div className={`flex flex-col max-w-[75%] ${esMio ? 'items-end' : 'items-start'}`}>
                  {cambioDeRemitente && (
                    <p className={`text-[11px] font-semibold mb-1 px-1 ${esMio ? 'text-brand' : 'text-gray-500'}`}>{nombreRemitente}</p>
                  )}
                  <div className={`rounded-2xl px-3.5 py-2 ${esMio ? 'bg-brand text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.texto}</p>
                    <p className={`text-[10px] mt-1 ${esMio ? 'text-white/60' : 'text-gray-400'}`}>{formatRelativeDate(m.createdAt)}</p>
                  </div>
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
