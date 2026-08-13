'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, MailCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { backendFetch, BackendApiError } from '@/lib/backendApi';

const schema = z.object({
  email: z.string().email('Correo inválido'),
  motivo: z.string().min(10, 'Cuéntanos con un poco más de detalle qué pasó').max(1000),
});
type FormData = z.infer<typeof schema>;

// Única puerta de entrada real a POST /cuenta/solicitar-revision (backend) —
// antes ese endpoint existía sin ninguna página que lo llamara, así que una
// cuenta bloqueada por error no tenía ninguna forma real de reclamar
// (el mensaje de login solo decía "contáctanos", sin link a ningún lado).
function SolicitarRevisionContent() {
  const searchParams = useSearchParams();
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: searchParams.get('email') ?? '' },
  });

  async function onSubmit(data: FormData) {
    setError('');
    try {
      await backendFetch('/cuenta/solicitar-revision', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      // El backend responde el mismo mensaje de éxito exista o no la cuenta,
      // y esté o no bloqueada — esta pantalla lo respeta tal cual, nunca
      // confirma ni desmiente nada sobre la cuenta.
      setEnviado(true);
    } catch (err) {
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
          La revisaremos y te avisaremos por correo con el resultado — sea cual sea.
        </p>
        <Link href="/" className="text-brand font-bold text-sm hover:underline">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="w-11 h-11 bg-brand-pale rounded-xl flex items-center justify-center mb-3">
          <ShieldCheck size={20} className="text-brand" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900">Solicitar revisión de cuenta</h1>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          Si tu cuenta fue bloqueada y crees que fue un error, cuéntanos qué pasó — un administrador
          revisará el caso y te avisaremos por correo, apruebe o no la solicitud.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Correo de tu cuenta"
          type="email"
          placeholder="tucorreo@ejemplo.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="w-full">
          <label htmlFor="motivo" className="block text-sm font-medium text-gray-700 mb-1">Cuéntanos qué pasó</label>
          <textarea
            id="motivo"
            rows={4}
            placeholder="Ej. Estaba probando cómo funciona el buscador y no quise manipular nada..."
            className={`w-full rounded-xl border text-base sm:text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 transition-shadow ${errors.motivo ? 'border-danger' : 'border-gray-200 focus:border-brand'}`}
            {...register('motivo')}
          />
          {errors.motivo && <p className="mt-1 text-xs text-danger">{errors.motivo.message}</p>}
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

export default function SolicitarRevisionPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <Suspense fallback={null}>
          <SolicitarRevisionContent />
        </Suspense>
      </div>
    </div>
  );
}
