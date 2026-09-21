# Riesgo de inundación — respuesta del front al reporte del backend (20/09/2026)

Responde a los dos pedidos del backend y a sus avisos. Referencia: `src/lib/zonas-inundacion.ts` (`ZONAS`, `NO_CONFIRMADAS_EN_ATLAS`, `detectarRiesgoInundacion`).

## 1. Las 24 zonas que el Atlas de Riesgos de Centro 2023 NO nombra

Verificado buscando el nombre en las 380 páginas del PDF real. Son entradas de `ZONAS` que alguien agregó infiriendo el riesgo del distrito completo. Cada fila lista todos los patrones de la entrada (el primero es el canónico); el backend debe tratar cualquiera de ellos como "no citada".

| # | Riesgo en catálogo | Patrones (normalizados: minúsculas, sin acentos ni puntuación) |
|---|---|---|
| 1 | alto | gaviotas sur sector san jose · gaviotas sur san jose |
| 2 | alto | gaviotas sur armenia |
| 3 | alto | gaviotas norte sector explanada · gaviotas norte explanada |
| 4 | alto | gaviotas norte sector popular |
| 5 | alto | gaviotas norte |
| 6 | alto | fovissste casa blanca |
| 7 | alto | tierra colorada |
| 8 | alto | brisas del carrizal · brisas carrizal |
| 9 | alto | valle verde |
| 10 | alto | reforma agraria |
| 11 | bajo | atasta de serra |
| 12 | medio | miguel hidalgo ii · miguel hidalgo iii |
| 13 | medio | invitab miguel hidalgo |
| 14 | medio | las granjas |
| 15 | medio | aquiles serdan |
| 16 | medio | lindavista |
| 17 | bajo | colonia carrizal |
| 18 | bajo | jardines del grijalva · jardines de grijalva |
| 19 | bajo | las garzas |
| 20 | bajo | lomas de casa blanca |
| 21 | bajo | paraiso dorado |
| 22 | bajo | villas del grijalva · villas grijalva |
| 23 | bajo | parque tabasco |
| 24 | bajo | villahermosa 2000 |

### Regla de coincidencia (idéntica a la del front)

El campo `colonia` es texto libre. El front normaliza (minúsculas, sin acentos, solo `a-z0-9` y espacio, espacios colapsados) y busca la **primera** entrada de `ZONAS`, en orden, cuyo patrón esté **contenido** en la colonia normalizada (`includes`). Solo aplica si `municipio === 'Centro'`.

- Una propiedad cuya colonia normalizada contiene alguno de los patrones de la tabla anterior es candidata a corrección.
- El orden importa en casos raros: p. ej. "colonia reforma agraria" cae primero en `reforma agraria` (no citada) y no en `colonia reforma` (citada). Si el backend prefiere evitar falsos positivos, puede corregir solo las que coincidan **exactamente** con un patrón y dejar las demás para revisión manual. Si quiere la coincidencia exacta del front, el front puede entregar la lista de propiedades resultante si el backend nos pasa `id` + `colonia`.

### Qué corregir en las ya guardadas

Propiedades de Centro con `riesgoInundacionFuente = 'atlas'` cuya colonia coincida con la tabla: pasar a `'propietario'` (el valor `riesgoInundacion` no cambia, solo deja de presentarse como "según el Atlas"). Desde esta versión el front ya no manda `riesgoInundacionDetectado` para esas 24 (manda `null`), por lo que las nuevas quedan en `'propietario'`.

## 2. `POST /ia/descripcion-zona`

Confirmado en `src/app/zonas/[slug]/page.tsx` (`resolverDescripcion`):

- Solo se llama para **colonias** (los municipios ya no llaman a la IA).
- `riesgoInundacion` se envía únicamente si se cumplen las tres condiciones: `municipio === 'Centro'` (si no, `detectarRiesgoInundacion` devuelve `null`), `confianza === 'confirmada'` (nombre igual, exacto, a un patrón) y `citadaEnAtlas === true`.
- En cualquier otro caso el campo va `undefined` (no se envía).
- Por lo tanto solo lo recibe para las 64 zonas citadas, y solo en Centro.

Aun así, el backend no debería depender de esto: el candado natural es que "según el Atlas de Riesgos" solo se escriba si además `municipio === 'Centro'`.

## 3. Avisos del backend

- **Candado `'atlas'` solo en Centro**: de acuerdo. El front ya lo aplica, y el backend lo repite como defensa.
- **Estado "sin dato"**: de acuerdo en acordarlo más adelante. Hoy el formulario de publicar incluye `riesgoInundacion` en la validación del paso, así que el front lo manda siempre al publicar. Hay que definir el valor para los otros 16 municipios, donde no hay fuente.
- **Otros 16 municipios**: sin fuente ni plan en el front; se queda como decisión institucional (Protección Civil / IMPLAN).
- **`src/data/flood-zones.json`**: ya borrado del front.
- **Backfill**: sin cambios; propiedades anteriores al 11/09 con detección `null` quedan como `'propietario'`.
