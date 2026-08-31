'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button, buttonClasses } from '@/components/ui/Button';
import {
  CheckCircle, ChevronRight, ChevronLeft, Sparkles, ImagePlus, X, Images, AlertCircle,
  Home, DollarSign, MapPin, FileText, Camera, Phone, Info, ShieldAlert, ShieldX, Droplets,
  Tag, Key, Lightbulb, ShieldCheck, Loader2, EyeOff, RefreshCw, TrendingUp, Star,
} from 'lucide-react';
import { SERVICIOS_RENTA } from '@/lib/servicios';
import { AMENIDADES_OPTIONS, AMENIDADES_MAP } from '@/lib/amenidades';
import { evaluarCalidadFoto, type CalidadFoto } from '@/lib/calidadFoto';
import { generarTituloAutomatico } from '@/lib/tituloGenerator';
import { detectarLenguajeSensible } from '@/lib/contentModeration';
import { detectarRiesgoInundacion } from '@/lib/zonas-inundacion';
import type { RiesgoInundacion } from '@/lib/zonas-inundacion';
import type { Coords } from './MapPicker';
import { FloodRiskBadge } from '@/components/property/FloodRiskBadge';
import { TermsModal } from './TermsModal';
import { useToast } from '@/context/ToastContext';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { getAllProperties } from '@/lib/api';
import posthog from 'posthog-js';
import { matchColonia, distanciaKm, precargarColoniasDescubiertas, type ColoniaCoord } from '@/lib/colonias';
import { landmarksCercanos, precargarLandmarks } from '@/lib/landmarks';
import {
  clasificarGPSFoto, esPublicacionBloqueada, debeReevaluarFraude, contarContactoReutilizado,
  type ResultadoGPSFoto,
} from '@/lib/publishFraudGuard';
import { hashImagenDesdeFile, hashImagenDesdeUrl, distanciaHamming, UMBRAL_HASH_SIMILAR } from '@/lib/fotoHash';
import { estaEnTabasco } from '@/lib/tabascoBoundary';
import { resizeImageToDataUrl, MAX_SOURCE_BYTES } from '@/lib/imageResize';
import {
  publishSchema, type PublishFormData,
  TIPO_OPTIONS, MUNICIPIO_OPTIONS, MUNICIPIO_CENTERS, METODO_CONTACTO_OPTIONS, construirAgenteContacto,
  MAX_FOTOS,
} from '@/lib/publishSchema';
interface ResultadoImagenIA {
  apta: boolean;
  relacionada: boolean;
  señalesFraude: string[];
  notas: string;
  // Opcional — el backend todavía no lo manda (pendiente coordinar, ver
  // AMENIDADES_OPTIONS en amenidades.ts para las labels válidas). Cuando
  // exista, cada foto puede sugerir amenidades visibles en ella (alberca,
  // jardín, etc.) — se usa para pre-marcar el selector manual de abajo,
  // nunca para desmarcar lo que la persona ya eligió a mano.
  amenidadesDetectadas?: string[];
}

type AnalisisFoto = 'pendiente' | ResultadoImagenIA;

async function analizarFoto(file: File): Promise<ResultadoImagenIA> {
  const NEUTRAL: ResultadoImagenIA = { apta: true, relacionada: true, señalesFraude: [], notas: '' };
  try {
    // 512px basta para que el modelo juzgue contenido/relevancia — no hace
    // falta mandar la foto a resolución completa solo para esto.
    // Bug real encontrado y verificado en vivo 2026-08-31 (reporte:
    // "aparece como rota" al subir una foto de ~5MB): sin especificar
    // formato, resizeImageToDataUrl() cae al default 'image/png' —
    // PNG SIN PÉRDIDA de una foto real (textura, ruido de sensor) a 512px
    // pesa fácilmente 600KB+, por encima del límite de tamaño del backend.
    // POST /ia/analizar-imagen respondía 413 "request entity too large" en
    // silencio (analizarFoto() atrapa el error y sigue con NEUTRAL,
    // fail-open) — la miniatura en sí nunca se rompe (usa el archivo
    // original vía URL.createObjectURL, ver addFiles más abajo, ajeno a
    // esta llamada), pero la detección de amenidades/señales de fraude por
    // foto se perdía sin aviso para cualquier foto con suficiente detalle.
    // Mismo patrón ya usado en el resto del archivo (línea ~833) y en
    // portafolio de servicios para foto de contenido real: JPEG con
    // pérdida, no PNG.
    const dataUrl = await resizeImageToDataUrl(file, 512, 'image/jpeg', 0.82);
    return await backendFetch<ResultadoImagenIA>('/ia/analizar-imagen', {
      method: 'POST',
      body: JSON.stringify({ imagen: dataUrl }),
    });
  } catch {
    // Fail open — un error de red no debe bloquear publicar, igual que el
    // resto de las funciones de IA de la plataforma.
    return NEUTRAL;
  }
}

type DeteccionUI =
  | { riesgo: RiesgoInundacion; confianza: 'confirmada' | 'probable'; metodo: 'texto' }
  | { riesgo: RiesgoInundacion; confianza: 'confirmada'; metodo: 'gis'; zona: string };

const MapPicker = dynamic(
  () => import('./MapPicker').then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => <div className="h-[220px] rounded-2xl bg-gray-100 animate-pulse" />,
  }
);

const STEPS = ['Tipo', 'Detalles', 'Ubicación', 'Descripción', 'Fotos', 'Contacto'];
const STEP_ICONS = [Home, DollarSign, MapPin, FileText, Camera, Phone] as const;
// El paso de fotos decía "3× más contactos" — un multiplicador preciso que
// nadie mide aquí (no hay tabla de eventos real, BACKEND.md §12).
// Se quita el número inventado, se conserva el consejo (universalmente
// cierto en bienes raíces) sin presentarlo como un dato propio medido.
const STEP_SUBTITLES = [
  '¿Qué tipo de propiedad quieres publicar?',
  'Precio, metros y características',
  '¿Dónde está ubicada?',
  'Escribe un anuncio que destaque',
  'Las fotos generan más contactos',
  '¿Cómo te pueden contactar?',
];
// Terreno/local/bodega pueden mostrarse legítimamente vacíos (sin
// construcción, la pura caja sin muebles) — esas fotos dan poca textura y
// disparan el mismo puntaje de "borrosa" que una foto realmente movida.
// Pedido explícito 2026-08-22: no bloquear en esos casos, se queda como
// aviso (igual que oscura/sobreexpuesta), nunca como bloqueo duro.
const TIPOS_SIN_BLOQUEO_BORROSA = new Set(['terreno', 'local', 'bodega']);
// Debe coincidir con LIMITE_PROPIEDADES_ACTIVAS en el backend
// (properties.service.ts) — el servidor es quien de verdad lo hace cumplir
// (código LIMITE_PROPIEDADES_ALCANZADO), esto solo evita hacer perder el
// tiempo a quien ya topó antes de llenar los 6 pasos del formulario.
// 2026-08-10: bajado de 4 a 3 por decisión de producto confirmada — ver
// docs/PLAN-AUDITORIA-FASE1-MVP.md punto 0. Coordinar con el backend, ver
// docs/BACKEND-17082026.md.
const LIMITE_PROPIEDADES = 3;

// Nombres legibles para el resumen de "campos por corregir" — sin esto, la
// lista mostraría las llaves crudas del schema (ej. "riesgoInundacion" en
// vez de "Riesgo de inundación"). Solo cubre los campos que participan en
// `stepFields` (los que de verdad bloquean avanzar); el resto de FormData
// nunca aparece ahí.
const ETIQUETAS_CAMPO: Partial<Record<keyof FormData, string>> = {
  tipo: 'Tipo de propiedad',
  operacion: 'Operación (venta o renta)',
  precio: 'Precio',
  municipio: 'Municipio',
  colonia: 'Colonia',
  riesgoInundacion: 'Riesgo de inundación',
  titulo: 'Título del anuncio',
  descripcion: 'Descripción',
  nombreContacto: 'Tu nombre',
  metodoContacto: 'Método de contacto',
  telefonoContacto: 'Teléfono',
  emailContacto: 'Correo electrónico',
};

type FormData = PublishFormData;

/**
 * Botón "chip" — blanco/marca cuando está activo, gris neutro cuando no.
 * El <input type="radio"> real queda `sr-only` (accesible, pero invisible) y
 * este <div> visual reacciona a su estado — por eso necesita `peer-focus-visible`
 * aquí: sin esto, alguien navegando solo con teclado no ve cuál opción tiene
 * el foco antes de seleccionarla con espacio/flechas (WCAG 2.4.7).
 */
const FOCUS_RING = 'peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2';
const toggleCls = {
  inactive: `border-gray-200 bg-white text-gray-500 hover:border-brand/40 hover:text-brand hover:bg-brand-pale/30 ${FOCUS_RING}`,
  active:   `border-brand bg-brand text-white font-bold shadow-sm ${FOCUS_RING}`,
} as const;

export function PublishForm() {
  const [step, setStep]           = useState(0);
  const [aiLoading, setAiLoading]     = useState(false);
  // Antes de migrar de Gemini, ofrecer "genera otra versión" hubiera
  // invitado a agotar la cuota de 20/día de Gemini con un par de clics de
  // una sola persona — con OpenRouter (ver openRouterClient.ts), sin techo
  // de tokens diario, ya no hay razón para esconder que el mismo botón se
  // puede usar más de una vez.
  const [aiGenerated, setAiGenerated] = useState(false);
  const [coords, setCoords]       = useState<Coords | null>(null);
  // true cuando `coords` vino de EXIF de una foto (no de un clic manual)
  // — ver sugerirPinDesdeFoto() más abajo. Solo cambia el texto de ayuda
  // bajo el mapa, nunca bloquea que la persona lo mueva.
  const [pinDesdeFoto, setPinDesdeFoto] = useState(false);
  // Colonia catalogada más cercana al GPS de una foto, cuando difiere de lo
  // que la persona ya escribió — ver sugerirPinDesdeFoto() más abajo. Nunca
  // se aplica sola, solo se ofrece un botón para corregir.
  const [coloniaSugerida, setColoniaSugerida] = useState<ColoniaCoord | null>(null);
  // Señal de fraude nivel-3 (pedido explícito 2026-08-31): el GPS de una
  // foto que NO coincide con la colonia/municipio declarados — dirección
  // opuesta a coloniaSugerida (que solo actúa cuando SÍ coincide). Se
  // guarda tanto en estado (para el aviso visible) como en un ref (para
  // que evaluar(), definida en un efecto separado que no depende de este
  // valor, siempre lea la versión más reciente sin quedar en un closure
  // viejo). Ver analizarGPSFoto() más abajo.
  const [gpsContradiccion, setGpsContradiccion] = useState<number | null>(null);
  const gpsContradiccionRef = useRef<number | null>(null);
  // Cuántas OTRAS propiedades activas ya usan el mismo teléfono/WhatsApp
  // que se está por publicar — un número real de agente/casero con varias
  // propiedades es normal, pero es una señal más para el backend, nunca
  // suficiente sola (ver ContactoReuso más abajo).
  const [contactoReutilizado, setContactoReutilizado] = useState(0);
  const contactoReutilizadoRef = useRef(0);
  const [fotos, setFotos]         = useState<{ file: File; preview: string; analisis: AnalisisFoto; calidad: CalidadFoto | null }[]>([]);
  const [dragOver, setDragOver]   = useState(false);
  const [servicios, setServicios] = useState<string[]>([]);
  const [amenidades, setAmenidades] = useState<string[]>([]);
  const [stepError, setStepError] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const fileInputRef            = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast  = useToast();

  // Límite gratuito de propiedades activas — pre-chequeo contra
  // GET /propiedades/mias real (BACKEND.md §3 punto 13), el servidor es
  // quien de verdad lo hace cumplir. Empieza en `false` para no bloquear el
  // primer render; si de verdad está en el límite, el gate de abajo
  // reemplaza el formulario en cuanto el efecto corre.
  const [limiteAlcanzado, setLimiteAlcanzado] = useState(false);
  // Fotos de las OTRAS propiedades del mismo dueño — reusa esta misma
  // llamada (ya se hacía para el límite gratuito) para además alimentar la
  // detección de "ya subiste esta foto antes" (ver detectarFotoRepetida()
  // más abajo, fotoHash.ts). Sin llamada extra al backend.
  const [propiasFotos, setPropiasFotos] = useState<{ id: string; titulo: string; fotos: string[] }[]>([]);
  const hashesPropiosRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    let cancelado = false;
    backendFetch<{ propiedades: { id: string; estado: string; titulo: string; fotos: string[] }[] }>('/propiedades/mias')
      .then(({ propiedades }) => {
        if (cancelado) return;
        const activas = propiedades.filter((p) => p.estado === 'activa').length;
        setLimiteAlcanzado(activas >= LIMITE_PROPIEDADES);
        setPropiasFotos(propiedades.filter((p) => p.fotos.length > 0));
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);

  // Igual que precargarColoniasDescubiertas()/coloniasReady más abajo —
  // fire-and-forget, alimenta las sugerencias de "menciona este lugar
  // cercano" del paso de Fotos (ver landmarksSugeridos). El estado
  // `landmarksReady` existe solo para disparar un recálculo cuando el
  // catálogo (variable de módulo, no estado de React) termina de llegar.
  const [landmarksReady, setLandmarksReady] = useState(false);
  useEffect(() => { precargarLandmarks().then(() => setLandmarksReady(true)); }, []);

  // Compara una foto recién agregada contra las de las OTRAS propiedades de
  // este mismo dueño (nunca contra las de otros usuarios — ver el
  // comentario de alcance en fotoHash.ts). Solo avisa, nunca bloquea: puede
  // ser perfectamente intencional (la misma fachada en dos anuncios del
  // mismo edificio, por ejemplo).
  async function detectarFotoRepetida(file: File) {
    if (propiasFotos.length === 0) return;
    const hashNueva = await hashImagenDesdeFile(file);
    if (!hashNueva) return;
    for (const prop of propiasFotos) {
      for (const url of prop.fotos) {
        let hashExistente = hashesPropiosRef.current.get(url);
        if (hashExistente === undefined) {
          const h = await hashImagenDesdeUrl(url);
          if (h === null) continue;
          hashExistente = h;
          hashesPropiosRef.current.set(url, h);
        }
        if (distanciaHamming(hashNueva, hashExistente) <= UMBRAL_HASH_SIMILAR) {
          toast.info(`Esta foto se parece a una que ya usaste en "${prop.titulo}" — revisa que no la hayas subido por error.`);
          return;
        }
      }
    }
  }

  // f.type viene del navegador (a veces solo la extensión, no el contenido
  // real) — un archivo no-imagen renombrado podía pasar este filtro y
  // luego fallar al decodificar en analizarFoto(), que responde "apta" por
  // defecto ante cualquier error (fail-open pensado para fallas de red, no
  // para archivos corruptos/falsos). createImageBitmap() sí valida el
  // contenido real: si no decodifica, se rechaza aquí, antes de llegar al
  // análisis de IA.
  // Pedido explícito 2026-08-30: si una foto trae coordenadas GPS reales
  // (EXIF), sugerir el pin automáticamente — pero SOLO si coincide con lo
  // que la persona ya escribió en Ubicación (colonia/municipio, paso
  // anterior a Fotos). Sin este candado, una foto reciclada de otro
  // anuncio (mismo patrón de fraude que ya documentan las guías de
  // Seguridad) traería el GPS del lugar ORIGINAL, no de esta propiedad —
  // autocolocar el pin ahí se vería "confiable" siendo justo la mentira
  // que un estafador querría reforzar. Nunca sobreescribe un pin que la
  // persona ya puso a mano (ver el `if (coords)` en addFiles).
  //
  // La mayoría de fotos NO van a traer este dato — WhatsApp, Instagram y
  // Facebook borran el EXIF (incluido GPS) al comprimir/reenviar, que es
  // como llega la mayoría de fotos de propiedad en la práctica. Cuando sí
  // está, es gratis (se lee 100% en el navegador, sin llamada de red).
  // Lee el EXIF (I/O) y delega la clasificación matemática a
  // clasificarGPSFoto() (src/lib/publishFraudGuard.ts, con pruebas propias)
  // — unifica la sugerencia de pin (GPS coincide con lo declarado) y la
  // contradicción (GPS NO coincide, señal de posible fraude) en una sola
  // lectura de EXIF por foto, en vez de parsear el archivo dos veces.
  async function analizarGPSFoto(file: File): Promise<ResultadoGPSFoto | null> {
    let gps: { latitude: number; longitude: number } | undefined;
    try {
      const exifr = await import('exifr');
      gps = await exifr.gps(file);
    } catch {
      return null; // sin EXIF, EXIF corrupto, o formato no soportado (ej. HEIC) — silencioso, no es un error real
    }
    if (!gps) return null;
    if (!estaEnTabasco(gps.latitude, gps.longitude)) return null;

    return clasificarGPSFoto(gps, {
      coloniaVerificada,
      municipio,
      municipioCenter: municipio ? MUNICIPIO_CENTERS[municipio] : undefined,
    });
  }

  async function addFiles(files: FileList | File[]) {
    const candidatos = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const slots = MAX_FOTOS - fotos.length;
    const porRevisar = candidatos.slice(0, slots);

    // Bug real reportado desde el día anterior ("algunas fotos caen como
    // rotas, otras sí pasan"): una foto de cámara reciente (>15MB antes,
    // ahora el límite subió, ver imageResize.ts) pasaba esta validación sin
    // problema, se veía normal en la grilla, y solo fallaba en silencio
    // hasta publicar — analizarFoto() trata el rechazo por peso de
    // resizeImageToDataUrl() como un error de red más (fail-open) y no
    // avisa nada. Se rechaza aquí mismo, con la razón visible, antes de
    // intentar nada más.
    const sinSobrepeso = porRevisar.filter((f) => f.size <= MAX_SOURCE_BYTES);
    const pesadas = porRevisar.length - sinSobrepeso.length;
    if (pesadas > 0) {
      const maxMb = Math.round(MAX_SOURCE_BYTES / (1024 * 1024));
      toast.error(`${pesadas} foto${pesadas !== 1 ? 's' : ''} ${pesadas !== 1 ? 'pesan' : 'pesa'} demasiado (máx. ${maxMb}MB) y no se ${pesadas !== 1 ? 'agregaron' : 'agregó'}.`);
    }

    const validaciones = await Promise.all(
      sinSobrepeso.map(async (file) => {
        try {
          const bitmap = await createImageBitmap(file);
          bitmap.close();
          return { file, valido: true };
        } catch {
          return { file, valido: false };
        }
      })
    );
    const validos = validaciones.filter((v) => v.valido).map((v) => v.file);
    const rechazados = validaciones.length - validos.length;
    if (rechazados > 0) {
      toast.error(`${rechazados} archivo${rechazados !== 1 ? 's' : ''} no ${rechazados !== 1 ? 'son' : 'es'} una imagen válida y no se agregó.`);
    }

    // Chequeo técnico (nitidez/brillo) — 100% local, no espera a la IA del
    // backend. Borrosa SÍ bloquea (pedido explícito 2026-08-22) — excepto
    // en tipos que pueden mostrarse legítimamente vacíos/sin textura
    // (TIPOS_SIN_BLOQUEO_BORROSA), donde se queda solo como aviso, igual
    // que oscura/sobreexpuesta.
    const conCalidad = await Promise.all(validos.map(async (file) => ({ file, calidad: await evaluarCalidadFoto(file) })));
    const bloqueaBorrosa = !TIPOS_SIN_BLOQUEO_BORROSA.has(watch('tipo'));
    const nitidas = bloqueaBorrosa ? conCalidad.filter((c) => !c.calidad?.borrosa) : conCalidad;
    const borrosas = bloqueaBorrosa ? conCalidad.length - nitidas.length : 0;
    if (borrosas > 0) {
      toast.error(`${borrosas} foto${borrosas !== 1 ? 's' : ''} ${borrosas !== 1 ? 'salieron' : 'salió'} borrosa${borrosas !== 1 ? 's' : ''} y no se ${borrosas !== 1 ? 'agregaron' : 'agregó'} — usa una foto más nítida.`);
    }

    const toAdd = nitidas.map(({ file, calidad }) => ({
      file, preview: URL.createObjectURL(file), analisis: 'pendiente' as AnalisisFoto, calidad,
    }));
    setFotos((prev) => [...prev, ...toAdd]);

    // Compara cada foto nueva contra las de las OTRAS propiedades de este
    // dueño — solo aviso, nunca bloquea (ver detectarFotoRepetida arriba).
    toAdd.forEach((item) => { detectarFotoRepetida(item.file); });

    // Analiza cada foto en paralelo, sin bloquear la UI mientras se agregan
    // — si el usuario ya quitó la foto para cuando responde, el .map() de
    // abajo simplemente no encuentra coincidencia y no hace nada.
    toAdd.forEach((item) => {
      analizarFoto(item.file).then((analisis) => {
        setFotos((prev) => prev.map((f) => (f.file === item.file ? { ...f, analisis } : f)));
        // Solo AGREGA sugerencias, nunca quita lo que la persona ya marcó
        // o desmarcó a mano — y solo acepta labels que de verdad existen
        // en el catálogo (AMENIDADES_MAP), por si el backend algún día
        // manda algo que no coincide exactamente.
        if (analisis.amenidadesDetectadas?.length) {
          const validas = analisis.amenidadesDetectadas.filter((a) => AMENIDADES_MAP.has(a));
          if (validas.length > 0) {
            setAmenidades((prev) => Array.from(new Set([...prev, ...validas])));
          }
        }
      });
    });

    // Sugerencia de pin por EXIF (solo si todavía no hay ninguno puesto,
    // nunca sobreescribe uno ya elegido) y detección de contradicción
    // (corre SIEMPRE, sin importar si ya hay pin — es una señal de fraude,
    // no una conveniencia). `habiaCoordsAlInicio`/`yaSugerido` evitan que
    // dos fotos del mismo lote se pisen entre sí.
    const habiaCoordsAlInicio = !!coords;
    let yaSugerido = false;
    toAdd.forEach((item) => {
      analizarGPSFoto(item.file).then((resultado) => {
        if (!resultado) return;
        if (resultado.tipo === 'contradiccion') {
          setGpsContradiccion(resultado.distanciaKm);
          gpsContradiccionRef.current = resultado.distanciaKm;
          return;
        }
        if (habiaCoordsAlInicio || yaSugerido) return;
        yaSugerido = true;
        setCoords(resultado.coords);
        setPinDesdeFoto(true);
        // Toast, no solo el estado — la persona está viendo el paso de
        // Fotos en este momento, no el mapa (eso vive en el paso de
        // Ubicación, anterior). Sin este aviso, el pin se movería solo
        // en un paso que ya no está mirando.
        toast.success('Ubicamos tu propiedad en el mapa usando la ubicación de tu foto — puedes ajustarla en el paso de Ubicación.');
        if (resultado.coloniaSugerida) setColoniaSugerida(resultado.coloniaSugerida);
      });
    });
  }

  function removePhoto(idx: number) {
    setFotos((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  // Mueve una foto al índice 0 ("Principal") — usado por la sugerencia de
  // portada de abajo, sugerencia nunca automática: el dueño decide.
  function usarComoPortada(idx: number) {
    setFotos((prev) => {
      if (idx <= 0 || idx >= prev.length) return prev;
      const arr = [...prev];
      const [item] = arr.splice(idx, 1);
      arr.unshift(item);
      return arr;
    });
  }

  // Solo sugiere si otra foto está claramente mejor (diferencia >= 15 pts)
  // que la actual portada — evita sugerir por un empate marginal que no se
  // notaría en la práctica.
  const mejorPortadaIdx = useMemo(() => {
    if (fotos.length < 2) return null;
    let bestIdx = 0;
    let bestScore = fotos[0].calidad?.score ?? -1;
    fotos.forEach((f, i) => {
      const s = f.calidad?.score ?? -1;
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    });
    if (bestIdx === 0) return null;
    const actual = fotos[0].calidad?.score ?? -1;
    return bestScore - actual >= 15 ? bestIdx : null;
  }, [fotos]);

  function toggleServicio(key: string) {
    setServicios((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  // Por label, no por key — ver comentario en amenidades.ts.
  function toggleAmenidad(label: string) {
    setAmenidades((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  }

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(publishSchema),
    // `operacion` explícito en vez de dejarlo fuera — confirmado con
    // pruebas reales (2026-08-08) que un grupo de radios sin entrada aquí
    // empieza en `null` (no en `''` como un <select>/<input> normal), y
    // `z.string()` sin un mensaje de tipo propio mostraba el genérico de
    // Zod ("Invalid input: expected string, received null") en vez del
    // mensaje real del campo — ver también `str()` en publishSchema.ts,
    // la segunda capa de esta misma corrección.
    defaultValues: { recamaras: 0, banos: 0, m2Construidos: 0, m2Terreno: 0, aceptaTerminos: false, metodoContacto: 'ambos', operacion: '' },
  });

  const tipo        = watch('tipo');
  // Un terreno vacío no tiene m² construidos, recámaras ni baños — pedirlos
  // siempre (como antes, con una nota "déjalo en 0 si no aplica") confundía
  // más de lo que ayudaba (reporte explícito 2026-08-20: "pregunta recámaras
  // y baños, lo cual no aplica"). Pero un terreno SÍ puede tener una casa ya
  // construida encima, así que en vez de ocultar esos campos sin más, se
  // pide confirmarlo con un checkbox — solo entonces se muestran.
  const [terrenoConstruido, setTerrenoConstruido] = useState(false);
  useEffect(() => {
    if (tipo !== 'terreno') setTerrenoConstruido(false);
  }, [tipo]);
  // m² construidos y baños son parte de "área techada" — no aplican a un
  // terreno vacío, sí a cualquier otro tipo (local/oficina/bodega/habitación
  // sí tienen área construida y baños, aunque no "recámaras").
  const mostrarCamposConstruccion = tipo !== 'terreno' || terrenoConstruido;
  // Recámaras no aplica a local/oficina/bodega/habitación — un espacio
  // comercial o un cuarto individual no se describen en número de cuartos.
  // terreno se queda incluido: si ya tiene construcción (checkbox de
  // arriba), esa construcción puede tener recámaras igual que una casa.
  const tipoConRecamaras = mostrarCamposConstruccion && (tipo === 'casa' || tipo === 'departamento' || tipo === 'terreno');
  const colonia     = watch('colonia');
  const municipio   = watch('municipio');
  const descripcion = watch('descripcion');
  const mapCenter = (MUNICIPIO_CENTERS[municipio ?? ''] ?? [17.9869, -92.9303]) as [number, number];
  const frasesSensibles = descripcion ? detectarLenguajeSensible(descripcion) : [];

  // Aviso (no bloqueante) si el pin que se marcó en el mapa queda lejos de
  // la colonia escrita arriba — mismo tipo de inconsistencia real que se
  // encontró y corrigió en el catálogo de muestra dos veces esta sesión
  // ("Centro Histórico" y "Atasta" apuntaban a un lugar distinto del que
  // describían). Solo se puede comparar cuando la colonia escrita coincide
  // con el catálogo verificado (colonias.ts) — si no coincide, no hay
  // centroide real contra qué comparar, y no se avisa nada (no es lo mismo
  // "no pudimos verificar" que "está mal"). 3km es generoso a propósito:
  // una colonia es un área, no un punto, así que solo se avisa cuando la
  // distancia ya no se explica por eso.
  // /publicar (a diferencia de /propiedades y /mapa) nunca disparaba la
  // precarga del catálogo de colonias descubiertas dinámicamente
  // (coloniasDescubiertasCache, colonias.ts) — quien llega directo aquí
  // (el caso normal, "Publicar gratis") sin haber visitado antes /propiedades
  // en la misma sesión se quedaba SIEMPRE sin poder verificar ninguna
  // colonia fuera del catálogo estático de 70, no solo por una carrera de
  // tiempos. Auditoría sitewide 2026-08-20 del mismo bug de fondo ya
  // corregido en filters.ts/PropertiesClient.tsx/MapaClient.tsx.
  const [coloniasReady, setColoniasReady] = useState(false);
  useEffect(() => { precargarColoniasDescubiertas().then(() => setColoniasReady(true)); }, []);

  const coloniaVerificada = useMemo(
    () => (colonia ? matchColonia(colonia, municipio) : undefined),
    [colonia, municipio, coloniasReady], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const distanciaPinColonia = coords && coloniaVerificada
    ? distanciaKm(coords.lat, coords.lng, coloniaVerificada.lat, coloniaVerificada.lng)
    : null;
  const pinLejosDeColonia = distanciaPinColonia !== null && distanciaPinColonia > 3;

  // Lugares reales catalogados cerca de la propiedad, que TODAVÍA no se
  // mencionan en la descripción — son los mismos nombres que ya resuelve la
  // búsqueda por texto/IA (landmarks.ts), así que mencionarlos de verdad
  // ayuda a aparecer en esas búsquedas. Se calcula sobre `coords` si ya hay
  // pin puesto, o sobre el centroide de la colonia verificada si no —
  // ninguno de los dos requiere que la persona haya llegado al paso de
  // Fotos todavía.
  // Consts simples, no useMemo — la lista de candidatos es pequeña (~120
  // landmarks máximo, unas pocas amenidades) y `descripcion` ya cambia en
  // cada tecleo de todos modos, así que memoizar no ahorra nada real y sí
  // encadena con el `eslint-disable-line` de `coloniaVerificada` de arriba
  // (React Compiler no puede preservar memoización que depende de un valor
  // cuya propia memoización ya está marcada como no verificable).
  void landmarksReady; // fuerza reevaluar cuando el catálogo de landmarks termina de cargar (variable de módulo, no estado)
  const puntoParaSugerencias = coords ?? (coloniaVerificada ? { lat: coloniaVerificada.lat, lng: coloniaVerificada.lng } : null);
  const textoDescripcion = (descripcion ?? '').toLowerCase();
  const landmarksSugeridos = puntoParaSugerencias
    ? landmarksCercanos(puntoParaSugerencias.lat, puntoParaSugerencias.lng, 2)
        .filter((l) => ![l.label, ...(l.aliases ?? [])].some((n) => textoDescripcion.includes(n.toLowerCase())))
        .slice(0, 3)
    : [];

  // Mismo criterio para amenidades ya marcadas (paso de Fotos) que todavía
  // no aparecen literalmente en el texto — la búsqueda por palabra clave sí
  // usa coincidencia literal como respaldo cuando la IA no está disponible.
  const amenidadesSugeridas = amenidades.filter((a) => !textoDescripcion.includes(a.toLowerCase())).slice(0, 3);

  function agregarMencionADescripcion(texto: string) {
    const actual = (getValues('descripcion') || '').trim();
    const separador = actual.length === 0 ? '' : /[.!?]$/.test(actual) ? ' ' : '. ';
    setValue('descripcion', `${actual}${separador}${texto}`, { shouldValidate: true, shouldDirty: true });
  }

  // ── Detección automática de riesgo de inundación ───────────────────────────
  const [deteccion, setDeteccion] = useState<DeteccionUI | null>(null);
  const [autoRiesgo, setAutoRiesgo] = useState<string | null>(null);
  // Checkbox obligatorio solo cuando la persona BAJA el riesgo respecto al
  // detectado por el Atlas de Riesgos (ver esDowngrade más abajo) — subirlo
  // (marcar "alto" cuando el Atlas dice "medio") nunca requiere esto, ser
  // más conservador no es un problema a confirmar.
  const [confirmaRiesgoBajo, setConfirmaRiesgoBajo] = useState(false);

  function applyDeteccion(d: DeteccionUI | null) {
    setDeteccion(d);
    // Cambió la colonia/municipio => cambió (o desapareció) la detección
    // — cualquier confirmación de "bajé el riesgo a propósito" que se
    // hubiera dado para la detección ANTERIOR ya no aplica a esta.
    setConfirmaRiesgoBajo(false);
    if (d) {
      setAutoRiesgo(d.riesgo);
      setValue('riesgoInundacion', d.riesgo);
    } else {
      setAutoRiesgo(null);
      setValue('riesgoInundacion', undefined as unknown as 'alto' | 'medio' | 'bajo');
    }
  }

  // Si recámaras/m² construidos/baños quedan ocultos (tipo cambia a uno
  // comercial, o un terreno deja de marcarse como "ya construido"), limpia
  // los valores — sin esto, un número cargado con un tipo/estado anterior
  // (ej. "3" recámaras con "casa") seguía viajando escondido al submit tras
  // cambiar a "local" o desmarcar el checkbox de construcción.
  useEffect(() => {
    if (!tipoConRecamaras) setValue('recamaras', 0);
  }, [tipoConRecamaras, setValue]);
  useEffect(() => {
    if (!mostrarCamposConstruccion) {
      setValue('m2Construidos', 0);
      setValue('banos', 0);
    }
  }, [mostrarCamposConstruccion, setValue]);

  // Text detection from colony name — GPS coords se guardan con la propiedad
  // pero no se usan para clasificar riesgo hasta tener shapefiles oficiales de IMPLAN.
  useEffect(() => {
    const txt = detectarRiesgoInundacion(colonia ?? '', municipio);
    applyDeteccion(txt ? { ...txt, metodo: 'texto' } : null);
  }, [colonia, municipio]); // eslint-disable-line react-hooks/exhaustive-deps

  const riesgoActual  = watch('riesgoInundacion');
  const fueModificado = autoRiesgo !== null && riesgoActual !== autoRiesgo;
  // true solo si el valor elegido a mano es MENOS severo que el detectado
  // por el Atlas — subestimar el riesgo es lo que de verdad puede engañar a
  // un interesado, por eso es el único caso que pide confirmación explícita
  // (mismo catálogo que ya usa el coach para propiedades ya publicadas, ver
  // coach.ts "riesgo-inconsistente").
  const RIESGO_ORDEN: Record<'bajo' | 'medio' | 'alto', number> = { bajo: 0, medio: 1, alto: 2 };
  const esDowngrade = fueModificado && autoRiesgo !== null && riesgoActual in RIESGO_ORDEN
    && RIESGO_ORDEN[riesgoActual as 'bajo' | 'medio' | 'alto'] < RIESGO_ORDEN[autoRiesgo as 'bajo' | 'medio' | 'alto'];

  // Ocultar banner de error en cuanto el usuario corrige algo
  useEffect(() => {
    if (!stepError) return;
    const { unsubscribe } = watch(() => setStepError(false));
    return unsubscribe;
  }, [stepError, watch]);

  // Autoevaluación de señales de fraude (protege tanto al publicador de
  // publicar algo que "suena" a estafa sin darse cuenta, como a los futuros
  // interesados). Antes corría una sola vez al llegar al último paso —con
  // la cuota de 20/día de Gemini, re-evaluar en cada tecleo hubiera agotado
  // el presupuesto del día completo con una sola persona escribiendo su
  // anuncio. Con OpenRouter (rápido y sin techo de tokens diario, ver openRouterClient.ts)
  // ya no hace falta esperar al final: se re-evalúa con debounce en cuanto
  // el usuario llega al paso de Descripción, así que si el texto es tan
  // incoherente que se bloquearía, se entera ahí mismo en vez de hasta el
  // último paso del formulario.
  const [fraudCheck, setFraudCheck] = useState<{
    riesgo: string; señales: string[]; bloqueado?: boolean; motivoBloqueo?: string;
  } | null>(null);
  useEffect(() => {
    if (step < 3) return;

    function evaluar(values: Partial<FormData>) {
      const titulo = values.titulo || '';
      const descripcion = values.descripcion || '';
      if (!titulo.trim() && !descripcion.trim()) return;
      // Señales que el texto por sí solo no puede evadir reescribiéndose
      // (pedido explícito 2026-08-31) — se mandan como query params, no en
      // el body: el backend hoy los ignora sin romper la llamada
      // (confirmado en vivo, ver docs/BACKEND-FRAUDE-NIVELES-31082026.md),
      // así que esto no cambia nada todavía del lado del servidor, pero
      // deja el frontend listo en cuanto lo adopte. Nunca se usan para
      // bloquear del lado del cliente — eso lo decide el backend.
      const qs = new URLSearchParams();
      if (gpsContradiccionRef.current !== null) qs.set('exifDistanciaKm', String(Math.round(gpsContradiccionRef.current)));
      if (contactoReutilizadoRef.current > 0) qs.set('contactoReutilizado', String(contactoReutilizadoRef.current));
      const query = qs.toString();
      backendFetch<{ riesgo: string; señales: string[]; bloqueado?: boolean; motivoBloqueo?: string }>(`/ia/analizar-fraude${query ? `?${query}` : ''}`, {
        method: 'POST',
        body: JSON.stringify({
          titulo,
          descripcion,
          precio: values.precio || 0,
          municipio: values.municipio || '',
          tipo: values.tipo || '',
          operacion: values.operacion || '',
        }),
      })
        .then((data) => { if (data.riesgo) setFraudCheck(data); })
        .catch(() => {});
    }

    evaluar(getValues());

    let timer: ReturnType<typeof setTimeout>;
    // ⚠️ Bug real encontrado y reproducido en vivo 2026-08-31: sin el
    // filtro por `name`, watch() sin argumento re-dispara con CUALQUIER
    // cambio en CUALQUIER campo del formulario — llenar nombre/teléfono/
    // correo en el paso de Contacto también re-evaluaba título/
    // descripción sin que ese texto cambiara. Combinado con que el modelo
    // de IA no es determinista (confirmado: la misma descripción dio
    // señales distintas en dos llamadas seguidas durante la verificación
    // de esta sesión), esto dejó pasar una publicación con texto
    // claramente fraudulento — el bloqueo de "alto" se había marcado
    // correctamente, pero para cuando se dio clic en "Publicar" ya se
    // había vuelto a evaluar (disparado por llenar el teléfono) y esa
    // vez NO salió "alto". El backend sí la marcó `requiereModeracion`
    // de todos modos (su propio chequeo, independiente) pero el bloqueo
    // del formulario, que es la barrera principal, no debe depender de
    // la suerte de qué tan seguido vuelve a preguntarle a la IA lo mismo.
    const { unsubscribe } = watch((values, { name }) => {
      if (!debeReevaluarFraude(name)) return;
      clearTimeout(timer);
      timer = setTimeout(() => evaluar(values), 1_500);
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reutilización de contacto (pedido explícito 2026-08-31) — cuenta
  // cuántas OTRAS propiedades activas ya usan el mismo teléfono/WhatsApp
  // que se está por publicar. Un agente/casero real con varias propiedades
  // también da un número >0 aquí — por diseño NUNCA bloquea ni se muestra
  // como acusación, solo se manda como señal adicional al backend (ver
  // evaluar() arriba) para que la combine con otras, nunca sola. Corre
  // solo en el paso de Contacto (5), con debounce — trae el catálogo
  // completo (getAllProperties, ya cacheado por el navegador en visitas
  // recientes) así que no tiene sentido repetirlo en cada tecleo de los
  // pasos anteriores.
  //
  // ⚠️ Auditoría 2026-08-31: igual que el chequeo de fraude de arriba, el
  // watch() sin filtrar por campo re-disparaba esto con CUALQUIER cambio
  // en el paso de Contacto (nombre, correo, checkbox), no solo el
  // teléfono — a diferencia del chequeo de fraude esto nunca daba un
  // resultado distinto (getAllProperties() es determinista, no un modelo
  // de IA), así que no era un bug de seguridad, pero sí pedía el catálogo
  // completo sin necesidad en cada tecleo ajeno. Mismo filtro por `name`.
  useEffect(() => {
    if (step < 5) return;
    let cancelado = false;

    async function evaluarContacto(tel: string) {
      if (!tel) { setContactoReutilizado(0); contactoReutilizadoRef.current = 0; return; }
      try {
        const propiedades = await getAllProperties();
        if (cancelado) return;
        const veces = contarContactoReutilizado(propiedades, tel);
        setContactoReutilizado(veces);
        contactoReutilizadoRef.current = veces;
      } catch {
        // Fail-open — mismo criterio que el resto de las señales de esta
        // sesión, un fallo de red no debe bloquear ni ensuciar el estado.
      }
    }

    evaluarContacto((watch('telefonoContacto') || '').trim());

    let timer: ReturnType<typeof setTimeout>;
    const { unsubscribe } = watch((values, { name }) => {
      if (name !== undefined && name !== 'telefonoContacto') return;
      clearTimeout(timer);
      timer = setTimeout(() => evaluarContacto((values.telefonoContacto || '').trim()), 800);
    });
    return () => { cancelado = true; clearTimeout(timer); unsubscribe(); };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Plantilla determinista, no llamada de red — ver tituloGenerator.ts.
  function generarTitulo() {
    const tipoVal = watch('tipo');
    const operacionVal = watch('operacion');
    if (!tipoVal || !operacionVal) {
      toast.error('Elige el tipo de propiedad y si es venta o renta antes de generar el título.');
      return;
    }
    setValue('titulo', generarTituloAutomatico({
      tipo: tipoVal,
      operacion: operacionVal,
      colonia: watch('colonia'),
      municipio: watch('municipio'),
      recamaras: watch('recamaras'),
      m2Construidos: watch('m2Construidos'),
      m2Terreno: watch('m2Terreno'),
    }));
  }

  // Bug real reportado 2026-08-22: "Solo WhatsApp" no guarda correo
  // (construirAgenteContacto), pero el checkbox de abajo pedía "mensaje
  // primero" sin importar el método elegido — esa rama de AgentCard.tsx
  // solo sabe revelar CORREO, así que la combinación dejaba el contacto
  // roto en silencio (revelar "exitoso" sin nada que mostrar). Se fuerza a
  // false y se oculta el checkbox cuando no hay correo posible que revelar.
  const metodoContactoActual = watch('metodoContacto');
  useEffect(() => {
    if (metodoContactoActual === 'whatsapp') setValue('requiereMensajePrimero', false);
  }, [metodoContactoActual, setValue]);

  async function generarConIA() {
    // Bug real reportado 2026-08-21: el botón siempre fallaba con "No se
    // pudo generar la descripción", sin importar cuántas veces se
    // presionara. Reproducido en vivo — el backend rechaza con 400
    // ("metros must not be less than 1") cuando `metros` llega en 0, y
    // m2Construidos SIEMPRE es 0 para un terreno sin construcción (se
    // resetea a propósito, ver el checkbox de "terreno ya construido" más
    // arriba) — para ese tipo, el m² real está en m2Terreno, no en
    // m2Construidos. Se manda el que sí tenga valor; si ninguno lo tiene
    // (ej. casa sin llenar m² todavía), se avisa qué falta en vez de
    // mandar un 0 que el backend siempre va a rechazar.
    const metros = watch('m2Construidos') || watch('m2Terreno') || 0;
    if (metros < 1) {
      toast.error('Agrega los metros cuadrados de la propiedad antes de generar la descripción con IA.');
      return;
    }
    setAiLoading(true);
    try {
      const data = await backendFetch<{ descripcion?: string }>('/ia/generar-anuncio', {
        method: 'POST',
        body: JSON.stringify({
          tipo: watch('tipo'),
          operacion: watch('operacion'),
          colonia: watch('colonia') || 'Villahermosa',
          municipio: watch('municipio') || 'Centro',
          metros,
          precio: watch('precio') || 0,
          recamaras: watch('recamaras') || 0,
          banos: watch('banos') || 0,
        }),
      });
      if (data.descripcion) {
        setValue('descripcion', data.descripcion);
        setAiGenerated(true);
      } else {
        throw new Error('no description returned');
      }
    } catch {
      // Antes fallaba en silencio — el usuario tocaba "Generar con IA" y no
      // pasaba nada, sin ninguna pista de que algo salió mal.
      toast.error('No se pudo generar la descripción. Intenta de nuevo o escríbela tú mismo.');
    } finally {
      setAiLoading(false);
    }
  }

  const stepFields: (keyof FormData)[][] = [
    ['tipo', 'operacion'],
    ['precio'],            // m2, recámaras, baños son opcionales — no bloquean avance
    ['municipio', 'colonia', 'riesgoInundacion'],
    ['titulo', 'descripcion'],
    [],                    // fotos — opcional, sin validación
    ['nombreContacto', 'metodoContacto', 'telefonoContacto', 'emailContacto'],
  ];

  // Campos del paso actual que ya fallaron validación — `errors` solo trae
  // una entrada mientras el campo siga inválido (react-hook-form la quita
  // sola en cuanto se corrige), así que esta lista se actualiza sola sin
  // necesidad de otro estado. Antes solo existía el aviso genérico de
  // arriba ("Completa los campos marcados") sin decir cuáles — ninguno de
  // los tres campos de "Ubicación" (Municipio/Colonia/Riesgo de inundación)
  // tenía forma de saber por qué no lo dejaba avanzar sin adivinar.
  const camposConError = stepFields[step]
    .filter((campo) => errors[campo])
    .map((campo) => ETIQUETAS_CAMPO[campo] ?? campo);

  // Una foto marcada como no apta (contenido inapropiado detectado por IA)
  // bloquea avanzar/publicar. "No relacionada" y señales normales de fraude
  // solo advierten, no bloquean — la única excepción es un texto tan
  // incoherente que no describe ninguna propiedad real (ver ai.ts).
  const fotoNoApta = fotos.find((f) => f.analisis !== 'pendiente' && !f.analisis.apta);
  // Sistema de 3 niveles (pedido explícito 2026-08-31) — bajo: no bloquea.
  // medio: se marca (banner ámbar, no bloquea). alto: ahora SÍ bloquea —
  // antes solo se mostraba como advertencia y la publicación seguía
  // adelante ("se mostrará con un aviso de En revisión"), que es
  // exactamente lo que el pedido señala como el hueco real
  // ("actualmente no se bloquean"). `bloqueado` es un flag aparte, más
  // extremo (texto que ni siquiera describe una propiedad real, ver
  // ai.ts) — se mantiene con su propio mensaje.
  //
  // ⚠️ Este bloqueo es SOLO del lado del cliente — alguien que llame a
  // POST /propiedades directo, sin pasar por este formulario, no lo ve.
  // El backend YA hace un rechazo duro independiente en casos extremos
  // (confirmado en vivo esta sesión: un texto tipo "registro técnico/
  // verificación" fue rechazado directo por el servidor), pero no hay
  // confirmación de que el backend rechace TODO lo que este formulario
  // clasifica como 'alto' — hace falta que el mismo criterio de
  // riesgo/bloqueo se aplique server-side para que esto sea una barrera
  // real y no solo cosmética. Ver docs/BACKEND-PENDIENTES-30082026.md.
  const publicacionBloqueada = esPublicacionBloqueada(fraudCheck);
  // Pedido explícito 2026-08-31: "el formulario permite publicar una
  // propiedad sin fotos, eso está mal. Nunca debe de haber propiedades sin
  // fotos reales" — antes stepFields[4] estaba vacío a propósito ("fotos —
  // opcional"), ahora exige al menos 1. Mismo patrón imperativo que
  // fotoNoApta (no es un campo de react-hook-form, no se puede validar con
  // trigger()).
  const sinFotos = fotos.length === 0;

  const goNext = async () => {
    if (step === 4 && fotoNoApta) {
      toast.error('Quita la foto marcada como inapropiada antes de continuar.');
      return;
    }
    if (step === 4 && sinFotos) {
      toast.error('Agrega al menos una foto real de la propiedad antes de continuar.');
      return;
    }
    if (step === 2 && esDowngrade && !confirmaRiesgoBajo) {
      toast.error('Confirma el aviso sobre el riesgo de inundación antes de continuar.');
      return;
    }
    const valid = await trigger(stepFields[step]);
    if (valid) {
      setStepError(false);
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } else {
      setStepError(true);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (fotoNoApta) {
      toast.error('Quita la foto marcada como inapropiada antes de publicar.');
      setStep(4);
      return;
    }
    if (sinFotos) {
      toast.error('Agrega al menos una foto real de la propiedad antes de publicar.');
      setStep(4);
      return;
    }
    if (publicacionBloqueada) {
      toast.error('No podemos publicar este anuncio — corrige el título y la descripción antes de continuar.');
      return;
    }
    if (esDowngrade && !confirmaRiesgoBajo) {
      toast.error('Confirma el aviso sobre el riesgo de inundación antes de publicar.');
      setStep(2);
      return;
    }
    // Última validación antes de persistir — MapPicker ya rechaza clics/
    // arrastres fuera de Tabasco (src/components/forms/MapPicker.tsx), pero
    // esto es la comprobación real: sin pin, el punto cae al centro del
    // municipio elegido (MUNICIPIO_CENTERS), que por construcción siempre
    // está dentro del estado, así que solo hace falta revisar cuando sí hay
    // un `coords` puesto a mano. Ver también el bloque "BACKEND PENDIENTE"
    // de abajo — el servidor real debe repetir este chequeo con
    // `estaEnTabasco()`, nunca confiar en que el navegador ya lo hizo.
    if (coords && !estaEnTabasco(coords.lat, coords.lng)) {
      toast.error('El punto marcado en el mapa queda fuera de Tabasco — solo se pueden publicar propiedades dentro del estado.');
      setStep(4); // el mapa vive en el paso de Fotos ahora, no en Ubicación
      return;
    }
    // Cada foto se sube por separado a POST /propiedades/fotos (multipart) —
    // el servidor vuelve a analizarla (Gemini) antes de aceptarla y sube a
    // Cloudinary, devolviendo la URL real; `Property.fotos` solo guarda esas
    // URLs, nunca base64. Si una foto falla se omite, igual que antes, en
    // vez de perder toda la publicación por una sola.
    //
    // En paralelo, no secuencial (2026-08-17, docs/PLAN-AUDITORIA-FASE1-MVP.md,
    // hallazgo de escalabilidad) — con MAX_FOTOS en 5, subir una por una
    // significa esperar 5 ciclos completos de red+análisis+Cloudinary uno
    // tras otro. `Promise.allSettled` mantiene el orden real de selección
    // del usuario (importa: la primera es la foto "Principal", ver el badge
    // en el paso de fotos) sin importar cuál termine primero.
    const resultados = await Promise.allSettled(
      fotos.slice(0, MAX_FOTOS).map(async (f) => {
        // 1280px/0.85 -> 1920px/0.92 — 2026-08-22: confirmado con backend
        // (docs/BACKEND-FOTOS-CLOUDINARY-22082026.md) que el único límite
        // real es 8MB por archivo en /propiedades/fotos, sin ninguna
        // compresión de su lado (Cloudinary guarda el original tal cual).
        // El ajuste viejo era muy conservador frente a ese margen — una
        // foto de propiedad a 1920px/calidad 0.92 se queda típicamente en
        // 1-3MB, muy por debajo del límite, con mejor detalle al hacer
        // zoom en la ficha.
        const dataUrl = await resizeImageToDataUrl(f.file, 1920, 'image/jpeg', 0.92);
        const blob = await (await fetch(dataUrl)).blob();
        const body = new FormData();
        body.append('file', blob, f.file.name);
        const { url } = await backendFetch<{ url: string }>('/propiedades/fotos', {
          method: 'POST',
          body,
        });
        return url;
      }),
    );
    const fotosUrls = resultados
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value);
    // Antes esto pasaba en silencio: la propiedad se publicaba con menos
    // fotos de las seleccionadas sin ningún aviso de cuál(es) fallaron.
    const fotosFallidas = resultados.length - fotosUrls.length;
    if (fotosFallidas > 0) {
      toast.error(`${fotosFallidas} foto${fotosFallidas !== 1 ? 's' : ''} no se ${fotosFallidas !== 1 ? 'pudieron' : 'pudo'} subir y se publicará${fotosFallidas !== 1 ? 'n' : ''} sin ella${fotosFallidas !== 1 ? 's' : ''}.`);
    }

    const centro = MUNICIPIO_CENTERS[data.municipio] ?? MUNICIPIO_CENTERS['Centro'];
    const lat = coords?.lat ?? centro[0];
    const lng = coords?.lng ?? centro[1];
    const agente = construirAgenteContacto(data.nombreContacto, data.metodoContacto, data.telefonoContacto, data.emailContacto);

    let created: { id: string };
    try {
      created = await backendFetch<{ id: string }>('/propiedades', {
        method: 'POST',
        body: JSON.stringify({
          titulo: data.titulo,
          descripcion: data.descripcion,
          tipo: data.tipo,
          operacion: data.operacion,
          precio: data.precio,
          m2Construidos: data.m2Construidos || undefined,
          m2Terreno: data.m2Terreno || undefined,
          recamaras: data.recamaras || undefined,
          banos: data.banos || undefined,
          // Bug real encontrado 2026-08-21: antes era [] fijo — ninguna
          // propiedad publicada desde este formulario podía tener
          // amenidades, aunque el campo ya existe en Property y ya se
          // muestra en la ficha pública (PropertyDetailView.tsx).
          amenidades,
          servicios: servicios.length > 0 ? servicios : undefined,
          fotos: fotosUrls,
          municipio: data.municipio,
          colonia: data.colonia,
          // Dirección exacta todavía no se recolecta en el formulario —
          // nunca se muestra públicamente de todos modos (solo
          // latPublico/lngPublico, ver el aviso de privacidad en §1).
          direccion: `${data.colonia}, ${data.municipio}`,
          lat,
          lng,
          riesgoInundacion: data.riesgoInundacion,
          cercaDosoBocas: data.municipio === 'Paraíso',
          agenteNombre: agente.nombre,
          agenteTel: agente.tel,
          agenteEmail: agente.email,
          agenteWhatsapp: agente.whatsapp,
          requiereMensajePrimero: data.requiereMensajePrimero || undefined,
        }),
      });
    } catch (err) {
      if (err instanceof BackendApiError) {
        const code = (err.body as { code?: string } | null)?.code;
        if (code === 'LIMITE_PROPIEDADES_ALCANZADO') {
          setLimiteAlcanzado(true);
          return;
        }
        toast.error(err.message);
        return;
      }
      toast.error('No se pudo publicar tu propiedad. Intenta de nuevo.');
      return;
    }

    // No se guarda nombreContacto/telefonoContacto/emailContacto en
    // sessionStorage: son datos personales que la página de "gracias" no
    // necesita (solo lee `id`), y dejarlos ahí sería una exposición
    // innecesaria de PII (hallazgo H3 de la auditoría).
    sessionStorage.setItem('lastPublishedProperty', JSON.stringify({ id: created.id }));

    // Evento clave para saber si la hipótesis de Fase 1 se cumple — sin
    // esto no hay forma de medir cuántas publicaciones de verdad se
    // completan. Solo tipo/operación/municipio: nada de contacto/PII.
    // docs/PLAN-AUDITORIA-FASE1-MVP.md hallazgo #8.
    posthog.capture('propiedad_publicada', {
      tipo: data.tipo,
      operacion: data.operacion,
      municipio: data.municipio,
      con_fotos: fotosUrls.length > 0,
    });

    // El matching contra alertas guardadas y la notificación (correo +
    // panel) ya los dispara el backend al crear la propiedad
    // (AlertaMatchingService, BACKEND.md §3 punto 10) — no hace falta
    // llamar nada aparte desde aquí como antes.

    // Restaurado 2026-08-17 (docs/PLAN-AUDITORIA-FASE1-MVP.md hallazgo #2):
    // /publicar/gracias ya tiene el link "Gestionar mi propiedad" que motivó
    // saltársela antes (a /dashboard/propiedades, donde vive
    // OwnerActionsBar.tsx) — ese link sigue ahí. Lo que faltaba antes (un
    // enlace real a la ficha pública) ya se puede resolver: Property es
    // real en el backend, así que `created.id` ya es una URL pública
    // válida — /publicar/gracias la usa (ver ese archivo).
    router.push('/publicar/gracias');
  };

  const StepIcon = STEP_ICONS[step];
  // Cuenta solo pasos completados (no el actual) — así coincide con los
  // puntos de progreso de abajo, que tampoco marcan el paso actual como
  // hecho. Antes usaba (step+1)/total, por eso el paso 1 ya mostraba 17%
  // sin haber llenado nada.
  const progressPct = Math.round((step / STEPS.length) * 100);

  // Gate de límite gratuito — reemplaza el formulario entero en vez de
  // dejar avanzar los 6 pasos para recién bloquear en el envío final; es
  // más honesto no hacer perder el tiempo a quien ya topó.
  if (limiteAlcanzado) {
    return (
      <div className="max-w-lg mx-auto text-center bg-white border border-gray-100 rounded-3xl shadow-xl shadow-gray-200/60 p-8 md:p-10">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
          <TrendingUp size={26} className="text-amber-500" />
        </div>
        <h2 className="text-xl font-heading font-bold text-gray-900 mb-2">Llegaste al límite gratuito</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Ya tienes {LIMITE_PROPIEDADES} propiedades activas — el máximo gratuito por cuenta. Si manejas más propiedades (agente independiente o inmobiliaria), contáctanos para un plan profesional.
        </p>
        <a
          href="mailto:hola@vivevillahermosa.mx?subject=Quiero%20un%20plan%20profesional"
          className={buttonClasses('primary', 'lg', 'w-full')}
        >
          Contactar para un plan
        </a>
        <Link href="/dashboard/propiedades" className="block mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Ver mis propiedades
        </Link>
      </div>
    );
  }

  return (
    <div className={`mx-auto ${step === 2 ? 'max-w-4xl' : 'max-w-2xl'}`}>
      <div className={step === 2 ? 'lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:items-start' : ''}>
      <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-xl shadow-gray-200/60">
      <div className="p-6 md:p-9">

      {/* ── Header + progreso ── */}
      <div className="mb-7 pb-7 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-brand uppercase tracking-[0.15em]">
            Paso {step + 1} de {STEPS.length}
          </span>
          <span className="text-xs font-semibold text-gray-400">{progressPct}%</span>
        </div>

        {/* Puntos de progreso — el actual es una píldora, los completados
            son puntos clicables para regresar, los futuros quedan grises.
            Reemplaza los 6 círculos+conectores+etiquetas de antes, que se
            sentían apretados y recargados para un formulario de 6 pasos. */}
        <div className="flex items-center gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              disabled={i >= step}
              onClick={() => i < step && setStep(i)}
              aria-label={`Ir al paso ${i + 1}: ${s}`}
              aria-current={i === step ? 'step' : undefined}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-9 bg-brand'
                  : i < step
                    ? 'w-1.5 bg-brand/40 hover:bg-brand/70 cursor-pointer'
                    : 'w-1.5 bg-gray-200 cursor-default'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3.5">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-brand-pale flex items-center justify-center">
            <StepIcon size={22} className="text-brand" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-gray-900 leading-tight">{STEPS[step]}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{STEP_SUBTITLES[step]}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Banner de error al intentar avanzar sin completar campos */}
        {stepError && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">Completa los campos marcados</p>
              <p className="text-xs text-red-500 mt-0.5">Revisa los mensajes en rojo antes de continuar</p>
            </div>
          </div>
        )}

        {/* Cada paso se desvanece hacia arriba al entrar — una transición
            sutil en vez de un salto seco de contenido. */}
        <div key={step} className="space-y-4 animate-fade-up">

        {/* Step 0: Tipo y operación */}
        {step === 0 && (
          <>
            <Select label="Tipo de propiedad" options={TIPO_OPTIONS} placeholder="Selecciona..." error={errors.tipo?.message} {...register('tipo')} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Operación</label>
              <div className="grid grid-cols-2 gap-3">
                {['venta', 'renta'].map((op) => (
                  <label key={op} className="cursor-pointer">
                    <input type="radio" value={op} {...register('operacion')} className="sr-only peer" />
                    <div className={`flex items-center justify-center gap-1.5 border-2 rounded-xl p-3 text-center text-sm transition-colors ${watch('operacion') === op ? toggleCls.active : toggleCls.inactive}`}>
                      {op === 'venta' ? <Tag size={14} /> : <Key size={14} />}
                      {op === 'venta' ? 'Venta' : 'Renta'}
                    </div>
                  </label>
                ))}
              </div>
              {errors.operacion && <p className="mt-1 text-xs text-danger">{errors.operacion.message}</p>}
            </div>
          </>
        )}

        {/* Step 1: Detalles */}
        {step === 1 && (
          <>
            <Input label="Precio (MXN)" type="number" placeholder={watch('operacion') === 'renta' ? 'Precio mensual' : 'Precio de venta'} error={errors.precio?.message} {...register('precio', { valueAsNumber: true })} />
            {(tipo === 'terreno' || tipo === 'bodega') && (
              <Input label="m² de terreno" type="number" placeholder="0" {...register('m2Terreno', { valueAsNumber: true })} />
            )}
            {/* Un terreno vacío no tiene m² construidos, recámaras ni
                baños — se piden solo si confirma que ya hay algo
                construido encima (checkbox), en vez de mostrarlos siempre
                "por si acaso" (reporte explícito 2026-08-20). */}
            {tipo === 'terreno' && (
              <label className="flex items-center gap-2 -mt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={terrenoConstruido}
                  onChange={(e) => setTerrenoConstruido(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-2 focus:ring-brand/30"
                />
                <span className="text-xs text-gray-500">Este terreno ya tiene una construcción (casa, bodega, etc.)</span>
              </label>
            )}
            {/* Recámaras no aplica a un tipo comercial (local/oficina/bodega
                no tienen "cuartos") ni a un terreno vacío. Se queda visible
                para terreno solo si el checkbox de arriba confirma que ya
                tiene una construcción encima. */}
            {mostrarCamposConstruccion && (
              tipoConRecamaras ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="m² construidos" type="number" placeholder="0" {...register('m2Construidos', { valueAsNumber: true })} />
                  <Input label="Recámaras" type="number" placeholder="0" {...register('recamaras', { valueAsNumber: true })} />
                </div>
              ) : (
                <Input label="m² construidos" type="number" placeholder="0" {...register('m2Construidos', { valueAsNumber: true })} />
              )
            )}
            {mostrarCamposConstruccion && (
              <Input label="Baños" type="number" placeholder="0" {...register('banos', { valueAsNumber: true })} />
            )}
            {watch('operacion') === 'renta' && (
              <div className="pt-1">
                <p className="text-sm font-medium text-gray-700 mb-1">Servicios incluidos</p>
                <p className="text-xs text-gray-400 mb-3">Toca para seleccionar lo que incluye tu propiedad</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {SERVICIOS_RENTA.map(({ key, label, Icon }) => {
                    const active = servicios.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        title={label}
                        onClick={() => toggleServicio(key)}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${
                          active ? toggleCls.active : toggleCls.inactive
                        }`}
                      >
                        <Icon size={18} />
                        <span className="text-[9px] font-medium leading-tight text-center line-clamp-2">
                          {label.split('/')[0].trim()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 2: Ubicación */}
        {step === 2 && (
          <>
            <Select label="Municipio" options={MUNICIPIO_OPTIONS} placeholder="Selecciona..." error={errors.municipio?.message} {...register('municipio')} />
            <Input label="Colonia" placeholder="Nombre de la colonia" error={errors.colonia?.message} {...register('colonia')} />

            {/* El selector de pin en mapa vive ahora en el paso de Fotos, no
                aquí — ver el comentario grande en ese bloque (step === 4)
                para el motivo: puesto aquí, se llenaba manualmente ANTES de
                llegar a Fotos, dejando muerta la sugerencia automática por
                GPS de la foto (pedido explícito 2026-08-26, "el pin se
                coloca manualmente antes, así que no sirve de nada"). */}

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <Droplets size={14} className="text-gray-400" /> Riesgo de inundación
              </label>

              {/* Badge de detección automática — visible solo en móvil (desktop lo muestra el panel lateral) */}
              <div className="lg:hidden">
                {deteccion ? (
                  <div className={`flex items-start gap-2.5 rounded-xl p-3 mb-3 border text-xs ${
                    deteccion.riesgo === 'alto'  ? 'bg-red-50 border-red-200 text-red-700' :
                    deteccion.riesgo === 'medio' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                    'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}>
                    <Info size={13} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Detectado automáticamente</span>
                      {' — '}Esta colonia está clasificada como zona de riesgo{' '}
                      <span className="font-bold uppercase">{deteccion.riesgo}</span>
                      {' '}según el Atlas de Riesgos Municipal.
                      {deteccion.confianza === 'probable' && (
                        <span className="text-[10px] opacity-70"> · coincidencia parcial</span>
                      )}
                      {fueModificado && (
                        <div className="flex items-start gap-1 mt-1.5 text-orange-600">
                          <ShieldAlert size={11} className="flex-shrink-0 mt-0.5" />
                          <span className="font-semibold">
                            Cambiaste el valor detectado — los interesados pueden ver esta diferencia.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : colonia && colonia.length >= 4 ? (
                  <p className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 mb-3">
                    <Info size={11} className="flex-shrink-0" />
                    No encontramos datos históricos para esta colonia — selecciona manualmente.
                  </p>
                ) : null}
              </div>

              {/* Selector manual */}
              {deteccion ? (
                <p className="text-xs text-gray-400 mb-2">Puedes confirmar o ajustar el nivel detectado:</p>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-2">
                  <ChevronRight size={14} className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">
                    Selecciona el nivel de riesgo de tu zona
                  </p>
                </div>
              )}
              <div className={`grid grid-cols-3 gap-2 transition-all ${!deteccion ? 'p-2 rounded-xl ring-2 ring-amber-200 bg-amber-50/50' : ''}`}>
                {[
                  { val: 'bajo',  label: 'Bajo',  dot: 'bg-green-500',  cls: 'border-green-500 bg-green-50 text-green-700' },
                  { val: 'medio', label: 'Medio', dot: 'bg-amber-500',  cls: 'border-amber-500 bg-amber-50 text-amber-700' },
                  { val: 'alto',  label: 'Alto',  dot: 'bg-red-500',    cls: 'border-red-500 bg-red-50 text-red-700' },
                ].map(({ val, label, dot, cls }) => (
                  <label key={val} className="cursor-pointer">
                    <input type="radio" value={val} {...register('riesgoInundacion')} className="sr-only peer" />
                    <div className={`border-2 rounded-xl p-2.5 text-center text-xs font-semibold transition-all ${FOCUS_RING} ${
                      riesgoActual === val ? cls + ' shadow-sm' : toggleCls.inactive
                    }`}>
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                        {label}
                      </span>
                      {deteccion?.riesgo === val && (
                        <div className="text-[9px] font-medium opacity-60 mt-0.5 leading-none">detectado</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {errors.riesgoInundacion && (
                <p className="mt-1 text-xs text-danger">{errors.riesgoInundacion.message}</p>
              )}
              <p className="mt-2 text-[10px] text-gray-400 leading-relaxed lg:hidden">
                Este dato es público y visible en tu anuncio. La plataforma puede mostrar alertas si el valor difiere de registros oficiales.
              </p>

              {/* Confirmación obligatoria SOLO al bajar el riesgo respecto
                  al detectado (ver esDowngrade arriba) — subir el nivel no
                  la necesita, ser más conservador no es un problema. Más
                  fuerte que el aviso ámbar de arriba (que se queda para
                  cualquier cambio, incluido subir el nivel): esto bloquea
                  avanzar/publicar hasta que se marque, ver goNext()/onSubmit. */}
              {esDowngrade && (
                <label className="flex items-start gap-2.5 mt-2 bg-red-50 border-2 border-red-200 rounded-xl px-3.5 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmaRiesgoBajo}
                    onChange={(e) => setConfirmaRiesgoBajo(e.target.checked)}
                    className="mt-0.5 w-4 h-4 flex-shrink-0 rounded border-red-300 text-red-600 focus:ring-2 focus:ring-red-300"
                  />
                  <span className="text-xs text-red-700 leading-relaxed">
                    Entiendo que el Atlas de Riesgos Municipal clasifica esta zona como <strong className="uppercase">{autoRiesgo}</strong>, y aun así estoy marcando <strong className="uppercase">{riesgoActual}</strong> porque conozco la zona de primera mano.
                  </span>
                </label>
              )}
            </div>

            {camposConError.length > 0 && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {camposConError.length === 1 ? 'Falta corregir este campo:' : 'Faltan corregir estos campos:'}
                  </p>
                  <ul className="text-xs text-red-500 mt-1 list-disc list-inside space-y-0.5">
                    {camposConError.map((campo) => <li key={campo}>{campo}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 3: Descripción */}
        {step === 3 && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="titulo" className="block text-sm font-medium text-gray-700">Título del anuncio</label>
                <button
                  type="button"
                  onClick={generarTitulo}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark bg-brand-pale hover:bg-brand-pale/70 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Tag size={12} /> Generar título automático
                </button>
              </div>
              <Input id="titulo" placeholder="Ej: Casa con alberca en Tabasco 2000" error={errors.titulo?.message} {...register('titulo')} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Descripción</label>
                <button
                  type="button"
                  onClick={generarConIA}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 text-xs font-semibold text-accent-dark hover:text-accent-dark bg-accent-pale hover:bg-accent/25 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {aiLoading ? <Loader2 size={12} className="animate-spin" /> : aiGenerated ? <RefreshCw size={12} /> : <Sparkles size={12} />}
                  {aiLoading ? 'Generando...' : aiGenerated ? 'Generar otra versión' : 'Generar con IA'}
                </button>
              </div>
              <textarea
                {...register('descripcion')}
                rows={5}
                placeholder="Describe la propiedad: características, acabados, vecindario, accesos..."
                className={`w-full rounded-xl border bg-white text-gray-800 placeholder-gray-400 px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none ${errors.descripcion ? 'border-danger' : 'border-gray-200 focus:border-brand'}`}
              />
              {errors.descripcion && <p className="text-xs text-danger mt-1">{errors.descripcion.message}</p>}
              <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                <Sparkles size={12} className="flex-shrink-0" /> La IA genera una descripción base que puedes editar
              </p>
              {frasesSensibles.length > 0 && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mt-2">
                  <ShieldAlert size={12} className="flex-shrink-0 mt-0.5" />
                  Tu descripción incluye lenguaje que podría interpretarse como discriminatorio ({frasesSensibles.join(', ')}). Revísalo — los criterios de exclusión por origen, discapacidad u orientación sexual pueden violar la ley antidiscriminación.
                </p>
              )}
            </div>
          </>
        )}

        {/* Step 4: Fotos */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">Fotos de la propiedad</p>
                <p className="text-xs text-gray-400 mt-0.5">Mínimo 1, máximo {MAX_FOTOS} imágenes reales de la propiedad</p>
              </div>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${fotos.length >= MAX_FOTOS ? 'bg-accent-pale text-accent-dark' : 'bg-gray-100 text-gray-500'}`}>
                {fotos.length} / {MAX_FOTOS}
              </span>
            </div>

            <p className="flex items-start gap-1.5 text-[10px] text-gray-400 leading-relaxed">
              <ShieldAlert size={12} className="flex-shrink-0 mt-0.5" />
              Evita fotos con documentos, objetos de valor visibles o rostros de menores. Asegúrate de tener autorización de cualquier persona que aparezca en tus fotos.
            </p>

            {/* Drop zone */}
            {fotos.length < MAX_FOTOS && (
              <div
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-brand bg-brand-pale/50'
                    : 'border-gray-200 hover:border-brand/40 hover:bg-brand-pale/20'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
                <ImagePlus size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-600">Arrastra fotos aquí</p>
                <p className="text-xs text-gray-400 mt-1">o <span className="text-brand font-semibold">haz clic para seleccionar</span></p>
                <p className="text-xs text-gray-300 mt-2">JPG, PNG · Máximo {MAX_FOTOS - fotos.length} foto{MAX_FOTOS - fotos.length !== 1 ? 's' : ''} más</p>
              </div>
            )}

            {/* Colonia sugerida por el GPS de una foto — nunca se aplica
                sola, ver sugerirPinDesdeFoto()/coloniaCercana() arriba. */}
            {coloniaSugerida && (
              <div className="flex items-center justify-between gap-2 bg-accent-pale border border-accent/20 rounded-xl px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-xs text-accent-dark">
                  <MapPin size={13} className="flex-shrink-0" /> La ubicación de tu foto coincide con la colonia &quot;{coloniaSugerida.label}&quot; — ¿corregimos el campo Colonia?
                </p>
                <div className="flex-shrink-0 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setValue('colonia', coloniaSugerida.label, { shouldValidate: true, shouldDirty: true });
                      setColoniaSugerida(null);
                    }}
                    className="text-xs font-semibold text-accent-dark hover:text-brand-dark whitespace-nowrap"
                  >
                    Corregir
                  </button>
                  <button
                    type="button"
                    onClick={() => setColoniaSugerida(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            {/* Contradicción GPS — la foto trae ubicación real distinta a
                la declarada. Nunca bloquea aquí (eso lo decide el
                backend combinando señales, ver evaluar() arriba); esto
                solo avisa — puede ser un error de tecleo honesto o una
                foto que no es de esta propiedad. */}
            {gpsContradiccion !== null && (
              <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-xs text-amber-700">
                  <ShieldAlert size={13} className="flex-shrink-0" /> La ubicación de una de tus fotos está a {gpsContradiccion.toFixed(0)} km de la colonia que escribiste — revisa que la foto sea de esta propiedad, o que la colonia esté bien escrita.
                </p>
                <button
                  type="button"
                  onClick={() => { setGpsContradiccion(null); gpsContradiccionRef.current = null; }}
                  className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
                >
                  Descartar
                </button>
              </div>
            )}

            {/* Sugerencia de portada — nunca reordena sola, el dueño decide. */}
            {mejorPortadaIdx !== null && (
              <div className="flex items-center justify-between gap-2 bg-brand-pale border border-brand/20 rounded-xl px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-xs text-brand-dark">
                  <Star size={13} className="flex-shrink-0" /> La foto #{mejorPortadaIdx + 1} se ve más nítida y mejor iluminada — ¿la usas como portada?
                </p>
                <button
                  type="button"
                  onClick={() => usarComoPortada(mejorPortadaIdx)}
                  className="flex-shrink-0 text-xs font-semibold text-brand hover:text-brand-dark whitespace-nowrap"
                >
                  Usar como portada
                </button>
              </div>
            )}

            {/* Previews */}
            {fotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {fotos.map((foto, i) => {
                  const analisis = foto.analisis;
                  const pendiente = analisis === 'pendiente';
                  const noApta = analisis !== 'pendiente' && !analisis.apta;
                  const advertencia = analisis !== 'pendiente' && analisis.apta
                    && (!analisis.relacionada || analisis.señalesFraude.length > 0);
                  // "Borrosa" solo llega aquí para tipos exentos del
                  // bloqueo (TIPOS_SIN_BLOQUEO_BORROSA) — para el resto,
                  // addFiles() ya la rechazó antes de agregarla al estado.
                  const calidad = foto.calidad;
                  const calidadMsg = calidad?.borrosa ? 'Foto borrosa'
                    : calidad?.oscura ? 'Foto muy oscura'
                    : calidad?.sobreexpuesta ? 'Foto sobreexpuesta'
                    : null;
                  return (
                    <div key={i} className={`relative group aspect-square rounded-xl overflow-hidden bg-gray-100 ${noApta ? 'ring-2 ring-red-500' : ''}`}>
                      <img src={foto.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      {i === 0 && !noApta && (
                        <div className="absolute top-1.5 left-1.5 bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">
                          Principal
                        </div>
                      )}
                      {calidadMsg && !noApta && (
                        <div
                          className="absolute top-1.5 right-9 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center"
                          title={calidadMsg}
                        >
                          <AlertCircle size={12} />
                        </div>
                      )}
                      {pendiente && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 size={18} className="text-white animate-spin" />
                        </div>
                      )}
                      {noApta && (
                        <div className="absolute inset-0 bg-red-600/85 flex flex-col items-center justify-center text-center px-2 gap-1">
                          <EyeOff size={16} className="text-white" />
                          <p className="text-white text-[10px] font-bold leading-tight">Contenido inapropiado — quítala para publicar</p>
                        </div>
                      )}
                      {advertencia && !noApta && (
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-1 rounded-md leading-tight flex items-center gap-1">
                          <AlertCircle size={11} className="flex-shrink-0" />
                          {!analisis.relacionada ? '¿Es del inmueble?' : 'Posible foto no original'}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className={`absolute top-1.5 right-1.5 w-7 h-7 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all opacity-100 ${noApta ? 'md:opacity-100' : 'md:opacity-0 md:group-hover:opacity-100'}`}
                        aria-label="Eliminar foto"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {sinFotos && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-red-700 text-center bg-red-50 border border-red-200 rounded-xl py-3">
                <AlertCircle size={13} className="flex-shrink-0" /> Agrega al menos 1 foto real de la propiedad para poder publicar
              </p>
            )}

            {fotos.length >= MAX_FOTOS && (
              <p className="text-xs text-accent-dark bg-accent-pale rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Images size={13} /> Límite alcanzado — {MAX_FOTOS} fotos máximo por propiedad
              </p>
            )}

            {/* Selector de pin en mapa — movido aquí desde el paso
                "Ubicación" (pedido explícito 2026-08-26: "se implementó
                colocar el pin automáticamente al subir una foto, pero en el
                formulario el pin se coloca manualmente antes, así que no
                sirve de nada esa función"). Tenía razón: sugerirPinDesdeFoto()
                (ver addFiles más arriba) solo actúa `if (!coords)` — puesto
                en el paso ANTERIOR a Fotos, casi cualquiera terminaba
                tocando el mapa ahí antes de llegar a subir fotos, dejando
                `coords` siempre ya lleno y la sugerencia automática muerta
                en la práctica. Aquí el orden real coincide con el lógico:
                primero fotos (se calcula la sugerencia), después el mapa
                (ya con el pin puesto si hubo GPS válido, editable a mano
                igual que antes). El guardado anti-fraude no se mueve de
                lugar: sigue comparando contra `colonia`/`municipio`, que ya
                se escribieron en el paso anterior y siguen disponibles aquí
                igual. */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Ubicación exacta</label>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Opcional</span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 220 }}>
                <MapPicker
                  value={coords}
                  onChange={(c) => { setCoords(c); setPinDesdeFoto(false); }}
                  center={mapCenter}
                  onRejected={() => toast.error('Ese punto queda fuera de Tabasco — solo se pueden publicar propiedades dentro del estado.')}
                />
              </div>
              {coords ? (
                <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                  <MapPin size={10} className="text-accent flex-shrink-0" />
                  <span className="font-mono">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
                  {pinDesdeFoto && (
                    <span className="text-accent-dark bg-accent-pale px-1.5 py-0.5 rounded-full font-sans font-semibold">
                      Sugerido desde tu foto
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setCoords(null); setPinDesdeFoto(false); }}
                    aria-label="Quitar ubicación seleccionada"
                    className="ml-auto p-1.5 -m-1.5 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1.5">
                  Toca el mapa o arrastra el pin para marcar la propiedad exacta
                </p>
              )}
              {pinLejosDeColonia && (
                <p className="flex items-start gap-1.5 text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-2 mt-2">
                  <Info size={11} className="flex-shrink-0 mt-0.5" />
                  El pin que marcaste está a {distanciaPinColonia!.toFixed(1)} km de &quot;{coloniaVerificada!.label}&quot; — revisa que el punto y la colonia coincidan antes de publicar.
                </p>
              )}
              {coords && (
                <p className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mt-2">
                  <ShieldAlert size={11} className="flex-shrink-0 mt-0.5" />
                  Aunque marques el punto exacto, en el anuncio público solo se mostrará la zona aproximada — a los interesados serios les puedes dar la dirección exacta directamente por WhatsApp.
                </p>
              )}
            </div>

            {/* Amenidades — movido aquí desde el paso "Detalles" (pedido
                explícito 2026-08-22): antes aparecía ANTES de subir fotos,
                así que las que la IA detecta en las fotos (ver
                analizarFoto/addFiles más arriba) casi nunca llegaban a
                tiempo de pre-marcarse — el usuario ya había pasado ese paso
                cuando la sugerencia aparecía. Aquí sí ahorra el trabajo que
                se pensó desde el principio: subes fotos, ves lo que ya se
                marcó solo, ajustas a mano lo que falte. */}
            <div className="pt-1">
              <p className="text-sm font-medium text-gray-700 mb-1">Amenidades</p>
              <p className="text-xs text-gray-400 mb-3">Se pre-marcan solas según lo que se detecta en tus fotos — ajusta lo que haga falta.</p>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {AMENIDADES_OPTIONS.map(({ key, label, Icon }) => {
                  const active = amenidades.includes(label);
                  return (
                    <button
                      key={key}
                      type="button"
                      title={label}
                      onClick={() => toggleAmenidad(label)}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${
                        active ? toggleCls.active : toggleCls.inactive
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-[9px] font-medium leading-tight text-center line-clamp-2">
                        {label.split('/')[0].trim()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sugerencias para la descripción — lugares cercanos y
                amenidades marcadas que todavía no se mencionan en el texto
                (ver landmarksSugeridos/amenidadesSugeridas arriba). Un clic
                las agrega, nunca automático. */}
            {(landmarksSugeridos.length > 0 || amenidadesSugeridas.length > 0) && (
              <div className="rounded-xl border border-brand/20 bg-brand-pale/40 px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-dark mb-2">
                  <Lightbulb size={13} className="flex-shrink-0" /> Menciona esto en tu descripción — así aparece cuando alguien lo busca
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {landmarksSugeridos.map((l) => (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() => agregarMencionADescripcion(`Cerca de ${l.label}.`)}
                      className="text-[11px] font-medium text-brand-dark bg-white border border-brand/30 hover:bg-brand-pale rounded-full px-2.5 py-1 transition-colors"
                    >
                      + Cerca de {l.label}
                    </button>
                  ))}
                  {amenidadesSugeridas.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => agregarMencionADescripcion(`Cuenta con ${a}.`)}
                      className="text-[11px] font-medium text-brand-dark bg-white border border-brand/30 hover:bg-brand-pale rounded-full px-2.5 py-1 transition-colors"
                    >
                      + {a}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Contacto */}
        {step === 5 && (
          <>
            {publicacionBloqueada ? (
              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 border bg-red-50 border-red-300 text-red-800">
                <ShieldX size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">No podemos publicar este anuncio</p>
                  <p className="text-xs mt-1">
                    {fraudCheck?.motivoBloqueo || 'El título y la descripción tienen varias señales que suelen asociarse con publicaciones fraudulentas.'}
                  </p>
                  {/* Deliberadamente NO se listan las señales detectadas aquí
                      (a diferencia del banner ámbar de 'medio' más abajo) —
                      mostrarle a quien publica exactamente qué frase disparó
                      el bloqueo es un mapa de ruta para reescribirla y
                      evadir la misma detección la próxima vez, sin dejar de
                      ser fraudulento. Un mensaje genérico sigue siendo
                      honesto y accionable sin enseñar a esquivar el filtro. */}
                  <p className="text-xs mt-1.5 opacity-80">Revisa que el título y la descripción describan honestamente la propiedad real que estás publicando.</p>
                </div>
              </div>
            ) : fraudCheck && fraudCheck.riesgo === 'medio' && (
              // Nivel 2 del sistema de 3 niveles — se marca, no bloquea.
              // 'alto' ya no llega aquí (lo atrapa publicacionBloqueada
              // arriba); 'bajo' nunca entra (excluido desde antes).
              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 border bg-amber-50 border-amber-200 text-amber-700">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Tu anuncio tiene señales que suelen asociarse con publicaciones fraudulentas</p>
                  <ul className="text-xs mt-1 opacity-80 list-disc list-inside space-y-0.5">
                    {fraudCheck.señales.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                  <p className="text-xs mt-1.5 opacity-70">Antes de continuar, revisa que la información sea correcta — no bloquea tu publicación, pero la ficha se mostrará con un aviso de &quot;En revisión&quot; para que quien la vea verifique con cuidado.</p>
                </div>
              </div>
            )}
            <Input label="Tu nombre" placeholder="Nombre completo" error={errors.nombreContacto?.message} {...register('nombreContacto')} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">¿Cómo quieres que te contacten?</label>
              <p className="text-xs text-gray-400 mb-2">Si no quieres dar tu celular a desconocidos, elige solo correo.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {METODO_CONTACTO_OPTIONS.map((opt) => (
                  <label key={opt.value} className="cursor-pointer">
                    <input type="radio" value={opt.value} {...register('metodoContacto')} className="sr-only peer" />
                    <div className={`flex items-center justify-center border-2 rounded-xl p-2.5 text-center text-sm transition-colors ${
                      watch('metodoContacto') === opt.value ? toggleCls.active : toggleCls.inactive
                    }`}>
                      {opt.label}
                    </div>
                  </label>
                ))}
              </div>
              {errors.metodoContacto && <p className="mt-1 text-xs text-danger">{errors.metodoContacto.message}</p>}
            </div>

            {watch('metodoContacto') !== 'correo' && (
              <Input label="Teléfono / WhatsApp" type="tel" placeholder="993 123 4567" maxLength={12} error={errors.telefonoContacto?.message} {...register('telefonoContacto')} />
            )}
            {/* Informativo, nunca acusatorio — un agente/casero real con
                varias propiedades activas también da un número aquí. Solo
                avisa que este dato se comparte con otras publicaciones. */}
            {contactoReutilizado > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
                <Info size={13} className="flex-shrink-0 mt-0.5" />
                Ya usas este número en {contactoReutilizado} propiedad{contactoReutilizado !== 1 ? 'es' : ''} más — normal si manejas varias, solo confirma que sea correcto.
              </p>
            )}
            {(watch('metodoContacto') === 'correo' || watch('metodoContacto') === 'ambos') && (
              <Input label="Correo electrónico" type="email" placeholder="tu@correo.com" error={errors.emailContacto?.message} {...register('emailContacto')} />
            )}
            <p className="flex items-start gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
              <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" />
              Tu nombre y forma de contacto quedarán visibles de un clic para cualquier persona con sesión iniciada — así es como ya se acostumbra contactar en este mercado (como una lona de &quot;se renta&quot;). Nadie sin cuenta puede verlos.
            </p>

            {/* Oculto para "Solo WhatsApp" — esa elección no guarda correo
                (construirAgenteContacto), y esta casilla depende de tener uno
                para revelar en su lugar (ver AgentCard.tsx). Bug real
                encontrado 2026-08-22: la combinación dejaba el contacto roto
                en silencio. El efecto de arriba ya fuerza el valor a false
                si cambian a WhatsApp después de marcarla. */}
            {watch('metodoContacto') !== 'whatsapp' && (
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="requiereMensajePrimero"
                  {...register('requiereMensajePrimero')}
                  className="mt-0.5 w-4 h-4 flex-shrink-0 rounded border-gray-300 text-brand focus:ring-2 focus:ring-brand/40 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="requiereMensajePrimero" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                  Prefiero que me manden un mensaje antes de ver mi teléfono/WhatsApp — decido yo si respondo y comparto mi número.
                </label>
              </div>
            )}

            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="aceptaTerminos"
                {...register('aceptaTerminos')}
                className="mt-0.5 w-4 h-4 flex-shrink-0 rounded border-gray-300 text-brand focus:ring-2 focus:ring-brand/40 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="aceptaTerminos" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                He leído y acepto los{' '}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTermsModalOpen(true); }}
                  className="text-brand font-semibold underline underline-offset-2 hover:text-brand-dark"
                >
                  Términos y Condiciones
                </button>{' '}
                de Vive Villahermosa, y confirmo que esta publicación no contiene información falsa ni restricciones discriminatorias.
              </label>
            </div>
            {errors.aceptaTerminos && (
              <p className="text-xs text-danger -mt-2">{errors.aceptaTerminos.message}</p>
            )}
          </>
        )}

        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft size={16} /> Atrás
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" variant="primary" className="flex-1" onClick={goNext}>
              Siguiente <ChevronRight size={16} />
            </Button>
          ) : (
            <Button type="submit" variant="primary" className="flex-1" isLoading={isSubmitting}>
              <CheckCircle size={16} /> Publicar propiedad
            </Button>
          )}
        </div>
      </form>
      </div>{/* end content */}
      </div>{/* end card */}

      {/* ── Panel lateral: zona de inundación (solo paso Ubicación) ─────── */}
      {step === 2 && (
        <aside className="hidden lg:block sticky top-24">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
              <Droplets size={12} /> Zona de inundación
            </h3>

            {deteccion ? (
              <p className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5 leading-relaxed">
                <span className="font-semibold">Detectado automáticamente</span>
                {' — '}colonia{' '}
                <span className="italic font-medium">&quot;{colonia}&quot;</span>
                {deteccion.confianza === 'probable' && (
                  <span className="text-[11px] opacity-60"> · coincidencia parcial</span>
                )}
              </p>
            ) : colonia && colonia.length >= 4 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 leading-relaxed">
                  Sin registros para{' '}
                  <span className="font-medium italic">&quot;{colonia}&quot;</span>{' '}
                  en el Atlas de Riesgos.
                </p>
                <div className="flex items-center gap-2 bg-brand-pale border border-brand/25 rounded-xl px-3 py-2.5">
                  <ChevronLeft size={13} className="text-brand flex-shrink-0" />
                  <p className="text-xs font-semibold text-brand">Selecciona el nivel manualmente en el formulario</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 leading-relaxed">
                Escribe el nombre de la colonia para detectar la zona de riesgo automáticamente.
              </p>
            )}

            {fueModificado && (
              <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                <ShieldAlert size={12} className="flex-shrink-0 mt-0.5" />
                <span className="font-semibold">
                  Cambiaste el valor detectado — los interesados pueden ver esta diferencia.
                </span>
              </div>
            )}

            {riesgoActual ? (
              <FloodRiskBadge nivel={riesgoActual} />
            ) : (
              <div className="flex gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
                <Droplets size={22} className="flex-shrink-0 mt-1 text-gray-400" />
                <div className="min-w-0">
                  <p className="font-bold text-xl leading-tight text-gray-500">Sin clasificación</p>
                  <p className="text-sm mt-1 text-gray-500">Selecciona el nivel en el formulario para ver la información de riesgo.</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
      </div>{/* end grid */}

      <TermsModal isOpen={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
    </div>
  );
}
