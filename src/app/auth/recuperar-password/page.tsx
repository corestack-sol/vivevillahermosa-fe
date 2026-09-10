'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, MailCheck, ArrowLeft, Eye, EyeOff, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { backendFetch, BackendApiError } from '@/lib/backendApi';

const emailSchema = z.object({
  email: z.string().email('Correo inválido'),
});
type EmailForm = z.infer<typeof emailSchema>;

const confirmarSchema = z.object({
  codigo: z.string().regex(/^\d{6}$/, 'El código son 6 dígitos'),
  password: z.string().min(10, 'Mínimo 10 caracteres'),
  confirmarPassword: z.string(),
}).refine((d) => d.password === d.confirmarPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmarPassword'],
});
type ConfirmarForm = z.infer<typeof confirmarSchema>;

// Cooldown solo de cortesía en el cliente (evita que alguien machaque
// "reenviar" por accidente) — el límite real de reenvíos/intentos es
// responsabilidad del backend, ver docs/BACKEND-RECUPERACION-PASSWORD-*.md.
const REENVIO_COOLDOWN_S = 30;

type Paso = 'email' | 'codigo' | 'listo';

function RecuperarPasswordContent() {
  const searchParams = useSearchParams();
  const [paso, setPaso] = useState<Paso>('email');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: searchParams.get('email') ?? '' },
  });

  const confirmarForm = useForm<ConfirmarForm>({
    resolver: zodResolver(confirmarSchema),
  });

  // Bug real reportado 2026-09-09, y de nuevo DOS veces más el 2026-09-10
  // pese a dos intentos previos (autoComplete="one-time-code" solo, y
  // luego separar el código de los inputs de contraseña + readOnly hasta
  // montarse) — Chrome seguía autorellenando el correo del perfil en el
  // campo. No es el autofill de contraseñas: es el autofill general de
  // Chrome ("Direcciones y más"), que ofrece el correo guardado en
  // cualquier input de texto de longitud "normal" en una página que
  // reconoce como de login/auth, sin importar autoComplete/readOnly. El
  // único patrón que de verdad lo esquiva (usado por Stripe, bancos,
  // etc.): partir el código en 6 casillas de UN dígito cada una — un
  // input maxLength={1} nunca coincide con el patrón que ese autofill
  // busca. Ver `digitos`/`inputsRef` más abajo.
  const [digitos, setDigitos] = useState<string[]>(['', '', '', '', '', '']);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [codigoBloqueadoParaAutofill, setCodigoBloqueadoParaAutofill] = useState(true);
  useEffect(() => {
    function reiniciarCasillasDeCodigo() {
      if (paso !== 'codigo') return;
      setDigitos(['', '', '', '', '', '']);
      setCodigoBloqueadoParaAutofill(true);
    }
    reiniciarCasillasDeCodigo();
    if (paso !== 'codigo') return;
    const t = setTimeout(() => setCodigoBloqueadoParaAutofill(false), 50);
    return () => clearTimeout(t);
  }, [paso]);

  useEffect(() => {
    function sincronizarCodigoConForm() {
      const valor = digitos.join('');
      confirmarForm.setValue('codigo', valor, { shouldValidate: valor.length === 6 });
    }
    sincronizarCodigoConForm();
  }, [digitos]); // eslint-disable-line react-hooks/exhaustive-deps

  function cambiarDigito(idx: number, valorCrudo: string) {
    const limpio = valorCrudo.replace(/\D/g, '');
    if (!limpio) {
      setDigitos((prev) => { const next = [...prev]; next[idx] = ''; return next; });
      return;
    }
    setDigitos((prev) => {
      const next = [...prev];
      let i = idx;
      for (const c of limpio) {
        if (i > 5) break;
        next[i] = c;
        i++;
      }
      return next;
    });
    inputsRef.current[Math.min(idx + limpio.length, 5)]?.focus();
  }

  function teclaDigito(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digitos[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  }

  function pegarCodigo(e: React.ClipboardEvent<HTMLInputElement>) {
    const limpio = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!limpio) return;
    e.preventDefault();
    const next = limpio.split('');
    while (next.length < 6) next.push('');
    setDigitos(next);
    inputsRef.current[Math.min(limpio.length, 5)]?.focus();
  }

  async function pedirCodigo(data: EmailForm) {
    setError('');
    try {
      await backendFetch('/auth/recuperar-password', {
        method: 'POST',
        body: JSON.stringify({ email: data.email }),
      });
    } catch (err) {
      // Solo se detiene aquí por un fallo real de red/servidor — nunca
      // porque el correo no exista. El backend responde el mismo éxito
      // exista o no la cuenta (mismo criterio que
      // cuenta/solicitar-revision), así que este catch es exclusivamente
      // para errores de transporte, no de "cuenta no encontrada".
      setError(err instanceof BackendApiError ? err.message : 'No se pudo enviar el código. Revisa tu conexión e intenta de nuevo.');
      return;
    }
    setEmail(data.email);
    setPaso('codigo');
    iniciarCooldown();
  }

  function iniciarCooldown() {
    setCooldown(REENVIO_COOLDOWN_S);
    const interval = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function reenviarCodigo() {
    if (cooldown > 0) return;
    setError('');
    try {
      await backendFetch('/auth/recuperar-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      iniciarCooldown();
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'No se pudo reenviar el código.');
    }
  }

  async function confirmarNuevaPassword(data: ConfirmarForm) {
    setError('');
    try {
      await backendFetch('/auth/recuperar-password/confirmar', {
        method: 'POST',
        body: JSON.stringify({ email, codigo: data.codigo, password: data.password }),
      });
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'No se pudo actualizar tu contraseña. Intenta de nuevo.');
      return;
    }
    setPaso('listo');
  }

  if (paso === 'listo') {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-brand-pale rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={26} className="text-brand" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900 mb-2">Contraseña actualizada</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <Link href="/auth/login" className={buttonLinkClass}>Iniciar sesión</Link>
      </div>
    );
  }

  if (paso === 'codigo') {
    return (
      <>
        <div className="mb-6">
          <div className="w-11 h-11 bg-brand-pale rounded-xl flex items-center justify-center mb-3">
            <MailCheck size={20} className="text-brand" />
          </div>
          <h1 className="text-xl font-heading font-bold text-gray-900">Revisa tu correo</h1>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            Si <strong className="text-gray-700">{email}</strong> tiene una cuenta con nosotros, le mandamos un código de 6 dígitos. Escríbelo abajo para continuar.
          </p>
        </div>

        <form onSubmit={confirmarForm.handleSubmit(confirmarNuevaPassword)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Código de 6 dígitos</label>
            <div className="flex gap-2">
              {digitos.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  readOnly={codigoBloqueadoParaAutofill}
                  value={d}
                  onChange={(e) => cambiarDigito(i, e.target.value)}
                  onKeyDown={(e) => teclaDigito(i, e)}
                  onPaste={i === 0 ? pegarCodigo : undefined}
                  className={`w-11 h-12 text-center text-lg font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand/40 transition-shadow ${confirmarForm.formState.errors.codigo ? 'border-danger' : 'border-gray-200 focus:border-brand'}`}
                />
              ))}
            </div>
            {confirmarForm.formState.errors.codigo && <p className="mt-1 text-xs text-danger">{confirmarForm.formState.errors.codigo.message}</p>}
          </div>

          {digitos.join('').length === 6 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    {...confirmarForm.register('password')}
                    placeholder="Mínimo 10 caracteres"
                    autoComplete="new-password"
                    className={`w-full rounded-xl border px-4 py-2.5 pr-11 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 transition-shadow ${confirmarForm.formState.errors.password ? 'border-danger' : 'border-gray-200 focus:border-brand'}`}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmarForm.formState.errors.password && <p className="mt-1 text-xs text-danger">{confirmarForm.formState.errors.password.message}</p>}
              </div>

              <Input
                label="Confirma tu nueva contraseña"
                type={showPass ? 'text' : 'password'}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                error={confirmarForm.formState.errors.confirmarPassword?.message}
                {...confirmarForm.register('confirmarPassword')}
              />

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              <Button type="submit" isLoading={confirmarForm.formState.isSubmitting} className="w-full justify-center">
                Cambiar contraseña
              </Button>
            </>
          )}
        </form>

        <button
          type="button"
          onClick={reenviarCodigo}
          disabled={cooldown > 0}
          className="w-full text-center text-sm text-gray-500 hover:text-brand disabled:text-gray-300 disabled:cursor-not-allowed transition-colors mt-4"
        >
          {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
        </button>

        <Link href="/auth/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-brand mt-4">
          <ArrowLeft size={14} /> Volver a iniciar sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="w-11 h-11 bg-brand-pale rounded-xl flex items-center justify-center mb-3">
          <KeyRound size={20} className="text-brand" />
        </div>
        <h1 className="text-xl font-heading font-bold text-gray-900">Recuperar contraseña</h1>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          Escribe el correo de tu cuenta — te mandamos un código para crear una contraseña nueva.
        </p>
        {/* Aclaración pedida explícita 2026-09-10, confirmada con backend
            (docs/BACKEND-RECUPERAR-PASSWORD-CUENTAS-OAUTH-10092026.md): si
            te registraste con correo, esto SÍ recupera esa contraseña. Si
            te registraste con Google, nunca podemos tocar la contraseña de
            esa cuenta (es de Google, no nuestra) — pero este mismo
            formulario te sirve para crear una contraseña propia y poder
            entrar también con tu correo, sin depender de Google. Solo
            Google — Facebook login sigue sin implementarse
            (FACEBOOK_LOGIN_ENABLED en auth/login/page.tsx), no mencionarlo
            aquí. */}
        <p className="flex items-start gap-1.5 text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2.5 mt-3 leading-relaxed">
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            ¿Te registraste con Google? No podemos cambiar esa contraseña — pero puedes usar este formulario para crear una contraseña propia y entrar también con tu correo.
          </span>
        </p>
      </div>

      <form onSubmit={emailForm.handleSubmit(pedirCodigo)} className="space-y-4">
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
          error={emailForm.formState.errors.email?.message}
          {...emailForm.register('email')}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <Button type="submit" isLoading={emailForm.formState.isSubmitting} className="w-full justify-center">
          Enviar código
        </Button>
      </form>

      <Link href="/auth/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-brand mt-6">
        <ArrowLeft size={14} /> Volver a iniciar sesión
      </Link>
    </>
  );
}

const buttonLinkClass = 'inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm';

export default function RecuperarPasswordPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <Suspense fallback={null}>
          <RecuperarPasswordContent />
        </Suspense>
      </div>
    </div>
  );
}
