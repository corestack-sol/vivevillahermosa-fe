'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ChevronRight, ChevronDown, Save, MapPin, Info, X, ImagePlus, Loader2, Sparkles, Tag } from 'lucide-react';
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
import { distanciaKm, matchColonia, precargarColoniasDescubiertas } from '@/lib/colonias';
import { detectarRiesgoInundacion } from '@/lib/zonas-inundacion';
import { ColoniaAutocomplete } from '@/components/forms/ColoniaAutocomplete';
import { dentroDeRadioPermitido, RADIO_MAXIMO_PIN_KM } from '@/lib/mapPin';
import { estaEnTabasco } from '@/lib/tabascoBoundary';
import { resizeImageToDataUrl, MAX_SOURCE_BYTES } from '@/lib/imageResize';
import { generarTituloAutomatico } from '@/lib/tituloGenerator';
import { formatTelefonoInput } from '@/lib/phone';
import type { Coords } from '@/components/forms/MapPicker';
import type { Property } from '@/types/property';

// Mismo dynamic import que PublishForm.tsx — Leaflet no puede correr en el
// servidor (usa `window`).
const MapPicker = dynamic(
  () => import('@/components/forms/MapPicker').then((m) => m.MapPicker),
  { ssr: false, loading: () => <div className="h-full rounded-2xl bg-gray-100 animate-pulse" /> },
);

const OPERACION_OPTIONS = [
  { value: 'venta', label: 'Venta' },
  { value: 'renta', label: 'Renta' },
];

const RIESGO_OPTIONS = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
] as const;

/**
 * Infiere qué eligió originalmente a partir de qué campos tiene guardados
 * — no hay un `metodoContacto` persistido aparte. La opción "Teléfono"
 * (llamada real) se quitó del formulario 2026-09-07 — una propiedad vieja
 * que ya tenía `tel` guardado (sin correo) migra a "Solo WhatsApp" al
 * editarla, que es la opción más cercana que sigue existiendo (esas
 * propiedades ya guardaban el mismo número también en `whatsapp`).
 */
function inferirMetodoContacto(agente: Property['agente']): MetodoContacto {
  // Bug real reportado 2026-09-11: `agenteTel` se guarda SIEMPRE null desde
  // que se quitó la opción "Teléfono" (2026-09-07, ver comentario en
  // onSubmit más abajo) — revisar `agente.tel` aquí nunca era cierto para
  // ninguna propiedad guardada después de esa fecha, así que "Ambos" nunca
  // se inferían y se mostraba "Solo correo" aunque también tuviera
  // WhatsApp. El dato real vive en `agente.whatsapp`; `agente.tel` se deja
  // como respaldo solo por si alguna propiedad muy vieja aún no migró.
  const tieneWhatsapp = !!(agente.whatsapp || agente.tel);
  if (tieneWhatsapp && agente.email) return 'ambos';
  if (agente.email) return 'correo';
  return 'whatsapp';
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
  const coloniaActual = watch('colonia');
  const municipioActual = watch('municipio');

  // Catálogo de colonias descubiertas dinámicamente (mismo criterio que
  // PublishForm.tsx) — sin esto, matchColonia solo conoce las 70 colonias
  // del catálogo estático hasta que otra pantalla (/propiedades, /mapa)
  // ya lo haya precargado en la misma sesión.
  const [coloniasReady, setColoniasReady] = useState(false);
  useEffect(() => { precargarColoniasDescubiertas().then(() => setColoniasReady(true)); }, []);

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

  // Amenidades/servicios retráctiles — pedido explícito 2026-09-11:
  // colapsados por defecto, solo título + badges de lo ya seleccionado;
  // el picker completo (grid de botones) se abre a demanda en vez de
  // ocupar toda la pantalla siempre.
  const [amenidadesAbiertas, setAmenidadesAbiertas] = useState(false);
  const [serviciosAbiertos, setServiciosAbiertos] = useState(false);

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

  // Bug real reportado 2026-09-09: MapPicker ya rechaza (y ahora también
  // regresa visualmente, ver MapPicker.tsx) cualquier punto fuera del
  // radio permitido ANTES de llamar a onChange — moverPin ya no necesita
  // volver a validar, solo aplicar lo que ya se aceptó.
  function moverPin(c: Coords) {
    setCoords(c);
  }

  // Aviso (no bloqueante) si el texto de "colonia" no coincide con dónde
  // está el pin — antes no se indicaba ni corregía nada (bug real
  // reportado 2026-09-09). A diferencia de PublishForm.tsx (donde el pin
  // SÍ se re-coloca automáticamente según la colonia, ver
  // coordsAutoDesdeColonia en mapPin.ts), aquí el pin está anclado a
  // RADIO_MAXIMO_PIN_KM de la ubicación original — si el texto no
  // coincide, lo más probable es que el texto tenga el error, no el pin
  // (que no se puede mover lo suficiente para "perseguir" una colonia
  // lejana), así que solo se avisa, nunca se mueve el pin solo.
  const coloniaVerificada = useMemo(
    () => (coloniaActual ? matchColonia(coloniaActual, municipioActual) : undefined),
    [coloniaActual, municipioActual, coloniasReady], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const distanciaPinColonia = coords && coloniaVerificada
    ? distanciaKm(coords.lat, coords.lng, coloniaVerificada.lat, coloniaVerificada.lng)
    : null;
  const pinLejosDeColonia = distanciaPinColonia !== null && distanciaPinColonia > 3;

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

  // Pedido explícito 2026-08-31: "nunca debe haber propiedades sin fotos
  // reales" — sin este candado, alguien podía publicar con 1 foto (ya
  // exigida en PublishForm.tsx) y después borrarla aquí, dejando la
  // propiedad publicada sin ninguna.
  function quitarFoto(url: string) {
    if (fotos.length <= 1) {
      toast.error('Tu propiedad necesita al menos 1 foto — agrega otra antes de quitar esta.');
      return;
    }
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
      // Mismo bug que inferirMetodoContacto arriba: `agente.tel` está
      // siempre vacío desde 2026-09-07, el número real vive en
      // `agente.whatsapp`. Sin este fix el campo WhatsApp aparecía vacío
      // al editar, aunque la propiedad sí tuviera un número guardado.
      telefonoContacto: property.agente.whatsapp || property.agente.tel,
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
    // Última validación antes de persistir — MapPicker ya rechaza clics/
    // arrastres fuera de Tabasco o fuera del radio permitido, pero esta es
    // la comprobación real, nunca confiar en que el navegador ya lo hizo
    // (bug real reportado 2026-09-09: antes solo se re-validaba Tabasco
    // aquí, el radio de 1km no tenía este mismo respaldo).
    if (coords && !estaEnTabasco(coords.lat, coords.lng)) {
      toast.error('El punto marcado en el mapa queda fuera de Tabasco.');
      return;
    }
    if (coords && original && !dentroDeRadioPermitido(original, coords)) {
      toast.error(`El punto marcado queda a más de ${RADIO_MAXIMO_PIN_KM} km de la ubicación original.`);
      return;
    }
    // Defensa en profundidad — quitarFoto() ya no deja bajar de 1, pero
    // esta es la comprobación real antes de guardar, mismo criterio que el
    // resto de este archivo.
    if (fotos.length === 0) {
      toast.error('Tu propiedad necesita al menos 1 foto real antes de guardar.');
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
          // Contrato 2026-09-11 (docs/BACKEND-FUENTE-RIESGO-INUNDACION-11092026.md):
          // el backend deriva `riesgoInundacionFuente` comparando esto contra
          // `riesgoInundacion` — se recalcula de la colonia/municipio ACTUALES
          // del formulario en cada guardado, nunca del valor que la persona
          // eligió a mano en los radios de arriba.
          riesgoInundacionDetectado: detectarRiesgoInundacion(data.colonia ?? '', data.municipio)?.riesgo ?? null,
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
          // agenteTel siempre null — la opción "Teléfono" (llamada real) se
          // quitó del todo 2026-09-07, ningún método del formulario la
          // vuelve a escribir. Si esta propiedad ya tenía `agenteTel` de
          // antes, guardar aquí lo borra (comportamiento correcto: editar
          // migra a las 3 opciones vigentes, ver inferirMetodoContacto).
          agenteTel: null,
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
          <button
            type="button"
            onClick={() => setAmenidadesAbiertas((v) => !v)}
            aria-expanded={amenidadesAbiertas}
            className="w-full flex items-center justify-between mb-1"
          >
            <span className="text-sm font-medium text-gray-700">Amenidades</span>
            <ChevronDown size={16} className={`pointer-events-none text-gray-400 transition-transform ${amenidadesAbiertas ? 'rotate-180' : ''}`} />
          </button>
          {amenidadesAbiertas ? (
            <>
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
            </>
          ) : amenidades.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {amenidades.map((a) => (
                <span key={a} className="text-xs font-medium text-brand bg-brand-pale px-2.5 py-1 rounded-full">{a}</span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Sin amenidades seleccionadas</p>
          )}
        </div>

        {watch('operacion') === 'renta' && (
          <div>
            <button
              type="button"
              onClick={() => setServiciosAbiertos((v) => !v)}
              aria-expanded={serviciosAbiertos}
              className="w-full flex items-center justify-between mb-1"
            >
              <span className="text-sm font-medium text-gray-700">Servicios incluidos</span>
              <ChevronDown size={16} className={`pointer-events-none text-gray-400 transition-transform ${serviciosAbiertos ? 'rotate-180' : ''}`} />
            </button>
            {serviciosAbiertos ? (
              <>
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
              </>
            ) : servicios.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {servicios.map((s) => {
                  const opt = SERVICIOS_RENTA.find((o) => o.key === s);
                  return (
                    <span key={s} className="text-xs font-medium text-brand bg-brand-pale px-2.5 py-1 rounded-full">{opt?.label ?? s}</span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sin servicios seleccionados</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select label="Municipio" options={MUNICIPIO_OPTIONS} error={errors.municipio?.message} {...register('municipio')} />
          <ColoniaAutocomplete
            label="Colonia"
            error={errors.colonia?.message}
            value={coloniaActual ?? ''}
            municipio={municipioActual}
            onChange={(texto) => setValue('colonia', texto, { shouldValidate: true, shouldDirty: true })}
          />
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

        {/* Pin del mapa — acotado a RADIO_MAXIMO_PIN_KM del punto original.
            MapPicker ya rechaza (y regresa visualmente) cualquier punto
            fuera de ese radio antes de llamar a onChange, ver
            MapPicker.tsx y mapPin.ts. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación exacta</label>
          <p className="text-xs text-gray-400 mb-2">
            El pin solo se puede mover hasta {RADIO_MAXIMO_PIN_KM} km del punto donde publicaste, para que la distancia mostrada a cada zona sea siempre real, no exagerada. ¿De verdad se mudó más lejos? Contáctanos.
          </p>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 220 }}>
            {coords && (
              <MapPicker
                value={coords}
                onChange={moverPin}
                center={[coords.lat, coords.lng]}
                esValido={(c) => dentroDeRadioPermitido(original, c)}
                onRejected={(c) => {
                  if (!estaEnTabasco(c.lat, c.lng)) {
                    toast.error('Ese punto queda fuera de Tabasco — solo se pueden publicar propiedades dentro del estado.');
                  } else {
                    toast.error(`Ese punto queda a más de ${RADIO_MAXIMO_PIN_KM} km de donde publicaste originalmente. Si tu propiedad de verdad está más lejos, contáctanos para corregirlo.`);
                  }
                }}
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
          {/* Bug real reportado 2026-09-09: escribir una colonia que no
              coincide con dónde está el pin no indicaba ni corregía nada.
              El pin no se mueve solo aquí (está anclado, ver comentario de
              moverPin arriba) — se avisa para que la persona corrija el
              TEXTO si tiene un error de tecleo. */}
          {pinLejosDeColonia && (
            <p className="flex items-start gap-1.5 text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-2 mt-2">
              <Info size={11} className="flex-shrink-0 mt-0.5" />
              El pin está a {distanciaPinColonia!.toFixed(1)} km de &quot;{coloniaVerificada!.label}&quot; — revisa que la colonia escrita sea la correcta.
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Historial de inundación</label>
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
            // Formato en vivo "993 123 4567" — pedido explícito 2026-09-08
            // tras un caso real de typo (9→6, teclas adyacentes) que se
            // coló sin que nadie lo notara en 10 dígitos corridos. Mismo
            // criterio que PublishForm.tsx, ver formatTelefonoInput() en
            // src/lib/phone.ts.
            <Input
              label="WhatsApp"
              type="tel"
              inputMode="numeric"
              placeholder="993 123 4567"
              maxLength={12}
              error={errors.telefonoContacto?.message}
              {...register('telefonoContacto')}
              onChange={(e) => setValue('telefonoContacto', formatTelefonoInput(e.target.value), { shouldValidate: true })}
            />
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
