'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ChevronRight, Save, MapPin, Info, X, ImagePlus, Loader2, Sparkles, Tag } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button, buttonClasses } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { mapBackendProperty, type BackendPublicProperty } from '@/lib/api';
import {
  publishSchema, type PublishFormData, type MetodoContacto,
  TIPO_OPTIONS, MUNICIPIO_OPTIONS, METODO_CONTACTO_OPTIONS, MAX_FOTOS,
} from '@/lib/publishSchema';
import { AMENIDADES_OPTIONS } from '@/lib/amenidades';
import { SERVICIOS_RENTA } from '@/lib/servicios';
import { distanciaKm } from '@/lib/colonias';
import { estaEnTabasco } from '@/lib/tabascoBoundary';
import { resizeImageToDataUrl, MAX_SOURCE_BYTES } from '@/lib/imageResize';
import { generarTituloAutomatico } from '@/lib/tituloGenerator';
import type { Coords } from '@/components/forms/MapPicker';
import type { Property } from '@/types/property';

// Mismo dynamic import que PublishForm.tsx — Leaflet no puede correr en el
// servidor (usa `window`).
const MapPicker = dynamic(
  () => import('@/components/forms/MapPicker').then((m) => m.MapPicker),
  { ssr: false, loading: () => <div className="h-full rounded-2xl bg-gray-100 animate-pulse" /> },
);

// Pedido explícito 2026-08-30: el pin SÍ se puede corregir después de
// publicar (antes no había forma de arreglar "lo puse mal"), pero acotado
// — no libre. Mover el pin cambia distancias reales en búsquedas "cerca
// de X" (Dos Bocas, colonias, landmarks) y dónde aparece el marcador en
// /mapa; sin este límite, alguien podría arrastrar su propiedad hacia un
// landmark deseado para aparecer en más búsquedas sin haberse mudado de
// verdad. 1km cubre "me equivoqué de cuadra/lado de la calle", no
// "reubicar la propiedad a otra colonia".
const RADIO_MAXIMO_PIN_KM = 1;

const OPERACION_OPTIONS = [
  { value: 'venta', label: 'Venta' },
  { value: 'renta', label: 'Renta' },
];

const RIESGO_OPTIONS = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
] as const;

/** Infiere qué eligió originalmente a partir de qué campos tiene guardados — no hay un `metodoContacto` persistido aparte. */
function inferirMetodoContacto(agente: Property['agente']): MetodoContacto {
  if (agente.tel && agente.email) return 'ambos';
  if (agente.email) return 'correo';
  // whatsapp sin tel = "Solo WhatsApp" (agregado 2026-08-21) — con tel
  // presente ya cae en el 'telefono' de abajo, que sigue guardando ambos.
  if (agente.whatsapp && !agente.tel) return 'whatsapp';
  return 'telefono';
}

export default function EditarPropiedadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  // undefined = todavía resolviendo en el efecto, null = no existe/no es tuya
  const [property, setProperty] = useState<Property | null | undefined>(undefined);

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<PublishFormData>({ resolver: zodResolver(publishSchema) });
  const tipoActual = watch('tipo');

  // Mismo criterio que PublishForm.tsx (auditoría 2026-08-20: "pregunta
  // recámaras y baños, lo cual no aplica" para terreno) — un terreno vacío
  // no tiene m² construidos, recámaras ni baños; solo se piden si ya tenía
  // una construcción encima. Aquí el checkbox arranca marcado si la
  // propiedad guardada ya trae algo de eso, para no perderlo al abrir el
  // formulario de edición.
  const [terrenoConstruido, setTerrenoConstruido] = useState(false);
  useEffect(() => {
    if (property?.tipo === 'terreno') {
      setTerrenoConstruido(!!(property.m2Construidos || property.recamaras || property.banos));
    }
  }, [property]);
  useEffect(() => {
    if (tipoActual !== 'terreno') setTerrenoConstruido(false);
  }, [tipoActual]);
  const mostrarCamposConstruccion = tipoActual !== 'terreno' || terrenoConstruido;
  // Recámaras no aplica a local/oficina/bodega/habitación (no son "cuartos").
  const tipoConRecamaras = mostrarCamposConstruccion && (tipoActual === 'casa' || tipoActual === 'departamento' || tipoActual === 'terreno');
  useEffect(() => {
    if (!mostrarCamposConstruccion) {
      setValue('m2Construidos', 0);
      setValue('banos', 0);
    }
  }, [mostrarCamposConstruccion, setValue]);
  useEffect(() => {
    if (!tipoConRecamaras) setValue('recamaras', 0);
  }, [tipoConRecamaras, setValue]);

  // amenidades no vive en publishSchema (igual que en PublishForm.tsx) —
  // se maneja aparte, por label (Property.amenidades ya guarda strings
  // legibles en datos reales, ver amenidades.ts). Bug real encontrado
  // 2026-08-21: este formulario nunca las mostraba ni las mandaba en el
  // PATCH — editar una propiedad podía perderlas en silencio.
  const [amenidades, setAmenidades] = useState<string[]>([]);
  useEffect(() => {
    if (property) setAmenidades(property.amenidades);
  }, [property]);
  function toggleAmenidad(label: string) {
    setAmenidades((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  }

  // servicios (agua/luz/gas/etc. incluidos, solo renta) tenía el MISMO bug
  // que amenidades tenía antes de su fix del 2026-08-21 — auditoría
  // 2026-08-30: este formulario nunca los mostraba ni los mandaba en el
  // PATCH. No borraba lo que ya había (la clave nunca viajaba), pero el
  // dueño no podía verlos ni cambiarlos desde Editar.
  const [servicios, setServicios] = useState<string[]>([]);
  useEffect(() => {
    if (property) setServicios(property.servicios ?? []);
  }, [property]);
  function toggleServicio(key: string) {
    setServicios((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  }

  // Pin del mapa — auditoría 2026-08-30: antes no existía forma de
  // corregir un pin mal puesto al publicar. `original` nunca cambia
  // (es la referencia fija contra la que se mide el radio permitido);
  // `coords` es lo que se ve/edita en el mapa.
  const [coords, setCoords] = useState<Coords | null>(null);
  const [original, setOriginal] = useState<Coords | null>(null);
  useEffect(() => {
    if (property) {
      setCoords({ lat: property.lat, lng: property.lng });
      setOriginal({ lat: property.lat, lng: property.lng });
    }
  }, [property]);

  function moverPin(c: Coords) {
    if (original) {
      const distancia = distanciaKm(original.lat, original.lng, c.lat, c.lng);
      if (distancia > RADIO_MAXIMO_PIN_KM) {
        toast.error(`Solo puedes mover el pin hasta ${RADIO_MAXIMO_PIN_KM} km desde su ubicación original, para evitar que una propiedad aparezca más cerca de una zona de lo que realmente está. Si de verdad está más lejos, contáctanos.`);
        return;
      }
    }
    setCoords(c);
  }

  // Fotos — auditoría 2026-08-30: Editar no tenía forma de agregar,
  // quitar, ni reemplazar fotos después de publicar. `fotos` guarda URLs
  // ya subidas (existentes + nuevas); a diferencia de PublishForm.tsx no
  // se replica aquí el chequeo de calidad/IA por foto ni la detección de
  // amenidades — son mejoras del momento de publicar, no esenciales para
  // simplemente poder corregir una foto después. El servidor vuelve a
  // analizar cada foto de todos modos (mismo comentario que PublishForm.tsx).
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  useEffect(() => {
    if (property) setFotos(property.fotos);
  }, [property]);

  function quitarFoto(url: string) {
    setFotos((prev) => prev.filter((f) => f !== url));
  }

  async function agregarFotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const espacio = MAX_FOTOS - fotos.length;
    if (espacio <= 0) {
      toast.error(`Ya tienes el máximo de ${MAX_FOTOS} fotos — quita alguna antes de agregar otra.`);
      return;
    }
    const seleccionadas = Array.from(files).slice(0, espacio);
    const sinSobrepeso = seleccionadas.filter((f) => f.size <= MAX_SOURCE_BYTES);
    const pesadas = seleccionadas.length - sinSobrepeso.length;
    if (pesadas > 0) {
      const maxMb = Math.round(MAX_SOURCE_BYTES / (1024 * 1024));
      toast.error(`${pesadas} foto${pesadas !== 1 ? 's' : ''} ${pesadas !== 1 ? 'pesan' : 'pesa'} demasiado (máx. ${maxMb}MB) y no se ${pesadas !== 1 ? 'agregaron' : 'agregó'}.`);
    }
    if (sinSobrepeso.length === 0) return;

    setSubiendoFoto(true);
    const resultados = await Promise.allSettled(
      sinSobrepeso.map(async (file) => {
        // Mismo ajuste que PublishForm.tsx (2026-08-22, límite real
        // confirmado con backend: 8MB por archivo en /propiedades/fotos,
        // sin compresión de su lado).
        const dataUrl = await resizeImageToDataUrl(file, 1920, 'image/jpeg', 0.92);
        const blob = await (await fetch(dataUrl)).blob();
        const body = new FormData();
        body.append('file', blob, file.name);
        const { url } = await backendFetch<{ url: string }>('/propiedades/fotos', { method: 'POST', body });
        return url;
      }),
    );
    const nuevasUrls = resultados
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value);
    const fallidas = resultados.length - nuevasUrls.length;
    if (fallidas > 0) {
      toast.error(`${fallidas} foto${fallidas !== 1 ? 's' : ''} no se ${fallidas !== 1 ? 'pudieron' : 'pudo'} subir.`);
    }
    if (nuevasUrls.length > 0) setFotos((prev) => [...prev, ...nuevasUrls]);
    setSubiendoFoto(false);
  }

  // Título/descripción con IA — auditoría 2026-08-30: ambos existían en
  // PublishForm.tsx pero no en Editar. El título es una plantilla
  // determinista (sin llamada de red, generarTituloAutomatico), casi
  // gratis de agregar; la descripción sí llama al backend
  // (/ia/generar-anuncio), mismo endpoint y mismo fix de "metros" que
  // PublishForm.tsx (2026-08-21: el backend rechaza metros=0).
  const [aiLoading, setAiLoading] = useState(false);
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
  async function generarConIA() {
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
      if (data.descripcion) setValue('descripcion', data.descripcion);
      else throw new Error('no description returned');
    } catch {
      toast.error('No se pudo generar la descripción. Intenta de nuevo o escríbela tú mismo.');
    } finally {
      setAiLoading(false);
    }
  }

  // GET /propiedades/:id con sesión (backendFetch manda la cookie sola)
  // devuelve la vista de dueño si el id es tuyo — 403/404 si no.
  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    backendFetch<BackendPublicProperty>(`/propiedades/${id}`)
      .then((bp) => { if (!cancelado) setProperty(mapBackendProperty(bp)); })
      .catch(() => { if (!cancelado) setProperty(null); });
    return () => { cancelado = true; };
  }, [id]);

  useEffect(() => {
    if (!property) return;
    reset({
      tipo: property.tipo,
      operacion: property.operacion,
      precio: property.precio,
      m2Construidos: property.m2Construidos,
      m2Terreno: property.m2Terreno,
      recamaras: property.recamaras,
      banos: property.banos,
      municipio: property.municipio,
      colonia: property.colonia,
      titulo: property.titulo,
      descripcion: property.descripcion,
      riesgoInundacion: property.riesgoInundacion,
      nombreContacto: property.agente.nombre,
      metodoContacto: inferirMetodoContacto(property.agente),
      // Auditoría 2026-08-30: antes ausente del todo — una vez publicada,
      // no había forma de activar/desactivar "mensaje primero". Mismo
      // campo que PublishForm.tsx, mismo default (false = revelado
      // instantáneo) cuando la propiedad no lo trae.
      requiereMensajePrimero: property.requiereMensajePrimero ?? false,
      telefonoContacto: property.agente.tel,
      emailContacto: property.agente.email,
      // Ya se aceptaron los Términos al publicar por primera vez — este
      // formulario de edición no los vuelve a pedir, pero el schema
      // compartido con PublishForm los sigue requiriendo para validar.
      aceptaTerminos: true,
    });
  }, [property, reset]);

  // Mismo criterio que PublishForm.tsx: "Solo WhatsApp" no guarda correo
  // (construirAgenteContacto/el mapeo de abajo), y "mensaje primero"
  // depende de tener uno para revelar en su lugar (AgentCard.tsx) — sin
  // esto, cambiar a "Solo WhatsApp" con la casilla ya marcada dejaría el
  // contacto roto en silencio, el mismo bug real que ya se corrigió ahí.
  const metodoContactoActual = watch('metodoContacto');
  useEffect(() => {
    if (metodoContactoActual === 'whatsapp') setValue('requiereMensajePrimero', false);
  }, [metodoContactoActual, setValue]);

  async function onSubmit(data: PublishFormData) {
    if (!property) return;
    // Última validación antes de persistir — mismo criterio que
    // PublishForm.tsx: MapPicker ya rechaza clics/arrastres fuera de
    // Tabasco y moverPin() ya acota a RADIO_MAXIMO_PIN_KM, pero esta es la
    // comprobación real, nunca confiar en que el navegador ya lo hizo.
    if (coords && !estaEnTabasco(coords.lat, coords.lng)) {
      toast.error('El punto marcado en el mapa queda fuera de Tabasco.');
      return;
    }
    try {
      await backendFetch(`/propiedades/${property.id}`, {
        method: 'PATCH',
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
          municipio: data.municipio,
          colonia: data.colonia,
          riesgoInundacion: data.riesgoInundacion,
          amenidades,
          servicios,
          fotos,
          // Auditoría 2026-08-30: antes este formulario no tenía MapPicker,
          // así que nunca había una coordenada nueva que ofrecer — el pin
          // quedaba fijo para siempre desde que se publicaba, sin forma de
          // corregir un error. `coords` ya viene acotado a
          // RADIO_MAXIMO_PIN_KM del original (ver moverPin arriba), así que
          // esto nunca manda una reubicación grande sin querer.
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
          // Se recalcula del municipio actual en cada guardado — nunca es
          // una elección manual (mismo criterio que PublishForm.tsx). Sin
          // esto, cambiar el municipio de o hacia Paraíso vía Editar dejaba
          // el flag desactualizado — una propiedad que ya no está en
          // Paraíso seguía apareciendo en el filtro "cerca de Dos Bocas",
          // o viceversa. Auditoría 2026-08-30.
          cercaDosoBocas: data.municipio === 'Paraíso',
          // `data.requiereMensajePrimero` directo, NUNCA `|| undefined` —
          // a diferencia de PublishForm.tsx (donde `undefined` en la
          // creación simplemente omite el default false), aquí PATCH
          // necesita el booleano real para poder APAGARLO: si alguien
          // desmarca la casilla, `false || undefined` mandaría `undefined`,
          // la clave se omitiría, y (mismo criterio ya documentado arriba
          // para agenteTel/agenteEmail) omitir no borra el valor anterior
          // — quedaría atorado en `true` para siempre.
          requiereMensajePrimero: !!data.requiereMensajePrimero,
          agenteNombre: data.nombreContacto,
          // A diferencia de PublishForm.tsx (construirAgenteContacto), aquí
          // sí hace falta mandar explícitamente `null` para el campo que ya
          // no aplica — si cambiaste de "Ambos" a "Solo correo", omitir la
          // clave (undefined) no la borraría del lado del servidor.
          // "Solo WhatsApp" (agregado 2026-08-21) nunca manda agenteTel —
          // así AgentCard.tsx no ofrece un botón de "Llamar" a quien pidió
          // explícitamente que solo le escriban.
          agenteTel: (data.metodoContacto === 'telefono' || data.metodoContacto === 'ambos') ? data.telefonoContacto : null,
          agenteEmail: (data.metodoContacto === 'correo' || data.metodoContacto === 'ambos') ? data.emailContacto : null,
          agenteWhatsapp: data.metodoContacto !== 'correo' ? data.telefonoContacto : null,
        }),
      });
      toast.success('Propiedad actualizada.');
      router.push('/dashboard/propiedades');
    } catch (err) {
      toast.error(err instanceof BackendApiError ? err.message : 'No se pudo actualizar la propiedad.');
    }
  }

  if (property === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-[520px] rounded-3xl animate-shimmer" />
      </div>
    );
  }

  if (property === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-gray-500 mb-4">No encontramos esta propiedad en tu panel.</p>
        <Link href="/dashboard/propiedades" className="text-brand font-semibold hover:text-brand-dark">
          Volver a mis propiedades
        </Link>
      </div>
    );
  }

  const riesgoActual = watch('riesgoInundacion');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <nav className="flex items-center gap-1 text-xs text-gray-400 mb-4 flex-wrap">
        <Link href="/dashboard" className="hover:text-brand transition-colors">Panel</Link>
        <ChevronRight size={12} />
        <Link href="/dashboard/propiedades" className="hover:text-brand transition-colors">Mis propiedades</Link>
        <ChevronRight size={12} />
        <span className="text-gray-600 font-medium truncate max-w-[200px]">Editar</span>
      </nav>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/propiedades" className="text-gray-400 hover:text-brand transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-gray-900">Editar propiedad</h1>
          <p className="text-sm text-gray-500 truncate">{property.titulo}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 md:p-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo de propiedad" options={TIPO_OPTIONS} error={errors.tipo?.message} {...register('tipo')} />
          <Select label="Operación" options={OPERACION_OPTIONS} error={errors.operacion?.message} {...register('operacion')} />
        </div>

        <Input label="Precio (MXN)" type="number" error={errors.precio?.message} {...register('precio', { valueAsNumber: true })} />

        {/* "m² de terreno" para terreno/bodega, igual que en el formulario
            de publicar. */}
        {(tipoActual === 'terreno' || tipoActual === 'bodega') && (
          <Input label="m² de terreno" type="number" {...register('m2Terreno', { valueAsNumber: true })} />
        )}
        {/* Un terreno vacío no tiene m² construidos, recámaras ni baños —
            se piden solo si confirma que ya hay algo construido encima. */}
        {tipoActual === 'terreno' && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={terrenoConstruido}
              onChange={(e) => setTerrenoConstruido(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-2 focus:ring-brand/30"
            />
            <span className="text-xs text-gray-500">Este terreno ya tiene una construcción (casa, bodega, etc.)</span>
          </label>
        )}
        {/* Recámaras no aplica a local/oficina/bodega/habitación (no son
            "cuartos"), ni a un terreno vacío. */}
        {mostrarCamposConstruccion && (
          tipoConRecamaras ? (
            <div className="grid grid-cols-2 gap-3">
              <Input label="m² construidos" type="number" {...register('m2Construidos', { valueAsNumber: true })} />
              <Input label="Recámaras" type="number" {...register('recamaras', { valueAsNumber: true })} />
            </div>
          ) : (
            <Input label="m² construidos" type="number" {...register('m2Construidos', { valueAsNumber: true })} />
          )
        )}
        {mostrarCamposConstruccion && (
          <Input label="Baños" type="number" {...register('banos', { valueAsNumber: true })} />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amenidades</label>
          <p className="text-xs text-gray-400 mb-3">Toca para seleccionar las características de tu propiedad</p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {AMENIDADES_OPTIONS.map(({ key, label, Icon }) => {
              const active = amenidades.includes(label);
              return (
                <button
                  key={key}
                  type="button"
                  title={label}
                  onClick={() => toggleAmenidad(label)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-colors ${
                    active ? 'border-brand bg-brand-pale text-brand' : 'border-gray-200 text-gray-500 hover:border-brand/40'
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

        {watch('operacion') === 'renta' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Servicios incluidos</label>
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
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-colors ${
                      active ? 'border-brand bg-brand-pale text-brand' : 'border-gray-200 text-gray-500 hover:border-brand/40'
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

        <div className="grid grid-cols-2 gap-3">
          <Select label="Municipio" options={MUNICIPIO_OPTIONS} error={errors.municipio?.message} {...register('municipio')} />
          <Input label="Colonia" error={errors.colonia?.message} {...register('colonia')} />
        </div>

        {/* Fotos — auditoría 2026-08-30, ver agregarFotos()/quitarFoto()
            arriba para el porqué de no replicar el chequeo de calidad/IA
            completo de PublishForm.tsx aquí. */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Fotos</label>
            <span className="text-xs text-gray-400">{fotos.length} / {MAX_FOTOS}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {fotos.map((url) => (
              <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => quitarFoto(url)}
                  aria-label="Quitar foto"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {fotos.length < MAX_FOTOS && (
              <label className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-gray-400 transition-colors ${
                subiendoFoto ? 'opacity-60' : 'cursor-pointer hover:border-brand/40 hover:text-brand'
              }`}>
                {subiendoFoto ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                <span className="text-[10px] font-medium">{subiendoFoto ? 'Subiendo...' : 'Agregar'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={subiendoFoto}
                  onChange={(e) => { void agregarFotos(e.target.files); e.target.value = ''; }}
                  className="sr-only"
                />
              </label>
            )}
          </div>
        </div>

        {/* Pin del mapa — acotado a RADIO_MAXIMO_PIN_KM del punto original,
            ver moverPin() arriba y su comentario para el porqué. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación exacta</label>
          <p className="text-xs text-gray-400 mb-2">
            Solo puedes mover el pin hasta {RADIO_MAXIMO_PIN_KM} km desde su ubicación original, para evitar que una propiedad aparezca más cerca de una zona de lo que realmente está.
          </p>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 220 }}>
            {coords && (
              <MapPicker
                value={coords}
                onChange={moverPin}
                center={[coords.lat, coords.lng]}
                onRejected={() => toast.error('Ese punto queda fuera de Tabasco — solo se pueden publicar propiedades dentro del estado.')}
              />
            )}
          </div>
          {coords && (
            <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
              <MapPin size={10} className="text-accent flex-shrink-0" />
              <span className="font-mono">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
              {original && (coords.lat !== original.lat || coords.lng !== original.lng) && (
                <button
                  type="button"
                  onClick={() => setCoords(original)}
                  aria-label="Deshacer, volver a la ubicación original"
                  className="ml-auto p-1.5 -m-1.5 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <X size={11} />
                </button>
              )}
            </p>
          )}
          {original && coords && distanciaKm(original.lat, original.lng, coords.lat, coords.lng) > 0.05 && (
            <p className="flex items-start gap-1.5 text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-2 mt-2">
              <Info size={11} className="flex-shrink-0 mt-0.5" />
              Moviste el pin {distanciaKm(original.lat, original.lng, coords.lat, coords.lng).toFixed(2)} km de su ubicación original.
            </p>
          )}
        </div>

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
          <Input id="titulo" error={errors.titulo?.message} {...register('titulo')} />
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
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiLoading ? 'Generando...' : 'Generar con IA'}
            </button>
          </div>
          <textarea
            rows={5}
            {...register('descripcion')}
            className={`w-full rounded-xl border bg-white text-gray-800 px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none ${errors.descripcion ? 'border-danger' : 'border-gray-200 focus:border-brand'}`}
          />
          {errors.descripcion && <p className="text-xs text-danger mt-1">{errors.descripcion.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Riesgo de inundación</label>
          <div className="grid grid-cols-3 gap-2">
            {RIESGO_OPTIONS.map(({ value, label }) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" value={value} {...register('riesgoInundacion')} className="sr-only peer" />
                <div className={`border-2 rounded-xl p-2.5 text-center text-xs font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 ${
                  riesgoActual === value ? 'border-brand bg-brand-pale text-brand' : 'border-gray-200 text-gray-500 hover:border-brand/40'
                }`}>
                  {label}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-1 border-t border-gray-100" />
        <Input label="Nombre de contacto" error={errors.nombreContacto?.message} {...register('nombreContacto')} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">¿Cómo quieres que te contacten?</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {METODO_CONTACTO_OPTIONS.map((opt) => (
              <label key={opt.value} className="cursor-pointer">
                <input type="radio" value={opt.value} {...register('metodoContacto')} className="sr-only peer" />
                <div className={`border-2 rounded-xl p-2.5 text-center text-sm font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 ${
                  watch('metodoContacto') === opt.value ? 'border-brand bg-brand-pale text-brand' : 'border-gray-200 text-gray-500 hover:border-brand/40'
                }`}>
                  {opt.label}
                </div>
              </label>
            ))}
          </div>
          {errors.metodoContacto && <p className="mt-1 text-xs text-danger">{errors.metodoContacto.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {watch('metodoContacto') !== 'correo' && (
            <Input label="Teléfono / WhatsApp" error={errors.telefonoContacto?.message} {...register('telefonoContacto')} />
          )}
          {(watch('metodoContacto') === 'correo' || watch('metodoContacto') === 'ambos') && (
            <Input label="Correo electrónico" error={errors.emailContacto?.message} {...register('emailContacto')} />
          )}
        </div>

        {/* Oculto para "Solo WhatsApp" — mismo motivo que PublishForm.tsx:
            esa elección no guarda correo, y esta casilla depende de tener
            uno para revelar en su lugar. Auditoría 2026-08-30: antes esta
            opción ni siquiera existía en Editar, una vez publicada la
            propiedad quedaba fija para siempre. */}
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

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/propiedades" className={buttonClasses('outline', 'md', 'flex-1 justify-center')}>
            Cancelar
          </Link>
          <Button type="submit" variant="primary" isLoading={isSubmitting} className="flex-1 justify-center">
            <Save size={16} /> Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
