'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { CheckCircle, ShieldAlert, LogIn, ArrowRight, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { loginRedirectUrl } from '@/lib/authRedirect';
import { usePropiedadEstado } from '@/hooks/usePropiedadEstado';
import { estadoNoDisponibleInfo } from '@/lib/misPropiedades';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import type { ConversacionResumen } from '@/lib/mensajeria';

const schema = z.object({
  mensaje: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres'),
});

type FormData = z.infer<typeof schema>;

interface ContactFormProps {
  propertyTitle: string;
  propertyId: string;
  ownerName: string;
  dark?: boolean;
}

export function ContactForm({ propertyTitle, propertyId, ownerName, dark = false }: ContactFormProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const estadoNoDisponible = usePropiedadEstado(propertyId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Ya sabemos quién es — no tiene sentido volver a pedirle nombre/correo
  // (el sistema de mensajería ya identifica al remitente por su sesión).
  // `reset()` en un efecto (en vez de `values` en useForm) para que solo se
  // aplique cuando `user` realmente cambia, no en cada tecleo del mensaje.
  useEffect(() => {
    if (!user) return;
    reset({
      mensaje: 'Hola, vi esta propiedad en Vive Villahermosa y me gustaría recibir más información.',
    });
  }, [user, reset]);

  const [conversacionId, setConversacionId] = useState<string | null>(null);
  // true si `sent` quedó así por encontrar una conversación YA existente
  // (revisita) en vez de por enviar el mensaje justo ahora — cambia el
  // copy de abajo ("¡Mensaje enviado!" no tiene sentido en una revisita).
  const [yaExistia, setYaExistia] = useState(false);
  // Mientras se resuelve, no se sabe si mostrar el formulario vacío o el
  // botón "Ver conversación" — sin este gate, quien ya escribió antes veía
  // el formulario en blanco un instante antes de saltar a la conversación
  // (pedido explícito 2026-09-12: "que siga mostrando el botón de ver
  // conversación" si ya mandó mensaje antes).
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    function sinSesion() { setCheckingExisting(false); }
    if (!user) { sinSesion(); return; }
    let cancelado = false;
    // Mismo endpoint que ya usa /dashboard/mensajes (GET /mensajes/
    // conversaciones) — no existe un "¿ya hay conversación con esta
    // propiedad?" dedicado, así que se filtra la lista completa del
    // usuario por propiedad.id.
    backendFetch<{ conversaciones: ConversacionResumen[] }>('/mensajes/conversaciones')
      .then(({ conversaciones }) => {
        if (cancelado) return;
        const existente = conversaciones.find((c) => c.propiedad.id === propertyId);
        if (existente) {
          setConversacionId(existente.id);
          setYaExistia(true);
          setSent(true);
        }
      })
      // Fail-open: si el chequeo falla, se cae al formulario normal — peor
      // caso, alguien que ya escribió ve el form de nuevo (no un bloqueo).
      .catch(() => {})
      .finally(() => { if (!cancelado) setCheckingExisting(false); });
    return () => { cancelado = true; };
  }, [user, propertyId]);

  // Migrado 2026-09-06 de POST /propiedades/:id/contactar (solo mandaba un
  // correo, nunca quedaba registrado ni ligado a la propiedad de forma
  // consultable — reporte real del usuario) a POST /propiedades/:id/
  // mensajes, el sistema de mensajería bidireccional construido el
  // 2026-09-02. Confirmado en vivo con 2 cuentas de prueba: crea la
  // Conversacion+Mensaje real, dispara la notificación al dueño con
  // conversacionId (ya rutea bien, ver notificacionHref en
  // useNotificaciones.ts) y aparece en /dashboard/mensajes con foto y
  // título de la propiedad.
  const onSubmit = async (data: FormData) => {
    setSendError(null);
    try {
      const { conversacionId: id } = await backendFetch<{ conversacionId: string }>(`/propiedades/${propertyId}/mensajes`, {
        method: 'POST',
        body: JSON.stringify({ texto: data.mensaje }),
      });
      setConversacionId(id);
      setSent(true);
    } catch (err) {
      setSendError(err instanceof BackendApiError ? err.message : 'No se pudo enviar el mensaje, intenta de nuevo.');
    }
  };

  const labelCls = dark ? 'text-white/80' : 'text-gray-700';
  const textareaCls = dark
    ? 'bg-white/10 border-white/25 text-white placeholder-white/40 focus:ring-white/20 focus:border-white/50'
    : errors.mensaje
      ? 'border-danger'
      : 'border-gray-200 focus:border-brand focus:ring-brand/40';

  // Una publicación pausada, vencida o ya archivada (vendida/rentada) no
  // debe recibir mensajes nuevos — mostrar el formulario (o los datos de
  // contacto) sería contradecir esa decisión. Copy exacto por estado en
  // estadoNoDisponibleInfo() (misPropiedades.ts).
  if (estadoNoDisponible) {
    const info = estadoNoDisponibleInfo(estadoNoDisponible);
    return (
      <div className="text-center py-6">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 ${dark ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-400'}`}>
          <info.Icon size={20} strokeWidth={1.75} />
        </div>
        <h3 className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-800'}`}>
          {info.titulo}
        </h3>
        <p className={`text-sm leading-relaxed ${dark ? 'text-white/60' : 'text-gray-500'}`}>
          {info.mensaje}
        </p>
      </div>
    );
  }

  // Contactar a un propietario requiere sesión — antes cualquiera podía
  // enviar el formulario sin registrarse, lo que también dejaba pasar
  // mensajes sin forma real de darles seguimiento desde un panel.
  if (!user) {
    return (
      <div className="text-center py-5">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 ${dark ? 'bg-white/10 text-white' : 'bg-brand-pale text-brand'}`}>
          <LogIn size={20} strokeWidth={1.75} />
        </div>
        <h3 className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-800'}`}>Inicia sesión para contactar</h3>
        <p className={`text-sm mb-4 leading-relaxed ${dark ? 'text-white/60' : 'text-gray-500'}`}>
          Así el propietario sabe que hablas en serio, y puedes darle seguimiento a tus mensajes desde tu panel.
        </p>
        <Link
          href={loginRedirectUrl(pathname)}
          className="flex items-center justify-center gap-2 w-full bg-brand hover:bg-brand-dark text-white font-semibold text-sm py-3 rounded-xl transition-colors"
        >
          Iniciar sesión <ArrowRight size={15} />
        </Link>
        <p className={`text-xs mt-3 ${dark ? 'text-white/50' : 'text-gray-400'}`}>
          ¿No tienes cuenta?{' '}
          <Link href={`/auth/registro?next=${encodeURIComponent(pathname)}`} className={dark ? 'text-white font-semibold hover:underline' : 'text-brand font-semibold hover:underline'}>
            Regístrate gratis
          </Link>
        </p>
      </div>
    );
  }

  if (checkingExisting) {
    return (
      <div
        role="status"
        aria-label="Cargando"
        className={`h-32 rounded-xl animate-pulse ${dark ? 'bg-white/10' : 'bg-gray-100'}`}
      >
        <span className="sr-only">Cargando…</span>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="text-center py-6">
        <CheckCircle className={`mx-auto mb-3 ${dark ? 'text-white' : 'text-success'}`} size={40} />
        <h3 className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-800'}`}>
          {yaExistia ? 'Ya iniciaste esta conversación' : '¡Mensaje enviado!'}
        </h3>
        <p className={`text-sm mb-4 ${dark ? 'text-white/70' : 'text-gray-500'}`}>
          {yaExistia
            ? `Ya le escribiste a ${ownerName} sobre esta propiedad — continúa desde tu panel.`
            : `${ownerName} puede responderte directo desde la plataforma.`}
        </p>
        {conversacionId && (
          <Link
            href={`/dashboard/mensajes/${conversacionId}`}
            className={`inline-flex items-center justify-center gap-2 font-semibold text-sm py-2.5 px-5 rounded-xl transition-colors ${
              dark ? 'bg-white text-brand-dark hover:bg-white/90' : 'bg-brand hover:bg-brand-dark text-white'
            }`}
          >
            <MessageCircle size={15} /> Ver conversación
          </Link>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <p className={`text-sm mb-4 ${dark ? 'text-white/70' : 'text-gray-500'}`}>
        Consultar sobre: <strong className={dark ? 'text-white' : 'text-gray-700'}>{propertyTitle}</strong>
      </p>

      <div>
        <label className={`block text-sm font-medium mb-1 ${labelCls}`}>Mensaje</label>
        <textarea
          {...register('mensaje')}
          placeholder="Hola, me interesa saber más sobre esta propiedad..."
          rows={4}
          defaultValue="Hola, vi esta propiedad en Vive Villahermosa y me gustaría recibir más información."
          className={`w-full rounded-xl border px-4 py-2.5 text-base sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 resize-none ${textareaCls}`}
        />
        {errors.mensaje && (
          <p className="mt-1 text-xs text-danger">{errors.mensaje.message}</p>
        )}
      </div>

      <p className={`flex items-start gap-1.5 text-[11px] leading-relaxed rounded-lg px-2.5 py-2 ${
        dark ? 'text-amber-200 bg-amber-500/10 border border-amber-500/20' : 'text-amber-700 bg-amber-50 border border-amber-200'
      }`}>
        <ShieldAlert size={12} className="flex-shrink-0 mt-0.5" />
        Nunca envíes anticipos, depósitos ni transferencias antes de conocer la propiedad en persona. Vive Villahermosa no participa en pagos entre usuarios.
      </p>

      {sendError && (
        <p className="text-xs text-danger text-center">{sendError}</p>
      )}

      <Button type="submit" variant={dark ? 'primary' : 'secondary'} size="lg" className="w-full" isLoading={isSubmitting}>
        Enviar mensaje
      </Button>
    </form>
  );
}
