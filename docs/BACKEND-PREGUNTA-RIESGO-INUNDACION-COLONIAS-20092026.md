# Pregunta para backend: ¿cómo se establece el nivel de riesgo de inundación de una colonia?

**Estado: PENDIENTE DE RESPUESTA**
**Fecha: 20/09/2026**

## Lo que ya sabemos del lado del frontend (verificado en código, no supuesto)

Hoy la clasificación de riesgo por colonia es **100% frontend**, sin
ninguna lógica ni dato equivalente del lado del backend:

- Vive en `src/lib/zonas-inundacion.ts` — un catálogo de ~150 patrones de
  texto (nombre de colonia → `alto`/`medio`/`bajo`), escrito a mano.
- Fuente citada en el propio archivo: *Atlas de Riesgos del Municipio de
  Centro, 2023* (Ayuntamiento de Centro, p. 377), con su metodología
  (LIDAR 1m/píxel, simulación hidráulica IBER, periodos de retorno de
  2 a 500 años, categorías de tirante de agua colapsadas a 3 niveles).
- **Restringido a municipio Centro únicamente** — candado agregado el
  11/09/2026 tras una auditoría: como el Atlas solo cubre Centro,
  `detectarRiesgoInundacion()` devuelve `null` de inmediato para
  cualquier otro municipio. Los otros **16 de 17 municipios no tienen
  ninguna clasificación de riesgo**, ni en frontend ni en backend.
- Se usa para **sugerir** un valor en 2 momentos (publicar, editar) y
  para 2 usos secundarios (coach de calidad de anuncio, badge informativo
  en la página del municipio). Nunca es obligatorio — quien publica
  siempre puede sobrescribirlo, incluso bajarlo (con una confirmación
  extra solo en ese caso).

Lo que sí hace el backend (contrato ya implementado, ver histórico abajo):
recibe `riesgoInundacionDetectado` (lo que el frontend calculó ANTES de
que la persona lo ajustara), lo compara contra `riesgoInundacion` (el
valor final guardado), y de esa comparación deriva
`riesgoInundacionFuente: 'atlas' | 'propietario'` — que se muestra en la
ficha pública. El backend **no tiene su propio Atlas ni polígonos**: solo
arbitra entre lo que el frontend le mandó y lo que la persona guardó.

## Hallazgo aparte: archivo sin uso

`src/data/flood-zones.json` es un GeoJSON con polígonos de riesgo por
colonia (Centro Histórico, Gil y Sáenz, Atasta, …). **Ningún archivo del
repositorio lo importa ni lo lee** (confirmado por búsqueda completa en
el código). Parece un enfoque anterior — reemplazado por el catálogo de
texto de `zonas-inundacion.ts` — que nunca se borró.

## Lo que necesitamos que confirmen

1. ¿El backend tiene alguna fuente de datos o lógica propia de riesgo de
   inundación (Atlas, capa GIS, tabla propia) para cualquier municipio, o
   confirman que hoy depende por completo de lo que el frontend calcula y
   envía como `riesgoInundacionDetectado`?
2. ¿Existe algún plan (interno o con Protección Civil / IMPLAN del
   estado) para conseguir un Atlas de riesgos de los otros 16 municipios?
   Hoy esas propiedades se publican sin ninguna ayuda ni verificación,
   solo lo que el dueño declara a ciegas.
3. ¿`src/data/flood-zones.json` corresponde a algo que ustedes generaron
   o esperaban consumir? Si no, lo marcamos para borrar en el frontend
   por ser código muerto.
4. En el contrato ya implementado (ver histórico abajo), quedó anotado
   que un backfill de `riesgoInundacionFuente` para propiedades viejas
   "no es necesario, decisión consciente del backend (lectura
   conservadora)". ¿Sigue en pie esa decisión, o cambió algo desde el
   11/09/2026?

## Histórico — contrato de `riesgoInundacionFuente` (implementado, referencia)

Documento original archivado el 16/09/2026 por limpieza manual
(`docs/BACKEND-FUENTE-RIESGO-INUNDACION-11092026.md`, recuperado de
`git show d8bc5a8~1:docs/BACKEND-FUENTE-RIESGO-INUNDACION-11092026.md`
para no perder el contexto). Resumen de lo ya implementado y en
producción:

- `POST /propiedades` y `PATCH /propiedades/:id` reciben
  `riesgoInundacionDetectado?: 'alto'|'medio'|'bajo'|null`.
- `GET /propiedades/:id` (pública y de dueño) devuelve
  `riesgoInundacionFuente: 'atlas'|'propietario'` — `'atlas'` SOLO si
  `riesgoInundacion` coincide exacto con `riesgoInundacionDetectado`;
  `'propietario'` en cualquier otro caso, incluyendo propiedades de antes
  de este cambio (sin backfill, decisión consciente del backend).
- El import CSV masivo deliberadamente no manda el campo — cae en
  `'propietario'`, correcto porque un valor tecleado en un CSV no es una
  detección automática.
- `FloodRiskBadge.tsx` ya no afirma una fuente específica por defecto:
  muestra la cita real del Atlas solo cuando `fuente === 'atlas'`, y un
  texto neutral en cualquier otro caso ("no podemos confirmar este nivel
  contra el Atlas… puede que lo hayan ajustado, o que la propiedad sea de
  antes de que pudiéramos verificarlo").

---

## Actualización 20/09/2026 — verificación real completa, cambio aplicado ya en frontend

Se extrajo el texto completo de las 380 páginas del Atlas real
(`pdftotext -enc UTF-8`, PDF de 244MB en `tabasco-proptech/`, ignorado por
git) y se comparó cada una de las 88 zonas del catálogo (`zonas-inundacion.ts`)
contra ese texto:

- **64 de 88 (73%)** aparecen citadas literalmente (nombre exacto, evento
  histórico con fecha, o figura de escenarios de anegamiento con su nombre).
- **24 de 88 (27%)** — 10 de ellas "alto" — no aparecen en ningún lado del
  documento. El nivel viene de inferir el riesgo del distrito completo al
  que pertenece la colonia, sin que el Atlas la nombre.
- Se investigó si "inferir por distrito" era razonable como reemplazo: NO
  lo es. El propio Atlas describe riesgo distinto calle por calle DENTRO
  de un mismo distrito (ej. Centro Histórico: una cuadra sin anegarse
  desde los años 80 por un cárcamo bien ubicado, la de al lado hasta 50cm
  en lluvia fuerte, según el texto real de la página 235). Ni un polígono
  de distrito perfectamente trazado resolvería esto — así que no se
  construyó ninguno.

**Bug real encontrado y corregido en el frontend**: `riesgoInundacionDetectado`
(lo que ustedes usan para derivar `riesgoInundacionFuente: 'atlas'`) se
mandaba igual para las 64 confirmadas Y las 24 inferidas. Eso significa que
hasta hoy, una propiedad en una de esas 24 colonias podía terminar con
`fuente: 'atlas'` y la ficha pública citando el Atlas real (con página) para
un lugar que el documento nunca menciona — la misma "cita falsa" que este
sistema se construyó para evitar, reintroducida por una fuente distinta.
Ya corregido: `riesgoInundacionDetectado` ahora es `null` para las 24
zonas no citadas, tanto al publicar como al editar. No requiere ningún
cambio de su lado — el contrato (`riesgoInundacionDetectado` /
`riesgoInundacionFuente`) no cambia, solo mejoró qué tan seguido el
frontend lo usa correctamente.

**Nuevo, solo frontend por ahora**: `riesgoPorCercania()` — cuando una
colonia no está en el catálogo en absoluto, busca la zona CONFIRMADA
(citada en Atlas) más cercana dentro de 1km (usando coordenadas reales de
`colonias.ts`) y se lo muestra a quien publica como una referencia
informativa ("a 0.4km hay una colonia con historial alto — no significa
que aquí sea igual"). Nunca llena `riesgoInundacionDetectado` ni ningún
campo que ustedes traten como detección real — es puramente informativo
para quien está publicando, para ayudarlo a decidir su propia selección
manual con más contexto, no una fuente nueva de verdad.
