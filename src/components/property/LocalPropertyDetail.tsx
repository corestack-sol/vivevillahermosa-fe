'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import type { Property } from '@/types/property';
import { obtenerPropiedadLocalPorId, PROPIEDADES_LOCALES_EVENT } from '@/lib/propiedadesLocales';
import { ESTADO_OVERRIDE_EVENT } from '@/lib/estadoOverrides';
import { getLandmark, distanciaKm, distanciaMinimaACategoria, CATEGORIAS_GENERICAS } from '@/lib/landmarks';
import { getColoniaByKey, precargarColoniasDescubiertas } from '@/lib/colonias';
import { PropertyDetailView, type PropertyDetailExtras } from '@/components/property/PropertyDetailView';
import { Loader2 } from 'lucide-react';

interface Props {
  id: string;
  cerca?: string;
  cercaTipo?: string;
  cercaColonia?: string;
}

function landmarkMasCercanoDeCategoria(lat: number, lng: number, categoria: string) {
  const puntos = CATEGORIAS_GENERICAS.find((c) => c.value === categoria);
  if (!puntos) return undefined;
  const distancia = distanciaMinimaACategoria(lat, lng, categoria);
  return distancia === null ? undefined : { label: puntos.label, distancia };
}

/**
 * Contraparte cliente de PropertyDetailPage para propiedades publicadas en
 * este navegador (id `local-...`) — nunca existen en el catálogo estático
 * que el servidor puede leer, así que se resuelven aquí desde localStorage
 * después de montar. `enRevision` queda fijo en `false`: esa señal sale de
 * una consulta a Prisma (moderacionBusqueda.ts) que un componente cliente no
 * puede hacer directo; el badge "En revisión" simplemente no aplica en esta
 * ruta — no es una regresión, esta página no existía en absoluto antes.
 *
 * ⚠️ BACKEND: este componente entero se puede borrar cuando exista
 * `GET /api/propiedades/:id` real — ver prisma/schema.prisma (modelo
 * Property sugerido al final del archivo). Con eso, PropertyDetailPage
 * vuelve a ser 100% Server Component (como ya lo es para el catálogo
 * estático hoy) y de paso `enRevision` funciona también aquí, porque
 * `estaEnRevision()` sí se podría llamar server-side para cualquier
 * propiedad, no solo las de muestra.
 */
export function LocalPropertyDetail({ id, cerca, cercaTipo, cercaColonia }: Props) {
  const [property, setProperty] = useState<Property | null | undefined>(undefined);
  const [extras, setExtras] = useState<PropertyDetailExtras>({ enRevision: false });

  useEffect(() => {
    function resolver() {
      const encontrada = obtenerPropiedadLocalPorId(id) ?? null;
      setProperty(encontrada);
      if (!encontrada) return;

      const landmarkCercano = cerca ? getLandmark(cerca) : undefined;
      const distanciaLandmark = landmarkCercano
        ? distanciaKm(encontrada.lat, encontrada.lng, landmarkCercano.lat, landmarkCercano.lng)
        : undefined;
      const categoriaCercana = !landmarkCercano && cercaTipo
        ? landmarkMasCercanoDeCategoria(encontrada.lat, encontrada.lng, cercaTipo)
        : undefined;
      const coloniaCercana = !landmarkCercano && !categoriaCercana && cercaColonia
        ? getColoniaByKey(cercaColonia) ?? undefined
        : undefined;
      const distanciaColonia = coloniaCercana
        ? distanciaKm(encontrada.lat, encontrada.lng, coloniaCercana.lat, coloniaCercana.lng)
        : undefined;

      setExtras({ landmarkCercano, distanciaLandmark, categoriaCercana, coloniaCercana, distanciaColonia, enRevision: false });
    }
    precargarColoniasDescubiertas();
    resolver();
    window.addEventListener(PROPIEDADES_LOCALES_EVENT, resolver);
    window.addEventListener(ESTADO_OVERRIDE_EVENT, resolver);
    return () => {
      window.removeEventListener(PROPIEDADES_LOCALES_EVENT, resolver);
      window.removeEventListener(ESTADO_OVERRIDE_EVENT, resolver);
    };
  }, [id, cerca, cercaTipo, cercaColonia]);

  if (property === undefined) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-brand" size={24} />
      </div>
    );
  }

  if (property === null) notFound();

  return <PropertyDetailView property={property} extras={extras} />;
}
