'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LifeBuoy, MailCheck, ArrowLeft, Info, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { backendFetch, BackendApiError } from '@/lib/backendApi';

const CORREO_SOPORTE = 'corestack.sol@gmail.com';

const schema = z.object({
  email: z.string().email('Correo inválido'),
  emailNuevo: z.string().email('Correo inválido'),
  nombre: z.string().min(3, 'Escribe tu nombre completo').max(120),
  pruebas: z.string().min(20, 'Cuéntanos con un poco más de detalle cómo comprobar que la cuenta es tuya').max(1000),
}).refine((d) => d.email.trim().toLowerCase() !== d.emailNuevo.trim().toLowerCase(), {
  message: 'Debe ser un correo distinto al de tu cuenta actual',
  path: ['emailNuevo'],
});
type FormData = z.infer<typeof schema>;

// Solicitud de ayuda para quien perdió acceso al correo de su cuenta — el
// correo confirmado no se puede cambiar desde "Mis datos" por seguridad (ver
// dashboard/cuenta/page.tsx), y antes el mensaje solo decía "contáctanos"
// sin ningún enlace. Contrato en docs/BACKEND-RECUPERACION-CUENTA-18092026.md.
// Mismo criterio que /cuenta/solicitar-revision: el backend responde el
// mismo éxito exista o no la cuenta, esta pantalla nunca confirma ni
// desmiente nada sobre ella.
function RecuperarAccesoContent() {
  const searchParams = useSearchParams();
  const [enviado, setEnviado] = useState(false);
  // Mientras el endpoint del backend no esté desplegado (404/405/501) se
  // ofrece el mismo contenido por correo, para que nadie se quede sin salida.
  // Se puede borrar cuando el backend confirme el endpoint.
  const [respaldoCorreo, setRespaldoCorreo] = useState<FormData | null>(null);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: searchParams.get('email') ?? '' },
  });

  async function onSubmit(data: FormData) {
    setError('');
    try {
      await backendFetch('/cuenta/solicitar-cambio-correo', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setEnviado(true);
    } catch (err) {
      if (err instanceof BackendApiError && [404, 405, 501].includes(err.status)) {
        setRespaldoCorreo(data);
        return;
      }
      setError(
        err instanceof BackendApiError
          ? err.message
          : 'No se pudo enviar la solicitud. Revisa tu conexión e intenta de nuevo.',
      );
    }
  }

  if (enviado) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-brand-pale rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MailCheck size={26} className="text-brand" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900 mb-2">Recibimos tu solicitud</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Un administrador la revisará y te escribiremos al correo nuevo que nos diste, apruebe o no la solicitud. No compartas tu contraseña con nadie.
        </p>
        <Link href="/" className="text-brand font-bold text-sm hover:underline">Volver al inicio</Link>
      </div>
    );
  }

  if (respaldoCorreo) {
    const cuerpo = [
      'Solicito recuperar el acceso a mi cuenta de Vive Villahermosa.',
      '',
      `Nombre: ${respaldoCorreo.nombre}`,
      `Correo de mi cuenta (ya no tengo acceso): ${respaldoCorreo.email}`,
      `Correo nuevo al que sí tengo acceso: ${respaldoCorreo.emailNuevo}`,
      '',
      'Cómo comprobar que la cuenta es mía:',
      respaldoCorreo.pruebas,
    ].join('\n');
    const mailto = `mailto:${CORREO_SOPORTE}?subject=${encodeURIComponent('Recuperar acceso a mi cuenta')}&body=${encodeURIComponent(cuerpo)}`;
    return (
      <div className="text-center py-2">
        <div className="w-14 h-14 bg-brand-pale rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Mail size={26} className="text-brand" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900 mb-2">Envíanos tu solicitud por correo</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-5">
          Este formulario todavía no está disponible. Ya preparamos tu mensaje con los datos que escribiste — solo tienes que enviarlo desde tu correo.
        </p>
        <a
          href={mailto}
          className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm"
        >
          <Mail size={16} /> Abrir mi correo
        </a>
        <p className="text-xs text-gray-400 mt-3">
          Si no se abre, escríbenos a <span className="font-semibold text-gray-600">{CORREO_SOPORTE}</span>.
        </p>
        <button
          type="button"
          onClick={() => setRespaldoCorreo(null)}
          className="block mx-auto text-sm text-gray-500 hover:text-brand mt-5"
        >
          Volver al formulario
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="w-11 h-11 bg-brand-pale rounded-xl flex items-center justify-center mb-3">
          <LifeBuoy size={20} className="text-brand" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900">Recuperar acceso a mi cuenta</h1>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          ¿Ya no puedes entrar al correo de tu cuenta? Cuéntanos cómo comprobar que es tuya y a qué correo nuevo podemos escribirte — un administrador revisará el caso.
        </p>
        <p className="flex items-start gap-1.5 text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2.5 mt-3 leading-relaxed">
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            Si solo olvidaste tu contraseña y sí tienes acceso a tu correo, usa <Link href="/auth/recuperar-password" className="font-semibold underline">Recuperar contraseña</Link>, es más rápido.
          </span>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Correo de tu cuenta (al que ya no tienes acceso)"
          type="email"
          placeholder="tucorreo@ejemplo.com"
          autoComplete="off"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Correo nuevo (al que sí tienes acceso)"
          type="email"
          placeholder="nuevo@ejemplo.com"
          autoComplete="off"
          error={errors.emailNuevo?.message}
          {...register('emailNuevo')}
        />
        <Input
          label="Nombre completo"
          placeholder="Como aparece en tu cuenta"
          autoComplete="name"
          error={errors.nombre?.message}
          {...register('nombre')}
        />
        <div className="w-full">
          <label htmlFor="pruebas" className="block text-sm font-medium text-gray-700 mb-1">¿Cómo comprobamos que la cuenta es tuya?</label>
          <textarea
            id="pruebas"
            rows={4}
            placeholder="Ejemplo (escribe tus propios datos): Publiqué una casa en la colonia [tu colonia] en [mes], con el teléfono [tu teléfono]. Creé la cuenta con mi nombre completo."
            className={`w-full rounded-xl border text-base sm:text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 transition-shadow ${errors.pruebas ? 'border-danger' : 'border-gray-200 focus:border-brand'}`}
            {...register('pruebas')}
          />
          {errors.pruebas && <p className="mt-1 text-xs text-danger">{errors.pruebas.message}</p>}
          <p className="mt-1 text-xs text-gray-400">
            Menciona propiedades que publicaste, colonias, teléfonos o fechas. Nunca escribas tu contraseña ni subas identificaciones aquí.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <Button type="submit" isLoading={isSubmitting} className="w-full justify-center">
          Enviar solicitud
        </Button>
      </form>

      <Link href="/auth/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-brand mt-6">
        <ArrowLeft size={14} /> Volver a iniciar sesión
      </Link>
    </>
  );
}

export default function RecuperarAccesoPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <Suspense fallback={null}>
          <RecuperarAccesoContent />
        </Suspense>
      </div>
    </div>
  );
}
