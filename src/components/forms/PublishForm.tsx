'use client';

import { useState, useRef, useEffect } from 'react';
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
  Tag, Key, Lightbulb, ShieldCheck, Loader2, EyeOff, RefreshCw, TrendingUp,
} from 'lucide-react';
import { SERVICIOS_RENTA } from '@/lib/servicios';
import { detectarLenguajeSensible } from '@/lib/contentModeration';
import { detectarRiesgoInundacion } from '@/lib/zonas-inundacion';
import type { RiesgoInundacion } from '@/lib/zonas-inundacion';
import type { Coords } from './MapPicker';
import { FloodRiskBadge } from '@/components/property/FloodRiskBadge';
import { TermsModal } from './TermsModal';
import { useToast } from '@/context/ToastContext';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { matchColonia, distanciaKm } from '@/lib/colonias';
import { estaEnTabasco } from '@/lib/tabascoBoundary';
import { resizeImageToDataUrl } from '@/lib/imageResize';
import {
  publishSchema, type PublishFormData,
  TIPO_OPTIONS, MUNICIPIO_OPTIONS, MUNICIPIO_CENTERS, METODO_CONTACTO_OPTIONS, construirAgenteContacto,
} from '@/lib/publishSchema';
interface ResultadoImagenIA {
  apta: boolean;
  relacionada: boolean;
  señalesFraude: string[];
  notas: string;
}

type AnalisisFoto = 'pendiente' | ResultadoImagenIA;

async function analizarFoto(file: File): Promise<ResultadoImagenIA> {
  const NEUTRAL: ResultadoImagenIA = { apta: true, relacionada: true, señalesFraude: [], notas: '' };
  try {
    // 512px basta para que el modelo juzgue contenido/relevancia — no hace
    // falta mandar la foto a resolución completa solo para esto.
    const dataUrl = await resizeImageToDataUrl(file, 512);
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
const MAX_FOTOS = 4;
// Debe coincidir con LIMITE_PROPIEDADES_ACTIVAS en el backend
// (properties.service.ts) — el servidor es quien de verdad lo hace cumplir
// (código LIMITE_PROPIEDADES_ALCANZADO), esto solo evita hacer perder el
// tiempo a quien ya topó antes de llenar los 6 pasos del formulario.
const LIMITE_PROPIEDADES = 4;

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

/** Botón "chip" — blanco/marca cuando está activo, gris neutro cuando no. */
const toggleCls = {
  inactive: 'border-gray-200 bg-white text-gray-500 hover:border-brand/40 hover:text-brand hover:bg-brand-pale/30',
  active:   'border-brand bg-brand text-white font-bold shadow-sm',
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
  const [fotos, setFotos]         = useState<{ file: File; preview: string; analisis: AnalisisFoto }[]>([]);
  const [dragOver, setDragOver]   = useState(false);
  const [servicios, setServicios] = useState<string[]>([]);
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
  useEffect(() => {
    let cancelado = false;
    backendFetch<{ propiedades: { estado: string }[] }>('/propiedades/mias')
      .then(({ propiedades }) => {
        if (cancelado) return;
        const activas = propiedades.filter((p) => p.estado === 'activa').length;
        setLimiteAlcanzado(activas >= LIMITE_PROPIEDADES);
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const slots = MAX_FOTOS - fotos.length;
    const toAdd = arr.slice(0, slots).map((file) => ({ file, preview: URL.createObjectURL(file), analisis: 'pendiente' as AnalisisFoto }));
    setFotos((prev) => [...prev, ...toAdd]);

    // Analiza cada foto en paralelo, sin bloquear la UI mientras se agregan
    // — si el usuario ya quitó la foto para cuando responde, el .map() de
    // abajo simplemente no encuentra coincidencia y no hace nada.
    toAdd.forEach((item) => {
      analizarFoto(item.file).then((analisis) => {
        setFotos((prev) => prev.map((f) => (f.file === item.file ? { ...f, analisis } : f)));
      });
    });
  }

  function removePhoto(idx: number) {
    setFotos((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function toggleServicio(key: string) {
    setServicios((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
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
  const coloniaVerificada = colonia ? matchColonia(colonia) : undefined;
  const distanciaPinColonia = coords && coloniaVerificada
    ? distanciaKm(coords.lat, coords.lng, coloniaVerificada.lat, coloniaVerificada.lng)
    : null;
  const pinLejosDeColonia = distanciaPinColonia !== null && distanciaPinColonia > 3;

  // ── Detección automática de riesgo de inundación ───────────────────────────
  const [deteccion, setDeteccion] = useState<DeteccionUI | null>(null);
  const [autoRiesgo, setAutoRiesgo] = useState<string | null>(null);

  function applyDeteccion(d: DeteccionUI | null) {
    setDeteccion(d);
    if (d) {
      setAutoRiesgo(d.riesgo);
      setValue('riesgoInundacion', d.riesgo);
    } else {
      setAutoRiesgo(null);
      setValue('riesgoInundacion', undefined as unknown as 'alto' | 'medio' | 'bajo');
    }
  }

  // Text detection from colony name — GPS coords se guardan con la propiedad
  // pero no se usan para clasificar riesgo hasta tener shapefiles oficiales de IMPLAN.
  useEffect(() => {
    const txt = detectarRiesgoInundacion(colonia ?? '', municipio);
    applyDeteccion(txt ? { ...txt, metodo: 'texto' } : null);
  }, [colonia, municipio]); // eslint-disable-line react-hooks/exhaustive-deps

  const riesgoActual  = watch('riesgoInundacion');
  const fueModificado = autoRiesgo !== null && riesgoActual !== autoRiesgo;

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
      backendFetch<{ riesgo: string; señales: string[]; bloqueado?: boolean; motivoBloqueo?: string }>('/ia/analizar-fraude', {
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
    const { unsubscribe } = watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(() => evaluar(values), 1_500);
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generarConIA() {
    setAiLoading(true);
    try {
      const data = await backendFetch<{ descripcion?: string }>('/ia/generar-anuncio', {
        method: 'POST',
        body: JSON.stringify({
          tipo: watch('tipo'),
          operacion: watch('operacion'),
          colonia: watch('colonia') || 'Villahermosa',
          municipio: watch('municipio') || 'Centro',
          metros: watch('m2Construidos') || 0,
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
  const publicacionBloqueada = fraudCheck?.bloqueado === true;

  const goNext = async () => {
    if (step === 4 && fotoNoApta) {
      toast.error('Quita la foto marcada como inapropiada antes de continuar.');
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
    if (publicacionBloqueada) {
      toast.error('No podemos publicar este anuncio — corrige el título y la descripción antes de continuar.');
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
      setStep(2);
      return;
    }
    // Cada foto se sube por separado a POST /propiedades/fotos (multipart) —
    // el servidor vuelve a analizarla (Gemini) antes de aceptarla y sube a
    // Cloudinary, devolviendo la URL real; `Property.fotos` solo guarda esas
    // URLs, nunca base64. Si una foto falla se omite, igual que antes, en
    // vez de perder toda la publicación por una sola.
    const fotosUrls: string[] = [];
    for (const f of fotos.slice(0, MAX_FOTOS)) {
      try {
        const dataUrl = await resizeImageToDataUrl(f.file, 1280, 'image/jpeg', 0.85);
        const blob = await (await fetch(dataUrl)).blob();
        const body = new FormData();
        body.append('file', blob, f.file.name);
        const { url } = await backendFetch<{ url: string }>('/propiedades/fotos', {
          method: 'POST',
          body,
        });
        fotosUrls.push(url);
      } catch { /* se omite esa foto */ }
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
          amenidades: [],
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

    // El matching contra alertas guardadas y la notificación (correo +
    // panel) ya los dispara el backend al crear la propiedad
    // (AlertaMatchingService, BACKEND.md §3 punto 10) — no hace falta
    // llamar nada aparte desde aquí como antes.

    // Gestionar/editar/pausar/eliminar ya funciona igual para cualquier
    // cuenta (ver OwnerActionsBar.tsx y Navbar.tsx) — antes solo las cuentas
    // en modo Inmobiliaria iban directo al panel real; alguien publicando
    // como particular caía en una página de "gracias" sin ningún enlace de
    // vuelta a su propiedad recién publicada.
    router.push('/dashboard/propiedades');
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
                    <input type="radio" value={op} {...register('operacion')} className="sr-only" />
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
            {/* Antes m² construidos/recámaras/baños se ocultaban por
                completo para "terreno", asumiendo que un terreno siempre
                está vacío — pero un terreno puede venderse con una casa
                ya construida y el resto del lote disponible, así que sí
                necesita poder capturar esos datos. Se dejan visibles para
                todos los tipos; el placeholder "0" y la nota de abajo
                dejan claro que son opcionales cuando no aplica. */}
            {tipo === 'terreno' && (
              <p className="text-xs text-gray-400 -mt-1">
                Si el terreno ya tiene una construcción (ej. una casa, con el resto del lote disponible), indícalo aquí. Si está vacío, déjalo en 0.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input label="m² construidos" type="number" placeholder="0" {...register('m2Construidos', { valueAsNumber: true })} />
              <Input label="Recámaras" type="number" placeholder="0" {...register('recamaras', { valueAsNumber: true })} />
            </div>
            <Input label="Baños" type="number" placeholder="0" {...register('banos', { valueAsNumber: true })} />
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

            {/* Selector de pin en mapa */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Ubicación exacta</label>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Opcional</span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 220 }}>
                <MapPicker
                  value={coords}
                  onChange={setCoords}
                  center={mapCenter}
                  onRejected={() => toast.error('Ese punto queda fuera de Tabasco — solo se pueden publicar propiedades dentro del estado.')}
                />
              </div>
              {coords ? (
                <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                  <MapPin size={10} className="text-accent flex-shrink-0" />
                  <span className="font-mono">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
                  <button
                    type="button"
                    onClick={() => setCoords(null)}
                    className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
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
                  Si aún vives en esta propiedad, considera no marcar el punto exacto — a los interesados serios puedes darles la dirección directamente por WhatsApp. En el anuncio público solo se mostrará la zona aproximada.
                </p>
              )}
            </div>

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
                            Cambiaste el valor detectado — los compradores pueden ver esta diferencia.
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
                    <input type="radio" value={val} {...register('riesgoInundacion')} className="sr-only" />
                    <div className={`border-2 rounded-xl p-2.5 text-center text-xs font-semibold transition-all ${
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
            <Input label="Título del anuncio" placeholder="Ej: Casa con alberca en Tabasco 2000" error={errors.titulo?.message} {...register('titulo')} />
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
                <p className="text-xs text-gray-400 mt-0.5">Máximo {MAX_FOTOS} imágenes · Opcional</p>
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

            {/* Previews */}
            {fotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {fotos.map((foto, i) => {
                  const analisis = foto.analisis;
                  const pendiente = analisis === 'pendiente';
                  const noApta = analisis !== 'pendiente' && !analisis.apta;
                  const advertencia = analisis !== 'pendiente' && analisis.apta
                    && (!analisis.relacionada || analisis.señalesFraude.length > 0);
                  return (
                    <div key={i} className={`relative group aspect-square rounded-xl overflow-hidden bg-gray-100 ${noApta ? 'ring-2 ring-red-500' : ''}`}>
                      <img src={foto.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      {i === 0 && !noApta && (
                        <div className="absolute top-1.5 left-1.5 bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">
                          Principal
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

            {fotos.length === 0 && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-accent-dark text-center bg-accent-pale rounded-xl py-3">
                <Lightbulb size={13} className="flex-shrink-0" /> Las propiedades con fotos reciben más contactos
              </p>
            )}

            {fotos.length >= MAX_FOTOS && (
              <p className="text-xs text-accent-dark bg-accent-pale rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Images size={13} /> Límite alcanzado — {MAX_FOTOS} fotos máximo por propiedad
              </p>
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
                    {fraudCheck?.motivoBloqueo || 'El título y la descripción no parecen describir una propiedad real.'}
                  </p>
                  <p className="text-xs mt-1.5 opacity-80">Corrige el título y la descripción en el paso &quot;Información básica&quot; para poder continuar.</p>
                </div>
              </div>
            ) : fraudCheck && fraudCheck.riesgo !== 'bajo' && (
              <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${
                fraudCheck.riesgo === 'alto'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Tu anuncio tiene señales que suelen asociarse con publicaciones fraudulentas</p>
                  <ul className="text-xs mt-1 opacity-80 list-disc list-inside space-y-0.5">
                    {fraudCheck.señales.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                  {fraudCheck.riesgo === 'alto' ? (
                    <p className="text-xs mt-1.5 opacity-70">
                      Esto no bloquea tu publicación, pero se mostrará con un aviso de &quot;En revisión&quot; en la ficha de la propiedad para que quien la vea verifique con cuidado. Si crees que es un error, revisa que el precio y la descripción sean correctos — el aviso se basa en eso.
                    </p>
                  ) : (
                    <p className="text-xs mt-1.5 opacity-70">Esto no bloquea tu publicación ni la marca — solo revisa que la información sea correcta antes de continuar.</p>
                  )}
                </div>
              </div>
            )}
            <Input label="Tu nombre" placeholder="Nombre completo" error={errors.nombreContacto?.message} {...register('nombreContacto')} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">¿Cómo quieres que te contacten?</label>
              <p className="text-xs text-gray-400 mb-2">Si no quieres dar tu celular a desconocidos, elige solo correo.</p>
              <div className="grid grid-cols-3 gap-2">
                {METODO_CONTACTO_OPTIONS.map((opt) => (
                  <label key={opt.value} className="cursor-pointer">
                    <input type="radio" value={opt.value} {...register('metodoContacto')} className="sr-only" />
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
            {watch('metodoContacto') !== 'telefono' && (
              <Input label="Correo electrónico" type="email" placeholder="tu@correo.com" error={errors.emailContacto?.message} {...register('emailContacto')} />
            )}
            <p className="flex items-start gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
              <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" />
              Tu nombre y forma de contacto quedarán visibles de un clic para cualquier persona con sesión iniciada — así es como ya se acostumbra contactar en este mercado (como una lona de &quot;se renta&quot;). Nadie sin cuenta puede verlos.
            </p>

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
                  Cambiaste el valor detectado — los compradores pueden ver esta diferencia.
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
