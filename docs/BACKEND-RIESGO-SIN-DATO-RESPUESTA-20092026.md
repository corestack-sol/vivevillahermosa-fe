# Riesgo de inundación — respuesta del front a la propuesta `sin_dato` (20/09/2026)

Respuestas a las 6 preguntas, verificadas leyendo el código del front (no de memoria).

## 1. ¿`'sin_dato'` como texto o `null`?

De acuerdo con `'sin_dato'` en el mismo campo. Con `null` el tipo cambiaría de forma y varios sitios lo tratarían como "falta el campo"; con un cuarto valor de texto, TypeScript nos marca cada lugar a actualizar (hay varios `Record<FloodRisk, …>`, ver pregunta 4).

## 2. ¿El formulario preselecciona algo, por ejemplo `bajo`?

**No.** En `PublishForm.tsx` el selector arranca vacío. Solo se rellena si hay detección contra el catálogo del Atlas (solo Centro); si no hay detección se deja sin valor (`setValue('riesgoInundacion', undefined)`). Además `publishSchema` exige uno de los tres valores (`z.enum(['alto','medio','bajo'])`), así que el formulario nunca envía "sin elegir".

Consecuencia: un `bajo` de fuera de Centro publicado desde el formulario actual **fue una elección del dueño**, no un relleno. Los `bajo` de relleno vendrían de otras vías (importación, clientes antiguos, o el default del backend cuando no llega el campo).

## 3. ¿Podemos distinguir un `bajo` elegido de uno de relleno en datos ya guardados?

No. El front no guarda esa distinción; solo existe `riesgoInundacionFuente` (`'atlas'|'propietario'`), y `'propietario'` cubre ambos casos. Coincidimos: **no tocar las propiedades existentes**.

## 4. Lugares del front que dependen de solo 3 valores

Todo esto se rompe o muestra vacío con un cuarto valor y lo actualizaremos en el paso 2:

- Tipo `FloodRisk` (`src/types/property.ts`) y `Record<FloodRisk, …>` en `src/lib/floodColors.ts` (`FLOOD_COLOR`, `FLOOD_LABEL`).
- Badge y tarjetas: `FloodRiskBadge`, `PropertyCard` (punto de color), ficha (`PropertyDetailView`) y `/comparar`.
- Mapa: `MapView.tsx` (`FLOOD_COLORS`/`FLOOD_DARK`, un valor desconocido daría color `undefined`), `SelectedPropertyCard.tsx` (`RIESGO_LABEL/SHORT/COLOR`), `MapaClient.tsx` (tres interruptores de nivel; con `sin_dato` el pin desaparecería del mapa porque el conjunto activo no lo contiene, y hay un fallback `?? 'bajo'`).
- Formularios: radios de publicar y de editar, `publishSchema`, y el cálculo de "bajó el riesgo a propósito" (`RIESGO_ORDEN`, con guardia `in`).
- Coach de calidad (`src/lib/coach.ts`, `RIESGO_ORDEN` de 3 valores).
- Chip de filtros activos (`ActiveFilters.tsx`) y el sugeridor de ejemplos de búsqueda (`SearchBar.tsx`, cuenta solo `bajo`).
- Filtros locales (`filters.ts`, comparan por igualdad, no necesitan cambio) y el parseo de `?riesgo=` (`useFilters.ts`, con un cast de tipo).
- Alertas (`alertas/page.tsx`): la casilla `sinRiesgo` se muestra como "zona segura".

## 5. Filtro de búsqueda: ¿ofrecer "sin información"?

Hoy **no hay un selector de riesgo en el panel de filtros** de `/propiedades`: el parámetro solo llega por URL, por los chips y por la búsqueda con IA. Propuesta: no agregar filtro; basta con que `bajo` ya no incluya `sin_dato`. En el mapa sí añadiremos un cuarto interruptor (gris, activo por defecto) para que esos pines no desaparezcan.

## 6. Importación CSV

El importador del front (`dashboard/propiedades/importar`) trata `riesgoInundacion` como columna obligatoria y valida cada fila con el mismo esquema que el formulario: una fila con el campo vacío **se rechaza en el cliente y no se envía**. Por tanto el default del paso 3 no afecta a esa vía. Si el backend tiene otra importación propia que no manda el campo, confirmen ustedes que quedará como `sin_dato` (nos parece correcto). Si prefieren que el front acepte celdas vacías, lo cambiamos a `sin_dato` después del paso 2.

## Plan del front (paso 2)

1. Ampliar la unión a `'alto'|'medio'|'bajo'|'sin_dato'` y actualizar todos los sitios de la pregunta 4 (texto "Sin información de riesgo de inundación", sin color de alerta; gris en el mapa).
2. Formulario de publicar/editar: opción "No sé / sin información", preseleccionada cuando el municipio no sea Centro o la colonia no tenga detección.
3. Alertas: aclarar que "zona segura" solo trae propiedades con riesgo conocido.
4. Avisamos cuando esté en producción para que hagan el paso 3.

No empezamos el paso 2 hasta que el backend confirme el paso 1 (aceptar `'sin_dato'` sin cambiar ningún default).
