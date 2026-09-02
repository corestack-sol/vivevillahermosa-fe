'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CheckCircle, ShieldAlert, LogIn, ArrowRight, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { loginRedirectUrl } from '@/lib/authRedirect';
import { usePropiedadEstado } from '@/hooks/usePropiedadEstado';
import { useEsMiPropiedad } from '@/hooks/useEsMiPropiedad';
import { estadoNoDisponibleInfo } from '@/lib/misPropiedades';
import { backendFetch, BackendApiError } from '@/lib/backendApi';

const schema = z.object({
  nombre: z.string().min(2, 'Ingresa tu nombre completo'),
  telefono: z.string().min(10, 'Ingresa un teléfono válido'),
  email: z.string().email('Correo electrónico inválido'),
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
  const esMiPropiedad = useEsMiPropiedad(propertyId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Ya sabemos quién es — no tiene sentido volver a pedirle nombre/correo.
  // `reset()` en un efecto (en vez de `values` en useForm) para que solo se
  // aplique cuando `user` realmente cambia, no en cada tecleo del mensaje.
  useEffect(() => {
    if (!user) return;
    reset({
      nombre: user.nombre,
      email: user.email,
      telefono: '',
      mensaje: 'Hola, vi esta propiedad en Vive Villahermosa y me gustaría recibir más información.',
    });
  }, [user, reset]);

  const onSubmit = async (data: FormData) => {
    setSendError(null);
    try {
      await backendFetch(`/propiedades/${propertyId}/contactar`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
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

  // El dueño no debe poder enviarse un mensaje a sí mismo — bug real
  // reportado 2026-09-01: el formulario seguía visible al ver la propia
  // ficha, como si fuera cualquier otro visitante interesado.
  if (esMiPropiedad) {
    return (
      <div className="text-center py-6">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 ${dark ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-400'}`}>
          <Building2 size={20} strokeWidth={1.75} />
        </div>
        <h3 className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-800'}`}>Esta es tu propiedad</h3>
        <p className={`text-sm leading-relaxed ${dark ? 'text-white/60' : 'text-gray-500'}`}>
          Gestiónala desde tu panel — no puedes enviarte un mensaje a ti mismo.
        </p>
      </div>
    );
  }

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

  if (sent) {
    return (
      <div className="text-center py-6">
        <CheckCircle className={`mx-auto mb-3 ${dark ? 'text-white' : 'text-success'}`} size={40} />
        <h3 className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-800'}`}>¡Mensaje enviado!</h3>
        <p className={`text-sm ${dark ? 'text-white/70' : 'text-gray-500'}`}>
          {ownerName} se comunicará contigo en las próximas horas.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <p className={`text-sm mb-4 ${dark ? 'text-white/70' : 'text-gray-500'}`}>
        Consultar sobre: <strong className={dark ? 'text-white' : 'text-gray-700'}>{propertyTitle}</strong>
      </p>

      <Input
        label="Nombre completo"
        placeholder="Tu nombre"
        labelClassName={labelCls}
        error={errors.nombre?.message}
        {...register('nombre')}
      />

      <Input
        label="Teléfono"
        type="tel"
        placeholder="+52 993 000 0000"
        labelClassName={labelCls}
        error={errors.telefono?.message}
        {...register('telefono')}
      />

      <Input
        label="Correo electrónico"
        type="email"
        placeholder="tu@correo.com"
        labelClassName={labelCls}
        error={errors.email?.message}
        {...register('email')}
      />

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
