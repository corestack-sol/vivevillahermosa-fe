# Backend — distinguir el estado real de un favorito no disponible (2026-08-30)

## Contexto / por qué

`/favoritos` hoy no puede decirle a un usuario POR QUÉ una propiedad que
guardó ya no aparece — solo puede saber que ya no está en el catálogo
activo. Confirmado en código (`src/app/propiedades/[id]/page.tsx`,
`fetchProperty()`): `GET /propiedades/:id` devuelve **404 a cualquiera que
no sea el dueño** cuando la propiedad está pausada, vendida, rentada, o
fue eliminada — los 4 casos son indistinguibles desde afuera. Ni siquiera
un admin puede verlo por esa vía (usa `/admin/propiedades/:id` aparte,
que tampoco sirve aquí porque el usuario normal no tiene sesión de
admin).

**Decisión tomada mientras tanto:** el frontend ya muestra la propiedad
favorita no disponible como una card atenuada (antes desaparecía en
silencio), pero con un mensaje genérico ("El propietario la pausó, la
quitó, o la operación ya se cerró") — a propósito, para no inventar cuál
de los 4 casos es. Este documento pide el endpoint que permitiría
mostrar el mensaje real y específico.

## Lo que se necesita

Un endpoint que reciba una lista de IDs de propiedad (los favoritos del
usuario) y devuelva el `estado` real de cada una, **sin exigir que quien
pregunta sea el dueño** — a diferencia de `GET /propiedades/:id`, que sí
debe seguir siendo estricto (no se pide cambiar eso, ver §3).

```
POST /propiedades/estados
Body: { "ids": ["id1", "id2", "id3"] }

Respuesta:
{
  "estados": [
    { "id": "id1", "estado": "pausada" },
    { "id": "id2", "estado": "vendida" },
    { "id": "id3", "estado": null }  // no existe / fue eliminada de verdad
  ]
}
```

- `estado`: `'activa' | 'pausada' | 'vendida' | 'rentada' | null` — `null`
  cuando el ID ya no corresponde a ningún registro (eliminada de verdad,
  distinta de "pausada").
- Solo el campo `estado` — **nunca** devolver contacto, coordenadas
  reales, ni ningún otro dato de la propiedad en esta respuesta. La
  razón de que `GET /propiedades/:id` 404-ee a no-dueños es proteger
  esos datos; este endpoint nuevo debe ser deliberadamente mínimo para
  no reabrir ese hueco por otra puerta.
- Requiere sesión (usuario logueado) — igual que `/favoritos` ya la
  exige — pero no requiere ser el dueño de las propiedades consultadas.

## Cómo lo usaría el frontend

En `src/app/favoritos/page.tsx`: después de resolver los favoritos
contra el catálogo activo (`getAllProperties()`), los IDs que no
resolvieron se mandan a este endpoint nuevo. El mensaje genérico actual
("El propietario la pausó, la quitó, o la operación ya se cerró") se
reemplaza por uno específico según `estado`:

- `pausada` → "El propietario pausó esta publicación."
- `vendida` → "Esta propiedad ya se vendió."
- `rentada` → "Esta propiedad ya se rentó."
- `null` → "Esta propiedad ya no existe."

## Fuera de alcance

- Cambiar el comportamiento de `GET /propiedades/:id` — sigue 404-eando
  a no-dueños exactamente igual, esto es un endpoint nuevo y separado.
- Notificar proactivamente al usuario cuando un favorito cambia de
  estado (push/email) — esto solo resuelve la consulta al visitar
  `/favoritos`, no un sistema de notificaciones nuevo.
