# Backend — pendientes reales de esta sesión (2026-08-30)

Consolidado único (antes esto vivía en varios archivos `BACKEND-*.md`
separados, borrados a propósito) — 6 puntos reales que el frontend ya
tiene listo del lado del cliente, pero necesitan trabajo de backend para
funcionar de verdad o para dejar de ser "el catálogo completo disfrazado
de filtro". Ninguno de los 6 rompe nada hoy — todos degradan al
comportamiento actual mientras el backend no los reconozca.

---

## 1. Favoritos — distinguir por qué una propiedad ya no está disponible

**Hoy:** `GET /propiedades/:id` devuelve 404 a cualquiera que no sea el
dueño cuando la propiedad está pausada, vendida, rentada, o fue
eliminada — los 4 casos son indistinguibles desde afuera (confirmado en
`src/app/propiedades/[id]/page.tsx`, `fetchProperty()`). `/favoritos`
muestra la card atenuada igual, pero con mensaje genérico ("El
propietario la pausó, la quitó, o la operación ya se cerró") porque no
hay forma de saber cuál es.

**Se necesita:**

```
POST /propiedades/estados
Body: { "ids": ["id1", "id2", "id3"] }
Respuesta:
{ "estados": [
  { "id": "id1", "estado": "pausada" },
  { "id": "id2", "estado": "vendida" },
  { "id": "id3", "estado": null }  // ya no existe
]}
```

- `estado`: `'activa' | 'pausada' | 'vendida' | 'rentada' | null`.
- Requiere sesión (cualquier usuario logueado), **no** requiere ser el
  dueño de las propiedades consultadas.
- Solo el campo `estado` — nunca contacto, coordenadas reales, ni ningún
  otro dato. `GET /propiedades/:id` sigue 404-eando a no-dueños exactamente
  igual; este es un endpoint nuevo y deliberadamente mínimo para no
  reabrir por otra puerta el hueco de privacidad que ese 404 protege.

**Frontend, ya listo:** en cuanto exista, `src/app/favoritos/page.tsx`
reemplaza el mensaje genérico por uno específico por `estado`.

---

## 2. Motivo de pausa/eliminación — confirmar si se está guardando

**Hoy:** al pausar o eliminar una propiedad, el frontend manda
`motivo`/`motivoDetalle`/`encontradoEnPlataforma`/`medioAlterno` como
**query params** (nunca en el body — un PATCH con estos campos en el
body devuelve 400 `"property motivo should not exist"`, confirmado en
vivo esta sesión) en:

```
PATCH /propiedades/:id?motivo=X&motivoDetalle=Y
DELETE /propiedades/:id?motivo=X&motivoDetalle=Y
PATCH /propiedades/:id?motivo=vendida_...&encontradoEnPlataforma=true&medioAlterno=Z
```

Valores reales usados por `PausarPropiedadModal.tsx`/
`EliminarPropiedadModal.tsx`/`ArchivarPropiedadModal.tsx`: motivos de
pausa (actualizando, mensajes_no_calificados, pausa_temporal, otro),
motivos de eliminación (5 opciones), y para vendida/rentada la pregunta
de si el contacto vino de la plataforma o de otro medio.

**No verificado:** a diferencia de todo lo demás en este documento,
nunca confirmé si el backend efectivamente persiste estos query params
en algún lado, o si los recibe sin error (200 OK) pero los descarta en
silencio. Es la pieza más urgente de verificar de las 6 — sin esa
persistencia, todo el propósito original de esto (medir por qué la
plataforma pierde publicaciones) no se está cumpliendo aunque el
frontend ya mande el dato.

**Si no se está guardando, se necesita:** una tabla o campos en
`Property` para `motivoCierre`, `motivoCierreDetalle`,
`encontradoEnPlataforma`, `medioAlterno`, `fechaCierre` — y lo mismo
para el caso de venta/renta.

---

## 3. Mapa — filtrar propiedades por área visible (bbox) — ✅ YA IMPLEMENTADO

**Actualización 2026-08-26:** verificado en vivo — el backend SÍ está
filtrando por `swLat/swLng/neLat/neLng` a pesar del `all=true` de
respaldo (probado con 3 recuadros de distinto tamaño sobre el mismo
catálogo: 28 → 7 → 2 resultados según se cierra el área). El comentario
de abajo y en `api.ts`/`getPropertiesInBounds()` quedó desactualizado —
se corrige aquí, código no necesita ningún cambio, ya funciona con lo
que manda hoy.

Efecto secundario real encontrado por esto: con solo 28 propiedades de
muestra repartidas en todo el estado, ahora es normal que acercar el
zoom a una zona puntual sí muestre "Sin propiedades aquí" — antes casi
nunca se veía ese estado porque el backend regresaba el catálogo
completo sin importar el zoom. Se le agregó una X para cerrarlo sin
tener que resetear filtros (`MapaClient.tsx`).

<details><summary>Contrato original (ya cumplido, se deja como referencia)</summary>

```
GET /propiedades?swLat=X&swLng=Y&neLat=Z&neLng=W
```

- Filtra por `latPublico`/`lngPublico` (nunca `lat`/`lng` reales) dentro
  del rectángulo.
- Sin límite de resultados dentro del área — el mapa necesita ver todo
  lo que cae en pantalla, a diferencia de una paginación normal.
- Tiene prioridad sobre `all=true` cuando ambos vienen en el mismo
  request — confirmado, no se queda pegado al catálogo completo.

</details>

---

## 4. `/propiedades` — paginación real y filtros simples

**Hoy:** mismo patrón que el mapa — `page`/`limit` y filtros simples
(`tipo`, `operacion`, `municipio`, `precioMin/Max`, `recamaras`,
`recamarasMax`, `banos`, `m2Min/Max`, `riesgoInundacion`,
`cercaDosoBocas`, `q`, `sort`) se mandan junto con `all=true`, ignorados
hoy.

**Se necesita:**

```
GET /propiedades?page=1&limit=12&tipo=casa&operacion=venta&...
Respuesta: { propiedades: [...], total: N }
```

- `total` = conteo completo que cumple los filtros (no el tamaño de la
  página) — el frontend lo usa para "Mostrando 12 de 340".
- `m2Min`/`m2Max` sobre `m2Terreno` cuando `tipo=terreno`, si no sobre
  `m2Construidos`.
- **Mismo criterio de prioridad que el punto 3**: estos parámetros deben
  ganarle a `all=true` cuando ambos están presentes.
- Fuera de alcance a propósito (decisión ya tomada, no repetir el
  trabajo): `zonaDestacada`, "Todo lo demás" (scoring por coincidencias
  parciales), `amenidad` — el frontend los sigue resolviendo en memoria
  con el catálogo completo cuando alguno de esos está activo.
- Proximidad a un lugar con nombre (colonia/landmark) — el frontend ya
  resuelve el nombre a coordenada real, manda `nearLat/nearLng/nearRadiusKm`
  listos para filtrar por distancia (Haversine), nunca el nombre.

**Rendimiento, no opcional si esto se implementa:** índices reales en
`tipo`, `operacion`, `municipio`, `precio`, `latPublico`/`lngPublico` —
sin eso, paginar no ahorra nada, solo cambia la forma del mismo escaneo
completo.

---

## 5. `/propiedades` — orden por defecto agrupado por municipio

**Hoy:** sin filtros, las propiedades aparecen en el orden que sea que
el backend las devuelva — sin agrupación por municipio.

**Se necesita:** cuando no venga `sort` (o venga `sort=relevancia`,
tratarlo igual que ausente), ordenar:

```sql
ORDER BY
  CASE municipio
    WHEN 'Centro' THEN 1 WHEN 'Cárdenas' THEN 2 WHEN 'Comalcalco' THEN 3
    WHEN 'Paraíso' THEN 4 WHEN 'Nacajuca' THEN 5 WHEN 'Jalpa de Méndez' THEN 6
    WHEN 'Huimanguillo' THEN 7 WHEN 'Centla' THEN 8 WHEN 'Macuspana' THEN 9
    WHEN 'Tenosique' THEN 10 WHEN 'Cunduacán' THEN 11 WHEN 'Emiliano Zapata' THEN 12
    WHEN 'Balancán' THEN 13 WHEN 'Jonuta' THEN 14 WHEN 'Tacotalpa' THEN 15
    WHEN 'Teapa' THEN 16 WHEN 'Jalapa' THEN 17
    ELSE 18
  END,
  featured DESC,
  createdAt DESC
```

Mismo orden que ya usa el frontend en el catálogo completo
(`src/lib/filters.ts`, `sortProperties()`), no es un número inventado —
es el orden real de `MUNICIPIO_CENTERS` en `publishSchema.ts`.

---

## 6. Persistir señales de fraude ya detectadas en fotos

**Hoy:** el comentario en `PublishForm.tsx` (junto a la subida de fotos)
confirma que el backend **ya vuelve a analizar cada foto con Gemini por
su cuenta** en `POST /propiedades/fotos`, antes de aceptarla — más
confiable que el chequeo del navegador (imagen completa, no una
miniatura). Ese resultado se usa solo para decidir aceptar/rechazar y
después se descarta.

**Se necesita:**

```
AlertaFoto
  id, fotoUrl, apta (bool), relacionada (bool), senales (JSON string —
  SQLite no soporta arrays nativos), notas, createdAt
```

- Se escribe en `POST /propiedades/fotos` en el mismo momento en que ya
  se decide aceptar/rechazar.
- `GET /api/admin/alertas-fotos` (gateado por `requireAdmin()`, mismo
  patrón que el resto de `/api/admin/**`) — lista paginada, unida con
  `titulo`/`id`/`municipio` de la propiedad dueña vía `fotoUrl`.
- No depende de `Property.userId` (ese gap es sobre el DUEÑO, `Property`
  ya es una tabla real) — con `fotoUrl` guardado alcanza para unir contra
  `Property.fotos`.
- Sin cambios al chequeo del frontend (`analizarFoto()`, aviso al
  publicador en el momento) — sigue igual, sirve un propósito distinto.

---

## 7. Detección de foto reciclada de OTRO anuncio (cross-usuario)

**Hoy:** `PublishForm.tsx` (`detectarFotoRepetida`, `src/lib/fotoHash.ts`)
calcula un hash perceptual (dHash) de cada foto nueva y la compara contra
las de las OTRAS propiedades del MISMO dueño (ya trae sus fotos vía
`GET /propiedades/mias`) — avisa, no bloquea, si dos son casi idénticas.
Atrapa "subí la misma foto dos veces por error", nunca "esta foto es de
otro anuncio ajeno" — comparar contra el catálogo completo de la
plataforma bajando y hasheando las fotos de cientos de propiedades ajenas
en el navegador, en cada foto que alguien sube, no es viable ni deseable.

**Se necesita (si se retoma):** un índice de hashes del lado del backend —
guardar el mismo tipo de hash (o uno equivalente) por foto en
`POST /propiedades/fotos` (mismo punto donde ya se re-analiza con Gemini,
ver punto 6 de arriba) y comparar la nueva contra el índice completo ahí,
donde sí es una sola consulta indexada en vez de N descargas desde el
navegador. Sin pedido concreto todavía — documentado como el techo real de
lo que el frontend puede hacer solo.

## Fuera de este documento (análisis hecho, nada construido ni pedido todavía)

- **Límite de uso de IA por cuenta** — se analizó tierizar por
  `rol`/`verificado` y se descartó (ninguno es una señal confiable hoy —
  `rol` es autodeclarado, `verificado` es una demo local que nunca pasa a
  real). Sin pedido concreto todavía.
- **Límite de mensajes a un propietario** — se diseñaron 3 topes
  (por propiedad, por propietario real vía el correo ya resuelto para el
  envío, global por remitente) pero no se implementó nada, ni frontend ni
  backend.

Ninguno de los dos tiene código esperando del lado del frontend — si se
retoman, empiezan de cero, no son "casi listos".
