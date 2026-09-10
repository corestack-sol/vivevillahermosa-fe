'use client';

import { useEffect, useRef } from 'react';
// maplibre-gl no tiene default export (a diferencia de Leaflet) — solo
// exports nombrados.
import type { Map as MaplibreMap, Marker as MaplibreMarker } from 'maplibre-gl';
import { estaEnTabasco, TABASCO_BOUNDS } from '@/lib/tabascoBoundary';
import { toMaplibreBounds } from '@/lib/mapGeo';

export interface Coords { lat: number; lng: number }

const PIN_HTML = '<div style="width:20px;height:20px;background:#4f46e5;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 10px rgba(79,70,229,0.5)"></div>';

// Migrado de react-leaflet/Leaflet a MapLibre GL (pedido explícito
// 2026-09-02, mismo motivo que MapView.tsx: sin límite de cuota, estilo
// real en vez de raster+filtro). Antes esta pantalla usaba tiles crudos de
// tile.openstreetmap.org (sin pasar por Esri) — ese servidor público tiene
// política de "mejor esfuerzo" y prohíbe uso de producción de alto
// volumen, un riesgo que ni siquiera se había señalado hasta ahora. El
// estilo 'liberty' de OpenFreeMap no tiene ese problema (ver MapView.tsx
// para el detalle de por qué se eligió ese estilo).
const STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const MAPLIBRE_MAX_BOUNDS = toMaplibreBounds(TABASCO_BOUNDS);

export interface MapPickerProps {
  value: Coords | null;
  onChange: (c: Coords) => void;
  center?: [number, number];
  /**
   * Validación extra además del chequeo de frontera de Tabasco (que
   * MapPicker siempre aplica) — ej. el radio máximo de 1km desde el punto
   * original al editar una propiedad ya publicada (ver
   * dashboard/propiedades/[id]/editar/page.tsx). Si no se da, solo se
   * valida Tabasco.
   */
  esValido?: (c: Coords) => boolean;
  /**
   * Se llama con el punto rechazado — por salir de Tabasco o por no pasar
   * `esValido` — para que quien lo use decida qué aviso mostrar (el
   * llamador puede volver a chequear `estaEnTabasco(c)` para distinguir el
   * motivo). El pin SIEMPRE vuelve visualmente a su última posición
   * aceptada, sin importar el motivo del rechazo.
   */
  onRejected?: (c: Coords) => void;
}

export function MapPicker({ value, onChange, center = [17.9869, -92.9303], esValido, onRejected }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<MaplibreMap | null>(null);
  const markerRef      = useRef<MaplibreMarker | null>(null);
  // Constructor de maplibre-gl guardado tras el import dinámico inicial —
  // así el efecto que sincroniza `value` (línea ~110) no tiene que volver
  // a `await import(...)` cada vez que cambia el pin.
  const MarkerCtorRef = useRef<typeof MaplibreMarker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Refs para que los listeners (agregados una sola vez al montar) siempre
  // lean el valor/callback más reciente sin tener que reagregarse. Se
  // sincronizan en un efecto, no durante el render (un ref es un valor
  // mutable fuera del ciclo de render de React).
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const esValidoRef = useRef(esValido);
  const onRejectedRef = useRef(onRejected);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
    esValidoRef.current = esValido;
    onRejectedRef.current = onRejected;
  });

  // true justo antes de llamar a onChange por un clic/arrastre directo del
  // propio mapa — el efecto que sincroniza `value` (más abajo) lo revisa
  // para saber si el pin YA está a la vista (no hace falta mover la
  // cámara) o si el cambio vino de AFUERA (colonia escrita, GPS de una
  // foto, "deshacer", etc.), donde sí hace falta recentrar. Bug real
  // reportado 2026-09-09: escribir una colonia distinta cuando el pin ya
  // existía (por una colonia anterior) sí movía el pin pero la cámara se
  // quedaba donde estaba — solo el primer pin de la sesión recentraba.
  const cambioPorInteraccionRef = useRef(false);

  /** Crea el pin arrastrable y engancha su `dragend` — usado tanto al montar (si ya hay `value`) como cuando `value` aparece después. */
  function crearPin(map: MaplibreMap, MarkerCtor: typeof MaplibreMarker, coords: Coords): MaplibreMarker {
    const el = document.createElement('div');
    el.innerHTML = PIN_HTML;
    const marker = new MarkerCtor({ element: el.firstElementChild as HTMLElement, draggable: true, anchor: 'bottom' })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLngLat();
      const candidato = { lat: p.lat, lng: p.lng };
      // Bug real reportado 2026-09-09: este chequeo antes solo miraba la
      // frontera de Tabasco — si `onChange` (ej. moverPin() en
      // editar/page.tsx, que además acota a RADIO_MAXIMO_PIN_KM) rechazaba
      // el punto por CUALQUIER OTRO motivo, el marcador se quedaba
      // arrastrado visualmente en el punto rechazado (MapLibre ya lo movió
      // ahí de verdad, es nativo del drag) aunque el estado de React nunca
      // cambiara — el pin parecía haberse movido fuera del radio permitido
      // aunque en realidad no se guardó ahí. Ahora la validación completa
      // (Tabasco + `esValido`) se hace ACÁ, antes de aceptar, así el
      // marcador siempre vuelve a su última posición válida sin importar
      // el motivo del rechazo.
      if (estaEnTabasco(p.lat, p.lng) && (!esValidoRef.current || esValidoRef.current(candidato))) {
        cambioPorInteraccionRef.current = true;
        onChangeRef.current(candidato);
      } else {
        // Regresa el pin a su última posición válida en vez de dejarlo
        // "perdido" — arrastrar y soltar a un punto rechazado no debe
        // silenciosamente dejarlo ahí.
        const last = valueRef.current;
        if (last) marker.setLngLat([last.lng, last.lat]);
        onRejectedRef.current?.(candidato);
      }
    });
    return marker;
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let alive = true;

    (async () => {
      const { Map: MaplibreMapCtor, Marker, setWorkerUrl } = await import('maplibre-gl');
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (!alive || !containerRef.current) return;
      MarkerCtorRef.current = Marker;
      // Turbopack no resuelve bien el `import.meta.url` con el que
      // MapLibre intenta detectar la URL de su propio worker — sin esto,
      // el mapa monta pero nunca pinta ningún tile (ver
      // scripts/copy-maplibre-worker.mjs para el detalle completo).
      setWorkerUrl('/maplibre-gl-worker.mjs');

      const start = valueRef.current ? [valueRef.current.lng, valueRef.current.lat] as [number, number] : [center[1], center[0]] as [number, number];
      const map = new MaplibreMapCtor({
        container: containerRef.current,
        style: STREET_STYLE,
        center: start,
        zoom: 14,
        // Restringe panning/zoom a Tabasco + margen — ver TABASCO_BOUNDS.
        // minZoom bajado de 10 a 8 (2026-09-02), mismo ajuste y mismo
        // motivo real que MapView.tsx: 10 era matemáticamente más alto
        // que el zoom mínimo real para ver el estado completo (~9 en
        // desktop, calculado con la fórmula estándar de fitBounds — ver
        // el comentario de `minZoom` en MapView.tsx para el detalle).
        maxBounds: MAPLIBRE_MAX_BOUNDS,
        minZoom: 8,
        attributionControl: false,
      });
      mapRef.current = map;

      // Este mapa vive dentro de un paso del wizard de PublishForm.tsx —
      // si el contenedor todavía no tenía su tamaño final cuando MapLibre
      // lo midió por primera vez (ej. una transición/animación de paso que
      // no había terminado de asentarse), se queda mal medido para
      // siempre: cada clic/arrastre calcula mal a qué lat/lng corresponde
      // el pixel donde tocaste, y el mapa se siente "trabado" o imposible
      // de navegar bien. `ResizeObserver` avisa a MapLibre en cuanto el
      // contenedor SÍ asienta su tamaño real (mismo fix aplicado a
      // MapView.tsx tras encontrar el problema de latencia ahí — ver ese
      // archivo para el detalle completo).
      const resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);
      resizeObserverRef.current = resizeObserver;

      map.on('click', (e) => {
        const { lat, lng } = e.lngLat;
        const candidato = { lat, lng };
        // Rechaza el clic en vez de colocar el pin cuando cae fuera de la
        // frontera real de Tabasco (src/lib/tabascoBoundary.ts) —
        // `maxBounds` de arriba ya impide navegar MUY lejos del estado,
        // pero es un rectángulo con margen (ni Leaflet ni MapLibre
        // restringen panning a un polígono real), así que sin este chequeo
        // alguien todavía podría hacer clic en una esquina del rectángulo
        // que en realidad ya es Veracruz/Chiapas/Campeche. `esValido`
        // agrega cualquier validación extra del formulario que lo use (ej.
        // el radio máximo al editar).
        if (estaEnTabasco(lat, lng) && (!esValidoRef.current || esValidoRef.current(candidato))) {
          cambioPorInteraccionRef.current = true;
          onChangeRef.current(candidato);
        } else {
          onRejectedRef.current?.(candidato);
        }
      });

      if (valueRef.current) {
        markerRef.current = crearPin(map, Marker, valueRef.current);
      }
    })();

    return () => {
      alive = false;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sincroniza el pin cuando `value` cambia — crea el marcador la
  //    primera vez que aparece un valor, solo mueve la posición después.
  //    La cámara solo sigue al pin cuando el cambio vino de AFUERA (GPS de
  //    foto, colonia escrita, "deshacer", carga inicial): un clic/arrastre
  //    directo del usuario no necesita recentrar, ya está viendo ese punto
  //    (`cambioPorInteraccionRef`, marcado en crearPin()/el listener de
  //    clic arriba). ──
  useEffect(() => {
    const map = mapRef.current;
    const MarkerCtor = MarkerCtorRef.current;
    if (!map || !MarkerCtor) return;
    if (!value) { markerRef.current?.remove(); markerRef.current = null; return; }

    const fueInteraccionDirecta = cambioPorInteraccionRef.current;
    cambioPorInteraccionRef.current = false;

    if (markerRef.current) {
      markerRef.current.setLngLat([value.lng, value.lat]);
    } else {
      markerRef.current = crearPin(map, MarkerCtor, value);
    }

    if (!fueInteraccionDirecta) {
      // Bug real reportado 2026-09-01 (GPS de foto) y 2026-09-09 (colonia
      // escrita, cuando YA había un pin de una colonia anterior): sin
      // recentrar aquí, el mapa se quedaba mirando donde estaba antes y el
      // pin nuevo podía aparecer bien lejos, fuera de vista.
      map.flyTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 15), duration: 800 });
    }
  }, [value]);

  // ── Recentra solo mientras no hay pin puesto — igual que antes (react-
  //    leaflet CenterController): una vez que hay pin, el centro lo manda
  //    la persona, no el prop `center`. ──
  useEffect(() => {
    if (!mapRef.current || value) return;
    mapRef.current.jumpTo({ center: [center[1], center[0]], zoom: 14 });
  }, [center[0], center[1], value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
