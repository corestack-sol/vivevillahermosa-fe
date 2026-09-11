# Solicitudes de cambio de ubicación (pin) — contrato para backend

**Fecha:** 2026-09-11. **Estado: NO implementado, frontend ya listo.**

**Por qué hace falta:** al editar una propiedad, mover el pin más de
`RADIO_MAXIMO_PIN_KM` (1 km, `src/lib/mapPin.ts`) del punto original queda
bloqueado por diseño (evita reubicaciones exageradas sin revisar — la
distancia a cada zona/landmark debe seguir siendo real). Antes de este
pedido, el único mensaje era un toast diciendo "contáctanos" — sin link,
sin ninguna referencia a la propiedad, un callejón sin salida real: no
existía ningún canal estructurado, y tampoco una forma de que un
administrador viera estos casos en un solo lugar.

## Lado del dueño — crear la solicitud

| Ruta | Método | Body | Qué hace |
|---|---|---|---|
| `/propiedades/:id/solicitud-pin` | POST | `{ lat: number, lng: number, motivo?: string }` | Crea una solicitud de cambio de ubicación en estado `pendiente`. Requiere sesión y ser dueño de la propiedad (mismo guard que `PATCH /propiedades/:id`). `lat`/`lng` son el punto que el dueño intentó poner (ya rechazado por el frontend, fuera del radio permitido) — la propiedad NO se mueve todavía, solo queda la solicitud. |

**Frontend (ya conectado):** `src/components/property/SolicitarCambioPinModal.tsx`,
disparado desde `MapPicker`'s `onRejected` en `editar/page.tsx` cuando el
punto rechazado sí está dentro de Tabasco (fuera de Tabasco sigue siendo
un simple toast de error, no aplica solicitud). Si el backend responde
404, el modal cae a un `mailto:` prellenado a `corestack.sol@gmail.com`
con todo el contexto (propiedad, coords original/solicitada, distancia,
motivo) — no falla en silencio.

## Lado admin — revisar y resolver

| Ruta | Método | Body | Qué hace |
|---|---|---|---|
| `/admin/solicitudes-pin` | GET | — (query: `estado`, `page`) | Lista paginada. `estado` filtra por `pendiente`\|`aprobada`\|`rechazada` (default sugerido: `pendiente`). |
| `/admin/solicitudes-pin/:id/aprobar` | POST | — | Aplica `latSolicitada`/`lngSolicitada` a la propiedad de verdad (mismos campos que actualiza `PATCH /propiedades/:id`), marca la solicitud `aprobada`, notifica al dueño por correo (mismo patrón que `SolicitudRevision`/`ReporteAnuncio` — ver [[vive_villahermosa_admin_panel]] en memoria: ambas ramas, aprobado Y rechazado, mandan correo real). |
| `/admin/solicitudes-pin/:id/rechazar` | POST | `{ motivo?: string }` | Marca la solicitud `rechazada`, notifica al dueño por correo incluyendo el motivo si se dio. La propiedad NO se toca. |

Requieren `esAdmin`, mismo guard que el resto de `/admin/**`.

## Shape de cada solicitud (respuesta de GET)

```ts
interface SolicitudPin {
  id: string;
  propiedadId: string;
  propiedadTitulo: string;
  latOriginal: number;
  lngOriginal: number;
  latSolicitada: number;
  lngSolicitada: number;
  distanciaKm: number;       // precalculada — evita que cada cliente admin reimplemente Haversine
  motivo: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  createdAt: string;
  user: { id: string; email: string; nombre: string };
}
```

## Puntos a decidir del lado del backend

- **¿Puede un dueño tener más de una solicitud pendiente a la vez sobre la
  misma propiedad?** Recomendado: no — si ya hay una `pendiente`, un nuevo
  intento de `POST /propiedades/:id/solicitud-pin` debería actualizar esa
  misma solicitud (sobrescribir `lat`/`lng`/`motivo`) en vez de crear una
  fila duplicada.
- **Auditoría** — mismo patrón que `AccionAdmin` ya usado para bloqueos de
  cuenta y aprobación de reportes: guardar quién aprobó/rechazó, cuándo, y
  el motivo.
- **`GET /admin/metricas`** — agregar `solicitudesPin: { total, pendientes }`
  (opcional, mismo criterio que `intentosFraude`: `src/app/admin/page.tsx`
  ya oculta la tarjeta sola mientras el campo no exista).

## Frontend (ya conectado, esperando los 3 endpoints)

- `src/components/property/SolicitarCambioPinModal.tsx` — crear la solicitud.
- `src/app/admin/solicitudes-pin/page.tsx` — listar, aprobar, rechazar.
  Maneja 404 con un estado honesto ("el backend todavía no expone esta
  cola"), mismo criterio que `admin/fraude/page.tsx`.
- `src/app/admin/AdminNav.tsx` — link "Cambios de ubicación".
- `src/app/admin/page.tsx` — tarjeta de métricas, oculta hasta que exista
  `solicitudesPin` en la respuesta.
