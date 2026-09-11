# Fuente del nivel de inundación (Atlas vs. reportado por el propietario)

**Fecha:** 2026-09-11. **Estado: IMPLEMENTADO (backend + frontend), en producción.**

**Contrato final** (decisión del backend, no la propuesta original de
este documento): el backend NO acepta una etiqueta de fuente calculada
por el frontend — eso reabriría el mismo problema de "cita falsa" vía
un flag en vez de una cita, si el flag se manda mal. En cambio:

- `POST /propiedades` y `PATCH /propiedades/:id` reciben
  `riesgoInundacionDetectado?: 'alto'|'medio'|'bajo'|null` — lo que
  `zonas-inundacion.ts` detectó para la colonia/municipio ANTES de que
  la persona lo ajustara a mano. `null` y "no mandar el campo" se
  tratan igual (sin intento de detección).
- `GET /propiedades/:id` (pública y de dueño) devuelve
  `riesgoInundacionFuente: 'atlas'|'propietario'` — `'atlas'` solo si
  `riesgoInundacion` coincide exacto con lo mandado en
  `riesgoInundacionDetectado`; `'propietario'` en cualquier otro caso,
  incluyendo propiedades previas a este cambio (sin backfill).

Frontend ya manda `riesgoInundacionDetectado` en `PublishForm.tsx`
(`autoRiesgo`, recalculado en cada cambio de colonia/municipio) y en
`editar/page.tsx` (recalculado al guardar). `PropertyDetailView.tsx` ya
pasa `property.riesgoInundacionFuente` a `FloodRiskBadge` en las dos
llamadas (badge completo y compacto). El import CSV masivo
(`importar/page.tsx`) deliberadamente NO manda el campo — un valor
tecleado en un CSV no es una detección automática, cae en
`'propietario'`, que es lo correcto.

**Corrección de copy, mismo día:** el texto de `FloodRiskBadge.tsx` para
`fuente === 'propietario'` decía "Este nivel fue reportado por quien
publicó la propiedad" — una afirmación específica que NO siempre es
cierta. `'propietario'` cubre "sin backfill" (propiedades de antes de
este cambio, cuyo valor SÍ pudo venir de una detección automática real
en su momento, solo que el backend no tiene forma de confirmarlo) además
de "ajustado a mano" — afirmar la segunda como si fuera la única causa es
la misma "cita falsa" que este sistema entero existe para evitar, solo
que en la dirección contraria. Corregido a un texto que no afirma
ninguna causa específica: "No podemos confirmar este nivel contra el
Atlas de Riesgos Municipal — puede que quien publicó lo haya ajustado, o
que la propiedad sea de antes de que pudiéramos verificarlo."

**Pendiente, del lado del backend, si se quiere reducir cuántas
propiedades caen en este caso ambiguo:** correr un backfill real —
recalcular `riesgoInundacionDetectado` para las propiedades existentes
usando la MISMA lógica que hoy corre en el frontend al publicar
(`zonas-inundacion.ts`, ya restringida a municipio Centro desde la
auditoría 2026-09-11) y comparar contra el `riesgoInundacion` guardado.
No es necesario — el backend ya decidió conscientemente no hacerlo
("lectura conservadora") — pero queda anotado como opción si en algún
momento se prioriza.

---

**Estado original de este documento (histórico, ya resuelto):**

**Por qué hace falta:** `Property.riesgoInundacion` (`alto|medio|bajo`)
es el único dato que manda el backend hoy — no dice si ese valor vino
de la detección automática real contra el Atlas de Riesgos Municipal
(`src/lib/zonas-inundacion.ts`, usado en `PublishForm.tsx`) o si lo
reportó/ajustó a mano quien publicó (el dueño SIEMPRE puede
sobreescribir el valor detectado, incluso bajarlo — con una
confirmación explícita para ese caso, ver `esDowngrade` en
`PublishForm.tsx`).

**Bug real que esto causaba** (corregido del lado del frontend, ver
`FloodRiskBadge.tsx`): la página pública de la propiedad afirmaba
SIEMPRE "según el Atlas de Riesgos Municipal", con cita específica
("Atlas de Riesgos del Municipio de Centro, 2023. Ayuntamiento de
Centro. P 377"), sin importar el origen real del valor. Un nivel
100% auto-reportado por el dueño (ej. una colonia sin registro en el
Atlas, donde el formulario ya avisa "Sin registros... selecciona
manualmente") podía terminar atribuido a un documento oficial que
nunca lo dijo — una cita falsa, no solo un dato impreciso.

**Fix aplicado ahora (frontend, mientras no exista el dato real):**
`FloodRiskBadge.tsx` ya no afirma ninguna fuente específica por
defecto — usa una leyenda neutral ("Este dato proviene de registros
públicos de inundación y/o de lo reportado por quien publicó la
propiedad"), honesta en los dos casos posibles sin inventar cuál es.

## Dato necesario

| Campo | Tipo | Qué significa |
|---|---|---|
| `riesgoInundacionFuente` | `'atlas' \| 'propietario'` | `'atlas'` si el valor guardado coincide con la última detección automática contra el Atlas en el momento de publicar/editar; `'propietario'` si la persona lo escribió o ajustó a mano (subió o bajó el nivel detectado, o lo llenó porque no había detección). |

Debe venir en la respuesta de `GET /propiedades/:id` (vista pública),
no solo en la de dueño — es la página pública la que hoy hace la
afirmación incorrecta.

## Frontend (ya listo para recibirlo)

`FloodRiskBadge` ya acepta una prop opcional `fuente?: 'atlas' |
'propietario'` — en cuanto el campo exista, pasar
`property.riesgoInundacionFuente` en las dos llamadas de
`PropertyDetailView.tsx` (líneas del badge completo y del badge
compacto) y el componente muestra la cita real del Atlas solo cuando
de verdad corresponde, o el aviso "reportado por quien publicó" cuando
no.
