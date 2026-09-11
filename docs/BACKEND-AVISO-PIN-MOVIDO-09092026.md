# Aviso "el pin se movió" en la página pública — contrato para backend

**Fecha:** 2026-09-09. **Estado (2026-09-11): IMPLEMENTADO, en producción.**
El backend ya manda `pinMovidoAt` (confirmado en vivo vía curl real,
ISO 8601 o `null`) — Opción B de las dos propuestas abajo. El frontend
solo no lo tenía conectado; ya se agregó a `Property`/`BackendPublicProperty`
(`src/types/property.ts`, `src/lib/api.ts`) y `PropertyDetailView.tsx`
muestra "El propietario actualizó esta ubicación · hace X días" junto al
mapa cuando el campo no es `null`. Sin acción pendiente del backend.

**Por qué hace falta:** al editar una propiedad ya publicada, el dueño
puede corregir el pin del mapa hasta 1km de su ubicación original
(`RADIO_MAXIMO_PIN_KM`, ver `src/lib/mapPin.ts` y
`dashboard/propiedades/[id]/editar/page.tsx`). Pedido explícito
2026-09-09: mostrar en la página pública de la propiedad
(`/propiedades/[id]`) un aviso de que el pin fue movido después de
publicarse — transparencia para quien la ve.

## Por qué no se puede hacer solo en el frontend

`GET /propiedades/:id` (`BackendPublicProperty`, ver `src/lib/api.ts`) no
manda ningún dato que distinga "esta propiedad nunca movió su pin" de
"el dueño lo corrigió después". Lo único parecido es `updatedAt`, pero
cambia con CUALQUIER edición (precio, fotos, título, lo que sea) — usarlo
como proxy de "se movió el pin" daría falsos positivos constantemente y
sería un dato inventado, no real (ver
[[feedback_no_datos_sueltos_sin_backend]] — nunca fabricar un dato
cuando no hay fuente real).

Ya existe un aviso 100% real, pero solo lo ve el DUEÑO en Editar: "Moviste
el pin X km de su ubicación original" (`editar/page.tsx`, comparación
local entre `original` y `coords` en esa misma sesión de edición) — eso
no requiere backend porque compara dos valores que el frontend ya tiene
en memoria en ese momento. Para la página PÚBLICA hace falta que el
propio backend recuerde y exponga ese hecho, ya que un visitante nunca
tuvo la coordenada "original" para comparar.

## Dato necesario

Alguna de estas dos opciones (la que sea más simple de agregar al modelo
`Property` ya existente):

| Opción | Campo | Tipo | Qué significa |
|---|---|---|---|
| A (más simple) | `ubicacionEditada` | `boolean` | `true` si `lat`/`lng` cambiaron alguna vez después de la creación (el backend ya sabe en el PATCH si esos campos vienen distintos al valor guardado — ahí es donde se marcaría). |
| B (más informativo) | `fechaUltimoMovimientoPin` | `string \| null` (ISO 8601) | Fecha del último PATCH que cambió `lat`/`lng`. Permite mostrar "actualizado hace 3 días" en vez de un aviso genérico. |

Cualquiera de las dos debe venir en la respuesta de `GET /propiedades/:id`
(vista pública), no solo en la vista de dueño.

## Frontend (pendiente, bloqueado por esto)

En cuanto el campo exista, agregar en `src/app/propiedades/[id]/page.tsx`
un aviso corto junto al mapa/ubicación (ej. "El propietario actualizó la
ubicación de esta propiedad") cuando `ubicacionEditada` sea `true` (u
opción B con fecha). No implementar nada de esto con datos aproximados
mientras el backend no lo mande.
