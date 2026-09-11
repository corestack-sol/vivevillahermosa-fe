'use client';

import { useState } from 'react';
import { MapPin, CheckCircle, Mail } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { distanciaKm } from '@/lib/colonias';

interface Coords {
  lat: number;
  lng: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propiedadId: string;
  propiedadTitulo: string;
  original: Coords;
  solicitada: Coords;
}

const CORREO_SOPORTE = 'corestack.sol@gmail.com';

/**
 * Pedido explícito 2026-09-11: antes, mover el pin más de RADIO_MAXIMO_PIN_KM
 * (mapPin.ts) solo mostraba un toast diciendo "contáctanos" — texto plano,
 * sin link ni referencia a la propiedad, un callejón sin salida real (no
 * existía ningún canal estructurado, y tampoco una forma de que un admin
 * viera estos casos en un solo lugar). Este modal reemplaza ese toast:
 * intenta un endpoint real (POST /propiedades/:id/solicitud-pin, ver
 * docs/BACKEND-SOLICITUDES-CAMBIO-PIN-11092026.md — NO implementado del
 * lado del backend todavía) que alimentaría /admin/solicitudes-pin; si el
 * backend responde 404 (ruta inexistente), cae a un mailto: prellenado con
 * todo el contexto en vez de fallar en silencio — mismo criterio que el
 * resto de esta plataforma con endpoints pendientes (ver admin/fraude/page.tsx).
 */
export function SolicitarCambioPinModal({ isOpen, onClose, propiedadId, propiedadTitulo, original, solicitada }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar cambio de ubicación" maxWidth="sm">
      {isOpen && (
        <SolicitudBody
          propiedadId={propiedadId}
          propiedadTitulo={propiedadTitulo}
          original={original}
          solicitada={solicitada}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function SolicitudBody({ propiedadId, propiedadTitulo, original, solicitada, onClose }: Omit<Props, 'isOpen'>) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState('');

  const distancia = distanciaKm(original.lat, original.lng, solicitada.lat, solicitada.lng);

  // Un <a href="mailto:..."> real en vez de asignar window.location.href
  // imperativamente — la persona lo abre con su propio clic (más robusto
  // contra bloqueadores de popup/navegación, y el linter de este repo
  // rechaza mutar `window` fuera de un efecto).
  function construirMailtoHref(): string {
    const asunto = `Solicitud de cambio de ubicación — ${propiedadTitulo}`;
    const cuerpo = [
      `Propiedad: ${propiedadTitulo} (id: ${propiedadId})`,
      `Ubicación actual: ${original.lat.toFixed(5)}, ${original.lng.toFixed(5)}`,
      `Ubicación solicitada: ${solicitada.lat.toFixed(5)}, ${solicitada.lng.toFixed(5)}`,
      `Distancia: ${distancia.toFixed(1)} km`,
      motivo.trim() ? `Motivo: ${motivo.trim()}` : 'Motivo: (no especificado)',
    ].join('\n');
    return `mailto:${CORREO_SOPORTE}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  }

  async function enviar() {
    setEnviando(true);
    setError('');
    try {
      await backendFetch(`/propiedades/${propiedadId}/solicitud-pin`, {
        method: 'POST',
        body: JSON.stringify({ lat: solicitada.lat, lng: solicitada.lng, motivo: motivo.trim() || undefined }),
      });
      setEnviado(true);
    } catch (err) {
      if (err instanceof BackendApiError && err.status === 404) {
        setFallback(true);
        return;
      }
      setError(err instanceof BackendApiError ? err.message : 'No se pudo enviar la solicitud, intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="text-center py-4">
        <CheckCircle className="mx-auto mb-3 text-success" size={36} />
        <p className="font-semibold text-gray-800 mb-1">Solicitud enviada</p>
        <p className="text-sm text-gray-500">Un administrador va a revisar el cambio de ubicación y te avisamos en cuanto se resuelva.</p>
        <Button type="button" variant="ghost" onClick={onClose} className="mt-4 mx-auto">Cerrar</Button>
      </div>
    );
  }

  if (fallback) {
    return (
      <div className="text-center py-4">
        <Mail className="mx-auto mb-3 text-brand" size={36} />
        <p className="font-semibold text-gray-800 mb-1">Envíanoslo por correo</p>
        <p className="text-sm text-gray-500 mb-4">El sistema de solicitudes todavía no está activo — mándanos un correo directo con el contexto ya redactado, así llega igual.</p>
        <a
          href={construirMailtoHref()}
          className={buttonClasses('primary', 'md', 'mx-auto')}
        >
          <Mail size={15} /> Abrir correo a {CORREO_SOPORTE}
        </a>
        <Button type="button" variant="ghost" onClick={onClose} className="mt-3 mx-auto">Cerrar</Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-start gap-2.5 bg-brand-pale/50 border border-brand/20 rounded-xl px-4 py-3 mb-4">
        <MapPin size={16} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700 leading-relaxed">
          El punto que marcaste queda a <strong>{distancia.toFixed(1)} km</strong> de donde publicaste <strong>{propiedadTitulo}</strong> originalmente — más del límite que se puede mover directamente. Cuéntanos por qué (te mudaste, error al publicar, etc.) y lo revisamos.
        </p>
      </div>
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Explica brevemente por qué la ubicación cambió tanto (opcional, pero ayuda a resolverlo más rápido)"
        rows={3}
        maxLength={400}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand resize-none mb-3"
      />
      {error && <p className="text-xs text-danger text-center mb-3">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 justify-center">Cancelar</Button>
        <Button type="button" variant="primary" isLoading={enviando} onClick={enviar} className="flex-1 justify-center">Enviar solicitud</Button>
      </div>
    </>
  );
}
