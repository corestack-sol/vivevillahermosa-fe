import Link from 'next/link';
import { Lock } from 'lucide-react';

/**
 * Dato que viene FIJO de la cuenta (nombre, correo) en el formulario de
 * publicar/editar. Decisión de producto 2026-09-23: la plataforma es para
 * quien está registrado (no para terceros) y cada agente de una inmobiliaria
 * tiene su propia cuenta — así reportes y auditorías siempre ligan la
 * publicación a los mismos datos verificados. Para cambiarlos se pasa por
 * "Mi cuenta", donde el correo se re-verifica.
 */
export function CampoDeCuenta({ label, value, hint = 'Viene de tu cuenta.', error }: { label: string; value: string; hint?: string; error?: string }) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          readOnly
          value={value}
          aria-readonly="true"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 text-gray-600 text-base sm:text-sm pl-4 pr-11 py-2.5 focus:outline-none cursor-default"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" title="No editable aquí" aria-hidden="true">
          <Lock size={15} />
        </span>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error} Corrígelo en Mi cuenta.</p>}
      <p className="mt-1 text-xs text-gray-500">
        {hint}{' '}
        <Link href="/dashboard/cuenta" target="_blank" rel="noopener" className="font-medium text-brand hover:text-brand-dark underline underline-offset-2">
          Cambiar en Mi cuenta
        </Link>
      </p>
    </div>
  );
}
