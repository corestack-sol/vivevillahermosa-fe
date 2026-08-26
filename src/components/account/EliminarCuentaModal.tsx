'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { backendFetch } from '@/lib/backendApi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface EliminarCuentaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Confirmación + borrado real, extraído de EliminarCuentaSection.tsx
 * (/privacidad) para que el menú de usuario (Navbar.tsx) pueda ofrecer el
 * mismo camino sin duplicar la llamada al backend — un solo lugar que de
 * verdad borra la cuenta, dos puntos de entrada a la misma confirmación.
 *
 * Pide escribir el correo de la cuenta antes de habilitar el botón (mismo
 * patrón que GitHub para borrar un repositorio) — pedido explícito
 * 2026-08-22: un solo clic era muy fácil de disparar por accidente para
 * algo irreversible.
 */
export function EliminarCuentaModal({ isOpen, onClose }: EliminarCuentaModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Eliminar tu cuenta" maxWidth="sm">
      {/* El cuerpo solo se monta mientras el modal está abierto — así el
          texto escrito se olvida solo en cada apertura (via el propio
          onClose de la barra de navegación/Escape/clic afuera, que <Modal>
          maneja aparte), sin necesitar un efecto para "resetear" el campo. */}
      {isOpen && <EliminarCuentaConfirmBody onClose={onClose} />}
    </Modal>
  );
}

function EliminarCuentaConfirmBody({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const palabraConfirmacion = user?.email ?? '';
  const confirmado = confirmText.trim() === palabraConfirmacion && palabraConfirmacion !== '';

  async function handleConfirmar() {
    if (!confirmado) return;
    setDeleting(true);
    try {
      await backendFetch('/auth/cuenta', { method: 'DELETE' });
      await logout();
      // logout() solo limpia el estado de React y la sesión del servidor —
      // nunca tocaba localStorage. Pregunta real 2026-08-23: búsquedas/
      // vistas recientes, comparador, y datos de funciones demo (equipo,
      // leads, verificación) se quedaban en el navegador después de
      // eliminar la cuenta. `equipoDemo.ts` es el caso más serio: guarda
      // nombres/correos reales bajo una llave GLOBAL, no ligada al userId
      // — en un equipo compartido, la siguiente cuenta que inicia sesión
      // en ese mismo navegador los vería. Limpieza completa, no solo las
      // llaves conocidas hoy — más simple y a prueba de lo que se agregue
      // después.
      localStorage.clear();
      onClose();
      toast.success('Tu cuenta fue eliminada. Lamentamos verte ir.');
      router.push('/');
    } catch {
      toast.error('No se pudo eliminar tu cuenta. Intenta de nuevo.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* "tus propiedades publicadas" agregado 2026-08-30 (pedido explícito
          — el texto no las mencionaba). Verificado en vivo antes de
          agregarlo, no es un supuesto: se publicó una propiedad de
          prueba real, se borró SOLO la cuenta (no la propiedad), y
          GET /propiedades/:id sobre esa misma propiedad, sin sesión,
          devolvió 404 — el backend sí las quita junto con la cuenta. */}
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-relaxed">
          Esta acción es <strong>inmediata y no se puede deshacer</strong>. Se eliminan tu cuenta, tus propiedades publicadas, tus favoritos, tus alertas y tus notificaciones.
        </p>
      </div>
      <label htmlFor="confirmar-eliminar-correo" className="block text-sm text-gray-600 mb-2">
        Para confirmar, escribe tu correo <strong className="text-gray-800">{palabraConfirmacion}</strong>:
      </label>
      <Input
        id="confirmar-eliminar-correo"
        type="email"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={palabraConfirmacion}
        autoComplete="off"
        className="mb-5"
      />
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">
          Cancelar
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleConfirmar}
          isLoading={deleting}
          disabled={!confirmado}
          className="flex-1 justify-center"
        >
          Sí, eliminar mi cuenta
        </Button>
      </div>
    </>
  );
}
