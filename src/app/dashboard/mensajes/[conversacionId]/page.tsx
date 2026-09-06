'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Building2, MoreVertical, Ban, Flag, ShieldOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { backendFetch, BackendApiError, BACKEND_URL } from '@/lib/backendApi';
import { formatRelativeDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';
import { useClickOutside } from '@/hooks/useClickOutside';
import type { MensajeChat, ConversacionResumen } from '@/lib/mensajeria';
import { ModeracionUsuarioModal } from '@/components/mensajeria/ModeracionUsuarioModal';

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
  const toast = useToast();

  // Bloquear/reportar — pedido explícito 2026-09-07. Backend nuevo, ver
  // docs/BACKEND-BLOQUEO-REPORTE-USUARIOS-07092026.md (no existe todavía,
  // confirmado en vivo con 8 variantes de endpoint probadas). Mientras el
  // backend no lo tenga, estas llamadas van a fallar en silencio (mismo
  // criterio "no bloquea nada mientras no exista" que el resto de esta
  // pantalla) — el botón queda listo para funcionar en cuanto exista.
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [modalAccion, setModalAccion] = useState<'bloquear' | 'reportar' | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, menuAbierto, () => setMenuAbierto(false));

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
          backendFetch<{ bloqueado: boolean }>(`/usuarios/${conv.otraPersona.id}/bloqueado`)
            .then((d2) => setBloqueado(d2.bloqueado))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [authLoading, user, router, conversacionId]);

  async function bloquear(motivo: string, motivoDetalle: string | undefined) {
    if (!otraPersona) return;
    try {
      await backendFetch(`/usuarios/${otraPersona.id}/bloquear`, {
        method: 'POST',
        body: JSON.stringify({ motivo, motivoDetalle }),
      });
      setBloqueado(true);
      toast.success(`Bloqueaste a ${otraPersona.nombre}.`);
    } catch (err) {
      toast.error(err instanceof BackendApiError ? err.message : 'No se pudo bloquear.');
    }
  }

  async function desbloquear() {
    if (!otraPersona) return;
    try {
      await backendFetch(`/usuarios/${otraPersona.id}/desbloquear`, { method: 'POST' });
      setBloqueado(false);
      toast.success(`Desbloqueaste a ${otraPersona.nombre}.`);
    } catch (err) {
      toast.error(err instanceof BackendApiError ? err.message : 'No se pudo desbloquear.');
    }
  }

  async function reportar(motivo: string, motivoDetalle: string | undefined, tambienBloquear: boolean) {
    if (!otraPersona) return;
    try {
      await backendFetch(`/usuarios/${otraPersona.id}/reportar`, {
        method: 'POST',
        body: JSON.stringify({ motivo, motivoDetalle, conversacionId }),
      });
      toast.success('Reporte enviado — un administrador lo va a revisar.');
    } catch (err) {
      toast.error(err instanceof BackendApiError ? err.message : 'No se pudo enviar el reporte.');
    }
    if (tambienBloquear) await bloquear('otro', 'Reportado y bloqueado');
  }

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
        <h1 className="text-lg font-heading font-bold text-gray-900 truncate flex-1">{otraPersona?.nombre ?? 'Conversación'}</h1>

        {/* Bloquear/reportar — pedido explícito 2026-09-07. */}
        {otraPersona && (
          <div ref={menuRef} className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label="Más opciones"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <MoreVertical size={18} />
            </button>
            {menuAbierto && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden z-20 w-48">
                {bloqueado ? (
                  <button
                    type="button"
                    onClick={() => { setMenuAbierto(false); desbloquear(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left transition-colors"
                  >
                    <ShieldOff size={14} /> Desbloquear
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setMenuAbierto(false); setModalAccion('bloquear'); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left transition-colors"
                  >
                    <Ban size={14} /> Bloquear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMenuAbierto(false); setModalAccion('reportar'); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left transition-colors"
                >
                  <Flag size={14} /> Reportar
                </button>
              </div>
            )}
          </div>
        )}
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
            // El avatar usa el nombre REAL incluso en los mensajes propios
            // — pedido explícito 2026-09-07 ("¿es de Tú?"): "Tú" es la
            // etiqueta que se lee arriba de la burbuja, pero la inicial del
            // círculo debe ser la del nombre de verdad, igual que ya pasa
            // del lado del interesado.
            const inicial = (esMio ? user.nombre : nombreRemitente).trim().charAt(0).toUpperCase();
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

      {bloqueado ? (
        <div className="flex items-center justify-between gap-3 mt-3 flex-shrink-0 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-sm text-gray-500">
            Bloqueaste a <strong className="text-gray-700">{otraPersona?.nombre}</strong> — ya no puede escribirte.
          </p>
          <button type="button" onClick={desbloquear} className="flex-shrink-0 text-xs font-semibold text-brand hover:text-brand-dark transition-colors">
            Desbloquear
          </button>
        </div>
      ) : (
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
      )}

      {otraPersona && modalAccion && (
        <ModeracionUsuarioModal
          isOpen={!!modalAccion}
          onClose={() => setModalAccion(null)}
          accion={modalAccion}
          nombrePersona={otraPersona.nombre}
          onConfirm={(motivo, motivoDetalle, tambienBloquear) => {
            if (modalAccion === 'bloquear') bloquear(motivo, motivoDetalle);
            else reportar(motivo, motivoDetalle, tambienBloquear);
          }}
        />
      )}
    </div>
  );
}
