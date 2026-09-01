'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { ArrowLeft, Upload, Download, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { publishSchema, MUNICIPIO_CENTERS, construirAgenteContacto } from '@/lib/publishSchema';
import { SERVICIOS_MAP } from '@/lib/servicios';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { LIMITE_PROPIEDADES } from '@/hooks/useLimitePropiedades';

// Mismos nombres que los campos del schema compartido con Publicar/Editar —
// así el mapeo de cada columna a cada regla de validación es directo, sin
// tener que mantener una tabla de equivalencias por separado.
//
// 'servicios'/'requiereMensajePrimero' agregadas en la auditoría 2026-08-30
// — antes ni siquiera existían como columnas, así que una propiedad
// importada por CSV nunca podía traer servicios incluidos ni pedir
// "mensaje primero" (quedaba fija en el default de siempre: revelado
// instantáneo, sin servicios). Ambas opcionales, igual que metodoContacto.
const COLUMNAS = [
  'tipo', 'operacion', 'precio', 'm2Construidos', 'm2Terreno', 'recamaras', 'banos',
  'municipio', 'colonia', 'titulo', 'descripcion', 'riesgoInundacion',
  'nombreContacto', 'metodoContacto', 'telefonoContacto', 'emailContacto',
  'servicios', 'requiereMensajePrimero',
] as const;

/** Forma que espera POST /propiedades (CreatePropertyDto) — id/slug/latPublico/lngPublico los genera el servidor. */
interface PropiedadPayload {
  titulo: string;
  descripcion: string;
  tipo: string;
  operacion: string;
  precio: number;
  m2Construidos?: number;
  m2Terreno?: number;
  recamaras?: number;
  banos?: number;
  amenidades: string[];
  fotos: string[];
  municipio: string;
  colonia: string;
  direccion: string;
  lat: number;
  lng: number;
  riesgoInundacion: string;
  cercaDosoBocas: boolean;
  agenteNombre: string;
  agenteTel?: string;
  agenteEmail?: string;
  agenteWhatsapp?: string;
  servicios?: string[];
  requiereMensajePrimero?: boolean;
}

interface FilaParseada {
  fila: number;
  datos: Record<string, string>;
  resultado:
    | { ok: true; payload: PropiedadPayload; titulo: string }
    | { ok: false; errores: string[] };
}

const NUMERICOS = new Set(['precio', 'm2Construidos', 'm2Terreno', 'recamaras', 'banos']);

function construirPayload(datos: Record<string, string>): FilaParseada['resultado'] {
  const candidato: Record<string, unknown> = { aceptaTerminos: true };
  for (const col of COLUMNAS) {
    const valor = (datos[col] ?? '').trim();
    if (NUMERICOS.has(col)) {
      candidato[col] = valor === '' ? undefined : Number(valor);
    } else if (col === 'riesgoInundacion') {
      candidato[col] = valor.toLowerCase();
    } else if (col === 'metodoContacto') {
      // Columna opcional en el CSV — si no la llenan, se asume "ambos" (mismo comportamiento que antes de que existiera esta opción).
      candidato[col] = valor === '' ? 'ambos' : valor.toLowerCase();
    } else if (col === 'requiereMensajePrimero') {
      // z.boolean() no convierte texto solo — sin esto, cualquier valor
      // (incluido "no") pasaba como error de tipo en vez de interpretarse.
      candidato[col] = ['si', 'sí', 'true', '1', 'yes'].includes(valor.toLowerCase());
    } else if (col === 'servicios') {
      // No vive en publishSchema (igual que amenidades) — se lee aparte
      // más abajo, esta columna no participa del safeParse.
    } else {
      candidato[col] = valor;
    }
  }
  // Lista separada por "|" (una coma ya delimita columnas del CSV) — solo
  // se aceptan keys reales de SERVICIOS_RENTA, cualquier otra palabra se
  // descarta en silencio en vez de rechazar la fila entera por un typo en
  // un campo opcional.
  const servicios = (datos.servicios ?? '')
    .split('|')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => SERVICIOS_MAP.has(s));

  const parsed = publishSchema.safeParse(candidato);
  if (!parsed.success) {
    return { ok: false, errores: parsed.error.issues.map((i) => i.message) };
  }

  const data = parsed.data;
  const centro = MUNICIPIO_CENTERS[data.municipio] ?? MUNICIPIO_CENTERS['Centro'];
  const agente = construirAgenteContacto(data.nombreContacto, data.metodoContacto, data.telefonoContacto, data.emailContacto);
  return {
    ok: true,
    titulo: data.titulo,
    payload: {
      titulo: data.titulo,
      descripcion: data.descripcion,
      tipo: data.tipo,
      operacion: data.operacion,
      precio: data.precio,
      m2Construidos: data.m2Construidos || undefined,
      m2Terreno: data.m2Terreno || undefined,
      recamaras: data.recamaras || undefined,
      banos: data.banos || undefined,
      amenidades: [],
      fotos: [],
      municipio: data.municipio,
      colonia: data.colonia,
      // Dirección exacta no se recolecta en el CSV — mismo criterio que
      // PublishForm.tsx, nunca se muestra públicamente de todos modos.
      direccion: `${data.colonia}, ${data.municipio}`,
      lat: centro[0],
      lng: centro[1],
      riesgoInundacion: data.riesgoInundacion,
      cercaDosoBocas: data.municipio === 'Paraíso',
      agenteNombre: agente.nombre,
      agenteTel: agente.tel,
      agenteEmail: agente.email,
      agenteWhatsapp: agente.whatsapp,
      servicios: servicios.length > 0 ? servicios : undefined,
      requiereMensajePrimero: data.requiereMensajePrimero || undefined,
    },
  };
}

function descargarPlantilla() {
  const encabezado = COLUMNAS.join(',');
  const ejemplo = [
    'casa', 'venta', '2500000', '180', '250', '3', '2',
    'Centro', 'Tabasco 2000', 'Casa con jardín en Tabasco 2000', 'Casa de dos pisos con jardín, cochera para 2 autos y cuarto de servicio.', 'bajo',
    'Ana Pérez', 'ambos', '9931234567', 'ana@ejemplo.com',
    'wifi|gas', 'no',
  ].map((v) => (v.includes(',') ? `"${v}"` : v)).join(',');
  const csv = `${encabezado}\n${ejemplo}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-propiedades.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportarPropiedadesPage() {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filas, setFilas] = useState<FilaParseada[] | null>(null);
  const [importando, setImportando] = useState(false);
  // Cuántos espacios libres quedan contra el límite gratuito — sin esto la
  // persona podía armar y subir un CSV completo sin saber que, si ya está
  // en el tope (o cerca), la mayoría de las filas se van a rechazar una por
  // una (reporte real 2026-09-01, mismo patrón que el botón "Publicar").
  // `null` mientras carga — no bloquea de entrada por un fetch lento.
  const [remanente, setRemanente] = useState<number | null>(null);
  useEffect(() => {
    let cancelado = false;
    backendFetch<{ propiedades: { estado: string }[] }>('/propiedades/mias')
      .then(({ propiedades }) => {
        if (cancelado) return;
        const activas = propiedades.filter((p) => p.estado === 'activa').length;
        setRemanente(Math.max(0, LIMITE_PROPIEDADES - activas));
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);

  function handleFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parseadas: FilaParseada[] = res.data.map((datos, i) => ({
          fila: i + 2, // +1 por encabezado, +1 porque la fila 1 visible es la primera de datos
          datos,
          resultado: construirPayload(datos),
        }));
        setFilas(parseadas);
      },
      error: () => {
        toast.error('No se pudo leer el archivo. Verifica que sea un CSV válido.');
      },
    });
  }

  const validas = filas?.filter((f) => f.resultado.ok) ?? [];
  const invalidas = filas?.filter((f) => !f.resultado.ok) ?? [];

  // Sin endpoint de creación masiva en el backend — cada fila es su propio
  // POST /propiedades, uno a la vez (no en paralelo) para no disparar de
  // golpe el rate limit de creación (10/día por usuario, BACKEND.md §3).
  // Una fila que falla (ej. tope alcanzado a la mitad del CSV) no aborta
  // las que ya se importaron, solo se reporta al final.
  async function confirmarImportacion() {
    if (validas.length === 0) return;
    setImportando(true);
    let ok = 0;
    const fallidas: string[] = [];
    for (const f of validas) {
      if (!f.resultado.ok) continue;
      try {
        await backendFetch('/propiedades', {
          method: 'POST',
          body: JSON.stringify(f.resultado.payload),
        });
        ok += 1;
      } catch (err) {
        fallidas.push(`${f.resultado.titulo}: ${err instanceof BackendApiError ? err.message : 'error desconocido'}`);
      }
    }
    setImportando(false);

    if (ok > 0) {
      toast.success(`${ok} propiedad${ok !== 1 ? 'es' : ''} importada${ok !== 1 ? 's' : ''}.`);
    }
    if (fallidas.length > 0) {
      toast.error(`${fallidas.length} propiedad${fallidas.length !== 1 ? 'es' : ''} no se pudo importar: ${fallidas[0]}${fallidas.length > 1 ? ` (+${fallidas.length - 1} más)` : ''}`);
    }
    if (ok > 0) router.push('/dashboard/propiedades');
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/propiedades" className="text-gray-400 hover:text-brand transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Importar propiedades</h1>
          <p className="text-sm text-gray-500">Sube un CSV para publicar varias propiedades a la vez</p>
        </div>
      </div>

      {remanente === 0 ? (
        <div className="max-w-lg mx-auto text-center bg-white border border-gray-100 rounded-3xl shadow-xl shadow-gray-200/60 p-8 md:p-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
            <AlertCircle size={26} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-heading font-bold text-gray-900 mb-2">Llegaste al límite gratuito</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Ya tienes {LIMITE_PROPIEDADES} propiedades activas — el máximo gratuito por cuenta. Ninguna fila
            del CSV podría publicarse hoy. Pausa o elimina alguna para liberar espacio antes de importar.
          </p>
          <Link href="/dashboard/propiedades" className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-brand-dark transition-colors">
            Ver mis propiedades
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-6">
            <AlertCircle size={15} className="text-brand flex-shrink-0 mt-0.5" />
            <p className="text-xs text-brand-dark leading-relaxed">
              Cada fila se publica igual que el formulario de Publicar, una por una — si tienes muchas,
              puede que topes el límite de publicaciones por día de tu cuenta a la mitad del archivo; las que
              ya se importaron quedan bien, solo repite el CSV restante otro día.
              {remanente !== null && (
                <> Te quedan <strong>{remanente}</strong> espacio{remanente !== 1 ? 's' : ''} libre{remanente !== 1 ? 's' : ''} del límite gratuito.</>
              )}
            </p>
          </div>

          {!filas ? (
        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-8">
          <button
            type="button"
            onClick={descargarPlantilla}
            className="flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark mb-6"
          >
            <Download size={15} /> Descargar plantilla CSV de ejemplo
          </button>

          <div
            className="border-2 border-dashed border-gray-200 hover:border-brand/40 hover:bg-brand-pale/20 rounded-2xl p-10 text-center cursor-pointer transition-all"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <FileSpreadsheet size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">Arrastra tu archivo CSV aquí</p>
            <p className="text-xs text-gray-400 mt-1">o <span className="text-brand font-semibold">haz clic para seleccionar</span></p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <CheckCircle2 size={14} /> {validas.length} válida{validas.length !== 1 ? 's' : ''}
            </span>
            {invalidas.length > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                <AlertCircle size={14} /> {invalidas.length} con errores
              </span>
            )}
            <button
              type="button"
              onClick={() => setFilas(null)}
              className="text-sm font-semibold text-gray-500 hover:text-brand ml-auto"
            >
              Elegir otro archivo
            </button>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
              {filas.map((f) => (
                <div key={f.fila} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-xs font-mono text-gray-300 w-10 flex-shrink-0 pt-0.5">#{f.fila}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {f.datos.titulo || <span className="text-gray-300 italic">(sin título)</span>}
                    </p>
                    {!f.resultado.ok && (
                      <ul className="text-xs text-red-500 mt-0.5 list-disc list-inside">
                        {f.resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                  {f.resultado.ok
                    ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    : <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />}
                </div>
              ))}
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            className="w-full justify-center"
            disabled={validas.length === 0}
            isLoading={importando}
            onClick={confirmarImportacion}
          >
            <Upload size={16} /> Importar {validas.length} propiedad{validas.length !== 1 ? 'es' : ''}
          </Button>
        </div>
          )}
        </>
      )}
    </div>
  );
}
