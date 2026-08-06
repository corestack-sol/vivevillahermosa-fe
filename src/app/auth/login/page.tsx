'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Shield, MapPin, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { safeRedirectPath } from '@/lib/safeRedirect';

const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
type FormData = z.infer<typeof schema>;

const PERKS = [
  { icon: <Shield size={15} />, text: 'Guarda propiedades favoritas' },
  { icon: <Bell size={15} />,   text: 'Crea alertas por zona y precio' },
  { icon: <MapPin size={15} />, text: 'Contacta directo a propietarios' },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="white">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function LoginContent() {
  const router = useRouter();
  const { refresh } = useAuth();
  const searchParams  = useSearchParams();
  const oauthError    = searchParams.get('error');
  // Si llegaste redirigido desde una ruta protegida (ej. /publicar), el
  // proxy manda ?next=/publicar — de vuelta ahí después de iniciar sesión.
  const next = safeRedirectPath(searchParams.get('next'));

  const [showPass, setShowPass]       = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setServerError('');
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { setServerError(json.error); return; }
    await refresh();
    router.push(next);
  }

  const oauthErrorMsg: Record<string, string> = {
    config:   'OAuth no configurado. Usa el formulario.',
    state:    'Error de seguridad. Intenta de nuevo.',
    token:    'Error al conectar con el proveedor.',
    profile:  'No se pudo obtener tu perfil.',
    no_email: 'Tu cuenta no tiene email. Usa el formulario.',
    account_exists: 'Ya existe una cuenta con este correo. Inicia sesión con tu contraseña.',
    bloqueado: 'Esta cuenta fue bloqueada por uso indebido de la plataforma. Si crees que es un error, contáctanos.',
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm lg:max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden lg:flex">

        {/* ── Left: brand ── */}
        <div className="hidden lg:flex flex-col justify-between w-[460px] flex-shrink-0
                        bg-gradient-to-br from-brand-dark via-brand to-brand-light p-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </div>
            <span className="font-display font-black text-white text-xl">
              Vive<span style={{ color: '#F59E0B' }}>VH</span>
            </span>
          </Link>

          <div>
            <h2 className="text-2xl font-heading font-bold text-white mb-2 leading-snug">
              Tu próxima casa<br />en Tabasco, aquí.
            </h2>
            <p className="text-white/65 text-sm leading-relaxed mb-6">
              La plataforma inmobiliaria local con información real sobre riesgo de inundación.
            </p>
            <div className="space-y-3">
              {PERKS.map((p) => (
                <div key={p.text} className="flex items-center gap-3 text-white/80 text-sm">
                  <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                    {p.icon}
                  </div>
                  {p.text}
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/30 text-xs">© {new Date().getFullYear()} Vive Villahermosa · Tabasco, México</p>
        </div>

        {/* ── Right: form ── */}
        <div className="flex-1 flex flex-col justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-sm mx-auto">
            <div className="mb-7">
              <h1 className="text-2xl font-heading font-bold text-gray-900">Bienvenido de vuelta</h1>
              <p className="text-sm text-gray-500 mt-1">Inicia sesión en tu cuenta</p>
            </div>

            {oauthError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-5">
                {oauthErrorMsg[oauthError] ?? 'Error al autenticar. Intenta de nuevo.'}
              </div>
            )}

            {/* OAuth buttons */}
            <div className="space-y-2.5 mb-5">
              <a
                href={`/api/auth/google?next=${encodeURIComponent(next)}`}
                className="w-full flex items-center justify-center gap-3 border border-gray-200
                           hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold
                           text-sm py-3 rounded-xl transition-all"
              >
                <GoogleIcon />
                Continuar con Google
              </a>
              <a
                href={`/api/auth/facebook?next=${encodeURIComponent(next)}`}
                className="w-full flex items-center justify-center gap-3 font-semibold
                           text-sm py-3 rounded-xl transition-colors text-white"
                style={{ background: '#1877F2' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1565d8')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#1877F2')}
              >
                <FacebookIcon />
                Continuar con Facebook
              </a>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">o con correo</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 transition-shadow ${errors.email ? 'border-red-300' : 'border-gray-200 focus:border-brand'}`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    {...register('password')}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 pr-11 transition-shadow ${errors.password ? 'border-red-300' : 'border-gray-200 focus:border-brand'}`}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                  {serverError}
                </div>
              )}

              <button type="submit" disabled={isSubmitting}
                className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-60 text-sm shadow-sm shadow-brand/20">
                {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              ¿No tienes cuenta?{' '}
              <Link href={`/auth/registro?next=${encodeURIComponent(next)}`} className="text-brand font-bold hover:underline">Regístrate gratis</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
