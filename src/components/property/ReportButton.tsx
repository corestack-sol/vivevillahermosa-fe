'use client';

import { useState } from 'react';
import { Flag, CheckCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { backendFetch, BackendApiError } from '@/lib/backendApi';

interface ReportButtonProps {
  propiedadId: string;
}

const MOTIVOS = [
  { value: 'info_falsa', label: 'La información parece falsa' },
  { value: 'precio_sospechoso', label: 'El precio parece una trampa' },
  { value: 'contenido_inapropiado', label: 'Contenido inapropiado' },
  { value: 'posible_fraude', label: 'Posible fraude o estafa' },
  { value: 'otro', label: 'Otro motivo' },
] as const;

export function ReportButton({ propiedadId }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState<string>('');
  const [comentario, setComentario] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    // Reset tras la animación de cierre
    setTimeout(() => { setMotivo(''); setComentario(''); setSent(false); setError(null); }, 200);
  }

  async function submit() {
    if (!motivo) return;
    setSending(true);
    setError(null);
    try {
      await backendFetch('/propiedades/reportar', {
        method: 'POST',
        body: JSON.stringify({ propiedadId, motivo, comentario: comentario || undefined }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'No se pudo enviar el reporte, intenta de nuevo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        <Flag size={12} /> Reportar este anuncio
      </button>

      <Modal isOpen={open} onClose={close} title="Reportar anuncio" maxWidth="sm">
        {sent ? (
          <div className="text-center py-4">
            <CheckCircle className="mx-auto mb-3 text-success" size={36} />
            <p className="font-semibold text-gray-800 mb-1">Gracias por avisarnos</p>
            {/* POST /propiedades/reportar (backend real, BACKEND.md §10) ya
                persiste el reporte y, si se acumulan 3+ de fraude/info falsa,
                marca la propiedad requiereModeracion=true automáticamente. */}
            <p className="text-sm text-gray-500">Recibimos tu reporte y quedó registrado. Si varias personas reportan lo mismo, la publicación se marca para revisión automáticamente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">¿Qué te parece incorrecto de este anuncio?</p>
            <div className="space-y-1.5">
              {MOTIVOS.map((m) => (
                <label key={m.value} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="motivo-reporte"
                    value={m.value}
                    checked={motivo === m.value}
                    onChange={() => setMotivo(m.value)}
                    className="text-brand focus:ring-brand/40"
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Detalles adicionales (opcional)"
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand resize-none"
            />
            {error && (
              <p className="text-xs text-danger text-center">{error}</p>
            )}
            <Button
              type="button"
              variant="danger"
              className="w-full"
              disabled={!motivo}
              isLoading={sending}
              onClick={submit}
            >
              Enviar reporte
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
