# Destacar propiedad — falta expiración real en backend

**Estado: PENDIENTE**
**Fecha: 16/09/2026**

## Problema

`DestacarPropiedadModal.tsx` le muestra al usuario un selector de duración
(7 / 15 / 30 días) y el frontend arma un mensaje tipo "tu propiedad estará
destacada por 15 días". Pero el `dias` elegido nunca se envía al backend —
solo existe un campo `featured: boolean` sin ningún dato de expiración.

Resultado real hoy: al destacar, `featured` queda en `true` para siempre,
sin importar qué duración eligió el usuario. Nadie lo quita — no hay botón
de "quitar destacado" en ningún lado del frontend tampoco (ese es un gap
del frontend, ya en curso de arreglarse por separado).

## Verificado en vivo (verificacion-backend-en-vivo, 16/09/2026)

Cuenta y propiedad de prueba desechables, ya borradas.

1. `PATCH /propiedades/:id` con body `{"featured": true, "featuredHasta":
   "2026-10-01T00:00:00.000Z"}` → **400**
   `{"message":["property featuredHasta should not exist"],"error":"Bad Request"}`
   Confirma: el whitelist del DTO rechaza el campo completo, no lo ignora.

2. `PATCH /propiedades/:id` con body `{"featured": true}` solo → **200**,
   `featured` queda en `true`. Confirmado con GET posterior.

3. `PATCH /propiedades/:id` con body `{"featured": false}` solo → **200**,
   `featured` queda en `false`. Confirmado con GET posterior.

Conclusión: el toggle boolean simple ya funciona en ambos sentidos hoy.
Lo que falta es una forma real de expresar/guardar una duración.

## Qué se pide

Una de estas dos opciones (cualquiera resuelve el problema):

**Opción A (recomendada):** `PATCH /propiedades/:id` acepta un nuevo campo
opcional `featuredDias` (number, ej. 7/15/30). El backend calcula y
persiste `featuredHasta` (timestamp) internamente, y lo devuelve en el
GET/PATCH de la propiedad (`featuredHasta: string | null`). Un job o
consulta programada apaga `featured` automáticamente al vencer (o el
frontend lo trata como vencido si `featuredHasta < now`, aunque lo ideal
es que el backend ya lo haya apagado).

**Opción B (mínima):** el backend no calcula nada — solo acepta y guarda
`featuredHasta` como el frontend lo calcule (`now + dias`) y lo devuelve
en las respuestas. El frontend decide cuándo mostrarlo como vencido.
Requiere igual que el DTO dueño de `PATCH /propiedades/:id` deje de
rechazar ese campo.

Cualquiera de las dos: agregar `featuredHasta` a `BackendPublicProperty`
en las respuestas de `GET /propiedades`, `GET /propiedades/:id` y al
propio `PATCH`.

## Mientras tanto (frontend, ya en curso)

- El selector de 7/15/30 días se deshabilita o se marca explícitamente
  como "aún no aplica duración automática" hasta que este campo exista.
- Se agrega acción "Quitar destacado" en dashboard/propiedades y
  OwnerActionsBar usando `PATCH {featured: false}` — ya confirmado que
  funciona hoy sin depender de este pendiente.
