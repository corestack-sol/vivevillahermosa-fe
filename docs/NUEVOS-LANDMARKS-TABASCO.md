# Nuevos landmarks para `src/lib/landmarks.ts` — investigación 2026-08-12

> ⚠️ **Actualización — 2026-08-17, aplicado del lado del backend.** El párrafo original de abajo ("el catálogo de landmarks hoy vive en el frontend") **ya no es cierto** — el equipo de backend aplicó los 30 landmarks nuevos de este documento a su catálogo real (reporte recibido en `docs/message.txt`). Detalle:
>
> - Catálogo del backend: 88 → **118** landmarks (los 30 de este documento, cada uno con la fuente ya documentada aquí). Se hizo **solo en el backend, a propósito**, para no interferir con el trabajo en paralelo sobre este repo de frontend.
> - Endpoint nuevo: `GET /landmarks` (opcional `?categoria=salud|educacion|comercial|transporte|cultura|centro`), cache `public, max-age=300, stale-while-revalidate=3600` — mismo criterio que `/colonias/descubiertas` y `/zonas/colonias`. Respuesta: `{ key, label, categoria, lat, lng, radioKm, aliases? }[]` — mismo shape que `src/lib/landmarks.ts` ya usa, no cambia la forma.
> - Detalle completo del lado del backend: `BACKEND.md §9.4` de ese repo (no de este).
>
> **✅ Migración de frontend completada — 2026-08-17, mismo día.** `src/lib/landmarks.ts` reescrito: el array `LANDMARKS` hardcodeado (90 entradas + ~150 líneas de historial de verificación) se reemplazó por `precargarLandmarks()` (cliente, fire-and-forget, dispara desde `PropertiesClient.tsx`) + `obtenerLandmarksBackend()` (server-side, awaited, usado en `zonas/[slug]/page.tsx` y `propiedades/[id]/page.tsx`) — mismo patrón exacto que `colonias.ts`. `getLandmark`, `landmarksPorCategoria`, `distanciaMinimaACategoria` mantuvieron la misma firma, como se pedía. `LANDMARKS_VERIFICADO_EN`, `CATEGORIAS_GENERICAS`, `RADIO_CATEGORIA_KM`, `distanciaKm` se quedaron igual, no dependían del catálogo.
>
> **Probado en vivo, no solo compilado:** `GET /landmarks` real confirmado (118 resultados, filtro `?categoria=` funcionando) vía curl directo al backend; `npx tsc --noEmit` y `npx eslint` limpios en los 8 archivos tocados; servidor de desarrollo levantado y `/zonas/villahermosa` (Server Component) confirmado con un log temporal recibiendo los 118 landmarks reales del backend antes de quitarlo. El mapa y las fichas de propiedad ya usan la misma ruta de datos, no se probaron por separado porque comparten el mismo `obtenerLandmarksBackend`/`precargarLandmarks` ya verificado.
>
> **Archivos:** no quedó ningún archivo completo huérfano por este cambio — no existía un archivo de datos aparte para landmarks (a diferencia de lo que sí pasa con colonias), todo vivía dentro de `landmarks.ts` mismo, que se reescribió en el lugar. El historial de verificación de los 90 originales que vivía como comentario ahí (Nominatim, NotebookLM, búsqueda web, ronda por ronda) se resumió a una referencia — el detalle completo sigue disponible en `BACKEND.md §9.4` del backend y en el historial de git de este archivo hasta este commit.

> Para Claude trabajando en el backend separado (ver `docs/BACKEND.md` §9 — **nota: esa referencia describe el estado ANTES de la actualización de arriba**, el catálogo de landmarks ya no vive solo en el frontend). Este documento propone landmarks nuevos, reales y verificados, que no duplican nada del catálogo actual — no se generó ningún dato inventado.
>
> **Actualización — segunda ronda (2026-08-12), vía NotebookLM.** El usuario armó un cuaderno de NotebookLM con fuentes oficiales (Ayuntamiento de Centro, Portal Tabasco) y extrajo una tabla de ~19 lugares candidatos. Cada uno se cruzó contra el catálogo existente y, cuando no era duplicado, contra Nominatim + una fuente independiente más (nunca un solo origen) — ver sección "Segunda ronda" más abajo para el detalle completo, incluyendo lo que se descartó y por qué.

## Metodología

1. Se leyó el catálogo completo de 90 landmarks existentes (`src/lib/landmarks.ts`) para no duplicar nada.
2. Se identificaron huecos reales en "referencias cotidianas" — cosas que la gente de Tabasco de verdad usa para ubicarse, no categorías fabricadas.
3. Cada coordenada se verificó contra **Nominatim/OpenStreetMap** (mismo servicio que ya usa la plataforma para "colonias descubiertas", `docs/BACKEND.md` §9) — no son coordenadas aproximadas a mano.
4. `radioKm` de cada uno se calibró contra landmarks ya existentes de tamaño/función comparable (ver columna "Calibrado contra").

## El intento con NotebookLM

Se intentó alimentar un cuaderno de NotebookLM con esta información primero, pero **la skill instalada (`PleasePrompto/notebooklm-skill`) no tiene capacidad de agregar fuentes/documentos a un notebook** — solo puede autenticar, consultar notebooks que YA tienen fuentes cargadas manualmente, y administrar una librería local de URLs conocidas. No hay ningún script `add_source`/`upload` en el paquete. Se hizo la investigación directo (WebSearch + Nominatim), tal como ya estaba autorizado como plan B.

---

## Los 4 landmarks nuevos

### 1. Zona Arqueológica de Palenque (Chiapas, fuera de Tabasco a propósito)

Confirmado explícitamente por el usuario: está bien que el mapa se extienda hasta Palenque aunque quede en Chiapas — **un landmark no necesita estar dentro del polígono de Tabasco**, esa validación (`estaEnTabasco()`) solo aplica a las propiedades, no a los puntos de referencia. Gente de Tenosique (el municipio de Tabasco más cercano) usa Palenque como referencia real todo el tiempo — sitio UNESCO desde 1987, ~2.5km² de estructuras, y es la conexión física confirmada del Corredor Interoceánico con el Tren Maya (ver `tabasco-proptech/MONETIZACION.md`, investigación del mismo día).

```ts
{ key: 'zona-arqueologica-palenque', label: 'Zona Arqueológica de Palenque', categoria: 'cultura', lat: 17.4841438, lng: -92.0453236, radioKm: 5, aliases: ['palenque', 'ruinas de palenque', 'zona arqueológica palenque'] },
```

- **Fuente de coordenadas:** Nominatim (OpenStreetMap), `osm_id: 27638749`, tipo `tourism/attraction`, verificado en vivo.
- **Calibrado contra:** `puerto-dos-bocas` (radioKm 5) — mismo criterio, landmark de referencia regional grande, no de vecindario.

### 2. Estación Tenosique del Tren Maya

Primera estación del Tren Maya dentro de Tabasco (la ruta completa conecta después con Palenque, Chiapas, y Campeche) — inauguración confirmada, cubre exactamente el ángulo de "Corredor Interoceánico + Tren Maya" ya identificado como área de oportunidad en `tabasco-proptech/MONETIZACION.md`.

```ts
{ key: 'estacion-tren-maya-tenosique', label: 'Estación Tenosique del Tren Maya', categoria: 'transporte', lat: 17.4738860, lng: -91.4254588, radioKm: 1.5, aliases: ['estación tren maya', 'tren maya tenosique', 'estación del tren'] },
```

- **Fuente de coordenadas:** Nominatim, centro de Tenosique de Pino Suárez (`osm_id: 661606495`) — **no se encontró todavía un punto exacto de la estación en OpenStreetMap** (infraestructura muy reciente, aún no mapeada con detalle). Se usa el centro urbano como aproximación razonable — **recomendación: verificar contra un mapa oficial de Tren Maya antes de publicar, y ajustar si el punto real de la estación difiere del centro de la ciudad.**
- **Calibrado contra:** `central-camionera`/`central-autobuses-tabasco` (radioKm 1.5 ambas) — mismo tipo de hub de transporte.

### 3. Instituto Cumbres Villahermosa (primer colegio K-12, no universidad)

El catálogo actual tiene 14 landmarks de categoría `educacion` — **los 14 son universidades**. Cero colegios de educación básica/media, a pesar de ser una referencia cotidiana real y frecuente ("cerca del colegio de mis hijos"). Cumbres es una cadena nacional reconocida con presencia real en Villahermosa.

```ts
{ key: 'instituto-cumbres-villahermosa', label: 'Instituto Cumbres Villahermosa', categoria: 'educacion', lat: 18.0151393, lng: -92.9914952, radioKm: 1, aliases: ['cumbres', 'colegio cumbres'] },
```

- **Fuente de coordenadas:** Nominatim, `osm_id: 628702680`, tipo `amenity/school`, dirección confirmada (Carretera Loma de Caballo-Villahermosa, Anacleto Canabal 3ª Sección).
- **Calibrado contra:** `instituto-juarez` (radioKm 1) — mismo tipo de institución educativa de tamaño de plantel único.

### 4. Colegio Arjí

Colegio privado K-12 de Villahermosa, fundado en 1978 — larga trayectoria, referencia establecida en la ciudad.

```ts
{ key: 'colegio-arji', label: 'Colegio Arjí', categoria: 'educacion', lat: 17.9685507, lng: -92.9496642, radioKm: 1, aliases: ['arji', 'colegio arji'] },
```

- **Fuente de coordenadas:** Nominatim, `osm_id: 47007846`, tipo `amenity/school`, dirección confirmada (Periférico Carlos Pellicer Cámara, Tamulté de las Barrancas).
- **Calibrado contra:** mismo criterio que el punto 3.

---

## Tercera ronda — cuaderno NotebookLM, cobertura de los 16 municipios restantes (2026-08-12)

Se le preguntó directo al cuaderno (agregado a la librería: `https://notebook.google.com/notebook/021c18c7-4cfe-49f1-b090-5a844c20ff56`) por landmarks menos comunes, en dos preguntas (protocolo de la skill: nunca quedarse con la primera respuesta). La segunda pregunta trajo ~22 candidatos de los 16 municipios fuera de Centro/Comalcalco, que hoy apenas tienen su "centro de X" catalogado. Cada uno se cruzó contra Nominatim — nunca se aceptó nada solo porque el cuaderno lo mencionó.

### 9 nuevos landmarks, verificados por coordenada real

```ts
{ key: 'templo-san-antonio-cardenas', label: 'Templo San Antonio de Padua', categoria: 'cultura', lat: 17.9885638, lng: -93.3759406, radioKm: 1, aliases: ['san antonio', 'parroquia san antonio de padua'] },
{ key: 'el-bellote', label: 'El Bellote', categoria: 'comercial', lat: 18.4249776, lng: -93.1534410, radioKm: 2, aliases: ['corredor gastronómico el bellote'] },
{ key: 'templo-san-francisco-jalpa', label: 'Templo San Francisco de Asís (Jalpa de Méndez)', categoria: 'cultura', lat: 18.1764149, lng: -93.0626660, radioKm: 1, aliases: ['iglesia de jalpa'] },
{ key: 'zona-arqueologica-pomona', label: 'Zona Arqueológica de Pomoná', categoria: 'cultura', lat: 17.4849721, lng: -91.5704848, radioKm: 2, aliases: ['pomoná', 'pakbul'] },
{ key: 'museo-ventura-marin', label: 'Museo Ventura Marín Azcuaga', categoria: 'cultura', lat: 17.7451521, lng: -91.7650495, radioKm: 1, aliases: ['museo de zapata', 'museo ventura marín'] },
{ key: 'zona-arqueologica-moral-reforma', label: 'Zona Arqueológica Moral-Reforma', categoria: 'cultura', lat: 17.7682008, lng: -91.2991059, radioKm: 2, aliases: ['moral reforma'] },
{ key: 'grutas-de-cocona', label: 'Grutas de Coconá', categoria: 'cultura', lat: 17.5734021, lng: -92.9252851, radioKm: 1.5, aliases: ['las grutas', 'monumento natural grutas de coconá'] },
{ key: 'bosques-de-saloya', label: 'Bosques de Saloya', categoria: 'centro', lat: 18.0152722, lng: -92.9586371, radioKm: 2, aliases: ['la deportiva de saloya'] },
{ key: 'villa-sanchez-magallanes', label: 'Villa Sánchez Magallanes', categoria: 'centro', lat: 18.2969337, lng: -93.8563388, radioKm: 2.5, aliases: ['sánchez magallanes'] },
```

- **Fuente de coordenadas:** Nominatim, cada una con su `osm_id` propio (verificado en vivo, no en lote sin revisar).
- **`bosques-de-saloya` — nota de categoría:** es un fraccionamiento/zona residencial, no encaja perfecto en ninguna de las 6 categorías fijas — se usó `centro` por ser lo más cercano semánticamente (zona nombrada, no un edificio puntual). Juicio de criterio, no un hecho — revisar si se prefiere otra categoría al aplicarlo.
- **`villa-sanchez-magallanes` — coordenada aproximada:** Nominatim no tiene el centro del pueblo como tal, se usó la ubicación de un centro de salud dentro de la villa como referencia — aceptable para un radioKm de 2.5, pero menos preciso que el resto de esta lista.

### Descartados por ser redundantes con el catálogo ya existente (verificado por distancia real, no solo por nombre parecido)

- **Zona Arqueológica La Venta (Huimanguillo)** — geocodificada a ~350m de `villa-la-venta` ya catalogada (radioKm 3) — mismo lugar en la práctica.
- **Puerto de Frontera** — geocodificado dentro del radioKm 2.5 de `centla-centro` ya catalogado — no aporta cobertura nueva.
- **Centro Turístico El Paraíso / "Playa El Paraíso"** — el match de Nominatim fue a un club de playa específico distinto del nombre buscado (baja confianza) — no se agrega hasta verificar cuál es el lugar real.
- **Iglesia de Jalapa** — Nominatim solo devolvió el punto genérico del pueblo, ya cubierto por `centro de Jalapa` (existente) — sin valor agregado real.

### Mencionados por el cuaderno, sin coordenada confiable — NO agregados todavía

Terminal de Autobuses ADO (Cárdenas), Haciendas Cacaoteras/Hacienda La Luz (Comalcalco), Corredor Biji Yokotán (Nacajuca — además es una franja de 30km, difícil de fijar como un solo punto), Unidad Deportiva de Bosques de Saloya (distinto de la zona `bosques-de-saloya` ya verificada arriba — el punto específico de la unidad deportiva no salió en Nominatim), Casa Museo Gregorio Méndez (Jalpa de Méndez), Reserva Ecológica Agua Selva (Huimanguillo), Iglesia de las Mirandillas (Cunduacán — mencionada por las dos preguntas del cuaderno de forma independiente y consistente, con fecha 1724, probable que sea real, pero Nominatim no la tiene mapeada), Ex-convento de Santo Domingo (Oxolotán, Tacotalpa), Balneario El Azufre (Teapa).

**Por qué no se agregan igual con una coordenada aproximada:** a diferencia de la estación del Tren Maya (donde sí se usó el centro urbano como aproximación razonable, con el aviso explícito), aquí no hay ni siquiera un centro de referencia claro sin arriesgar una coordenada inventada — mejor dejarlos fuera y que la cola de "búsquedas no catalogadas" (ver Plan de Fase 1, anexo punto 9) recoja señal real de si la gente los busca antes de investigarlos más a fondo.

## Cuarta ronda — verificación manual del usuario en Google Maps (2026-08-12)

De los 9 pendientes de la ronda anterior, el usuario los buscó manualmente en Google Maps (evita el problema de ToS de scraping automatizado que se descartó como opción, ver anexo del Plan de Fase 1 punto 10 — esto es uso normal de Maps por una persona, no automatización) y copió las coordenadas reales del pin. Cada una se revisó contra landmarks ya verificados cercanos antes de aceptarla.

### 7 nuevos, verificados (coordenada real de Google Maps)

```ts
{ key: 'terminal-ado-cardenas', label: 'Terminal ADO Cárdenas', categoria: 'transporte', lat: 17.990162582027672, lng: -93.38517623019986, radioKm: 1.5, aliases: ['ado cárdenas', 'central de cárdenas'] },
{ key: 'hacienda-la-luz', label: 'Hacienda La Luz', categoria: 'cultura', lat: 18.268676895522006, lng: -93.22838141446053, radioKm: 1.5, aliases: ['haciendas cacaoteras', 'hacienda del cacao'] },
{ key: 'corredor-biji-yokotan', label: 'Corredor Biji Yokotán', categoria: 'comercial', lat: 18.17213515967089, lng: -93.01500913663412, radioKm: 2, aliases: ['biji yokotán', 'corredor de nacajuca'] },
{ key: 'agua-selva', label: 'Agua Selva', categoria: 'cultura', lat: 17.33834613944085, lng: -93.60358268214655, radioKm: 1.5, aliases: ['reserva ecológica agua selva'] },
{ key: 'iglesia-mirandillas', label: 'Iglesia de las Mirandillas', categoria: 'cultura', lat: 18.092032020675337, lng: -93.23417945361109, radioKm: 1, aliases: ['las mirandillas'] },
{ key: 'ex-convento-santo-domingo', label: 'Ex-convento de Santo Domingo (Oxolotán)', categoria: 'cultura', lat: 17.380998462652137, lng: -92.75028344554947, radioKm: 1, aliases: ['convento de oxolotán', 'santo domingo'] },
{ key: 'balneario-el-azufre', label: 'Balneario El Azufre', categoria: 'cultura', lat: 17.55243056980616, lng: -92.99771100321824, radioKm: 1.5, aliases: ['el azufre'] },
```

- **Fuente:** Google Maps, coordenada copiada manualmente por el usuario del pin real — no Nominatim esta vez, pedido explícito de diversificar fuentes.
- **`corredor-biji-yokotan` — nota:** el usuario buscó "radio yokotán" (posible estación de radio con ese nombre, no el corredor gastronómico mismo) — la coordenada puede no ser exactamente el corredor de 30km que describía el cuaderno. Verificar el nombre exacto antes de publicar si importa la precisión.

### 2 descartados por redundancia (confirmado por distancia, no por nombre)

- **Unidad Deportiva Bosques de Saloya** → a ~500m de `bosques-de-saloya` (ronda anterior, radioKm 2) — ya cubierta.
- **Casa Museo Gregorio Méndez** → a ~200m de `templo-san-francisco-jalpa` (ronda anterior, radioKm 1) — prácticamente el mismo punto.

Ambos casos son buena señal, no error: confirman que la coordenada de Nominatim (ronda 3) y la de Google Maps (ronda 4) apuntan al mismo lugar real.

## Quinta ronda — pendientes de Centro/Villahermosa, verificación manual del usuario (2026-08-13)

De los 3 pendientes de Centro/Villahermosa (Tabscoob, Tamulté, Traconis — ver arriba), el usuario buscó los 3 manualmente en Google Maps, más un cuarto lugar no solicitado que encontró de paso.

### 2 nuevos, verificados

```ts
{ key: 'monumento-tabscoob', label: 'Monumento a Tabscoob', categoria: 'cultura', lat: 17.997232088233137, lng: -92.90498558787075, radioKm: 1, aliases: ['tabscoob', 'glorieta tabscoob'] },
{ key: 'parque-la-polvora', label: 'Parque La Pólvora', categoria: 'cultura', lat: 17.983033347544666, lng: -92.92708174949706, radioKm: 1, aliases: ['la pólvora'] },
```

- **Fuente:** Google Maps, coordenada copiada manualmente por el usuario del pin real.
- **`monumento-tabscoob`:** a 4.3km de `monumento-sanchez-magallanes` (ya catalogado) — ambos son glorietas monumento de entrada a la ciudad, por carreteras distintas; no es duplicado, es un segundo monumento del mismo tipo.
- **`parque-la-polvora`:** ~700m del centro histórico (Zona Luz) — no fue uno de los 3 pendientes originales, lo agregó el usuario de paso; geografía consistente con el resto del catálogo de Centro.

### 1 sigue sin match — Parque Juan Bautista Traconis / "Parque de la Corregidora"

Búsqueda manual del usuario tampoco lo encontró. Ver nota arriba — queda pendiente.

### 1 ambiguo, no se fuerza el match — Parque de Tamulté

Ver sección "Ambiguo" arriba — 6 candidatos reales en la zona, ninguno confirmado como el que nombraba el cuaderno originalmente.

## Total acumulado del día

**27 landmarks nuevos, verificados, listos para agregar** (4 + 9 + 7 + 2 + 5 de las cinco rondas con coordenada confirmada) — ninguno inventado, cada uno con su fuente y método documentado arriba. Queda **1 sin match** (Traconis) y **5 mencionados sin verificar** de otros municipios (ver ronda 3) para cuando la cola de "búsquedas no catalogadas" traiga señal real de que vale la pena investigarlos.

## Nota sobre categorías no cubiertas

Se investigó también bancos y gimnasios/clubes deportivos como posibles referencias cotidianas — se decidió **no incluirlos en esta ronda**: la categoría `LandmarkCategoria` de `landmarks.ts` es un enum fijo (`salud | educacion | comercial | transporte | cultura | centro`) y ninguna de las dos encaja con suficiente precisión sin forzar la clasificación (una sucursal bancaria no es lo mismo que un centro comercial como `Galerías Tabasco`, categorizado como `comercial` por ser un destino real, no un trámite puntual). Mejor dejarlos fuera que forzar una categoría que no describe bien el lugar — mismo criterio de honestidad que ya rige el resto del catálogo.

## Segunda ronda — vía cuaderno de NotebookLM (2026-08-12)

Tabla de ~19 candidatos extraída por el usuario de un cuaderno de NotebookLM con fuentes oficiales. Cada fila se cruzó primero contra los 90 landmarks ya existentes (incluyendo los 4 de la primera ronda, arriba), y cuando no era duplicado, contra Nominatim + al menos una fuente independiente antes de aceptarlo — pedido explícito del usuario de no depender solo de Nominatim esta vez.

### Descartados por ser duplicados reales (ya están en el catálogo)

Laguna de las Ilusiones, Parque Tomás Garrido Canabal (= "Parque Tabasco" ya catalogado), Parque Manuel Mestre (= "Parque de los Abuelos" ya catalogado), Terminal de Autobuses de Tabasco/Segunda Clase (= `central-autobuses-tabasco`), Mercado José María Pino Suárez, Mercado Coronel Gregorio Méndez Magaña, Mercado Miguel Orrico de los Llanos, Plaza Altabrisa — los 8 ya existían tal cual.

### Descartados tras verificar (parecían nuevos, resultaron redundantes)

- **Complejo Cultural CICOM / "Biblioteca Pino Suárez"** — geocodificado a 386m de la "Zona CICOM" ya catalogada (radio existente 1.2km) — misma zona, no un landmark aparte.
- **Terminal de Autobuses de Primera Clase / "Terminal ADO Mina"** — geocodificado a ~968m de la "Central de Autobuses ADO" ya catalogada (radio existente 1.5km) — mismo criterio, dentro del radio ya cubierto.
- **Deportivo Olimpia XXI** — confirmado por 3 fuentes independientes que está **dentro** del "Parque Tabasco" ya catalogado (radio 2km) — no es un landmark aparte, es una instalación dentro de uno que ya existe.
- **"Villahermosa" con apodo "La Esmeralda del Sureste"** — real (Nominatim lo confirma como ciudad), pero no aplica al esquema de landmarks: es la ciudad completa, no un punto de proximidad — "cerca de Villahermosa" no es una búsqueda que tenga sentido dentro de Villahermosa misma.

### Nuevos, verificados con coordenadas reales — listos para agregar

```ts
{ key: 'monumento-sanchez-magallanes', label: 'Monumento a Andrés Sánchez Magallanes', categoria: 'cultura', lat: 17.992167, lng: -92.945194, radioKm: 1, aliases: ['la chichona', 'monumento sánchez magallanes'] },
{ key: 'parque-pajaritos', label: 'Parque Rosario María Gutiérrez Eskildsen', categoria: 'cultura', lat: 17.9902735, lng: -92.9199656, radioKm: 1, aliases: ['parque de los pajaritos', 'los pajaritos'] },
{ key: 'centro-recreativo-atasta', label: 'Centro Recreativo de Atasta', categoria: 'cultura', lat: 17.9864124, lng: -92.9421057, radioKm: 1.2, aliases: ['parque de atasta'] },
```

- **Monumento a Sánchez Magallanes ("La Chichona"):** coordenadas de la infobox de Wikipedia (17°59′31.8″N 92°56′42.7″W) — construido 1967-1969, símbolo reconocido de la ciudad, el apodo por el que la gente realmente lo nombra está confirmado por múltiples fuentes independientes (Wikipedia, prensa local, hasta una nota sobre un comentario de AMLO al respecto).
- **Parque de los Pajaritos:** nombre oficial real es "Parque Profa. Rosario María Gutiérrez Eskildsen" — coordenadas Nominatim usando ese nombre oficial (el alias coloquial no se encontraba solo, hubo que dar con el nombre real primero vía prensa local). Dirección coincide exactamente con la que dio la tabla del usuario (Ignacio Zaragoza esq. 5 de Mayo).
- **Centro Recreativo de Atasta:** confirmado directo en Nominatim con ese nombre exacto.
- `radioKm` calibrado contra parques ya existentes de tamaño similar (`parque-juarez`, radioKm 1).

### Reales pero sin coordenada verificable todavía — no agregar sin confirmar más

- **Parque Juan Bautista Traconis ("Parque de la Corregidora")** — la dirección que dio la tabla es plausible (colonia/calle real), pero ninguna búsqueda independiente (Nominatim, web, ni Google Maps manual — el usuario lo intentó en la quinta ronda, sin match) encontró este lugar nombrado específicamente así. Puede que exista con otro nombre oficial (como pasó con "Pajaritos"), o que NotebookLM haya combinado/confundido información de sus fuentes. **No se agrega hasta confirmar.**

### Tamulté — 5 lugares reales distintos, no un solo "Parque de Tamulté" (corrección del criterio inicial)

El cuaderno mencionaba "Parque de Tamulté" como si fuera un solo lugar; la búsqueda manual del usuario en Google Maps encontró 5 lugares reales y **distintos** dentro de esa zona (el error fue mío al tratarlos como candidatos a un mismo nombre en vez de lugares independientes que simplemente comparten radio). Se agregan los 5 con sus propias coordenadas:

```ts
{ key: 'parque-jose-clara-garcia', label: 'Parque José Clara García', categoria: 'cultura', lat: 17.972705051595717, lng: -92.95743714870548, radioKm: 1, aliases: [] },
{ key: 'parque-vaso-regulador-tamulte', label: 'Parque Recreativo Vaso Regulador Tamulté', categoria: 'cultura', lat: 17.97343983220726, lng: -92.96258698972706, radioKm: 1, aliases: ['vaso regulador'] },
{ key: 'tamulte-de-las-barrancas', label: 'Tamulté de las Barrancas', categoria: 'centro', lat: 17.976643510387653, lng: -92.95381238727168, radioKm: 1.5, aliases: ['tamulté'] },
{ key: 'mercado-de-tamulte', label: 'Mercado de Tamulté', categoria: 'comercial', lat: 17.977949755784937, lng: -92.95621564641509, radioKm: 1, aliases: [] },
{ key: 'parque-guadalupe-lemus-moncayo', label: 'Parque Mtra. Guadalupe Lemus Moncayo', categoria: 'cultura', lat: 17.977623195341543, lng: -92.9634254238453, radioKm: 1, aliases: [] },
```

- **Fuente:** Google Maps, coordenada copiada manualmente por el usuario del pin real de cada uno.
- **`tamulte-de-las-barrancas`:** categoría `centro`, mismo criterio que `bosques-de-saloya`/`villa-sanchez-magallanes` (zona/colonia nombrada, no edificio puntual) — a ~1km de `colegio-arji` ya catalogado, corrobora que es la misma zona real.
- Los 5 quedan a menos de 1km entre sí (cluster urbano denso, mismo patrón que ya existe cerca del Centro con varios mercados/parques distintos a poca distancia) — se mantienen separados porque son lugares con nombre e identidad propia, no el mismo punto repetido.
- **"Parque central de Tamulté de las Sabanas" (18.168620, -92.783034) sigue descartado** — es un pueblo distinto en el municipio de Nacajuca, no esta colonia Tamulté de Centro/Villahermosa.

## Para aplicar en el backend

Los bloques `{ key: ..., ... }` de este documento (4 de la primera ronda + 3 de la segunda) están en el formato exacto de `src/lib/landmarks.ts` (`export const LANDMARKS: Landmark[]` — mismo array). Si el backend nuevo va a tener su propio catálogo de landmarks (aún no existe, ver `docs/BACKEND.md` §3, nota de `zonaDestacada`/landmarks), estos 7 registros confirmados son el punto de partida — cada uno con su fuente de verificación documentada arriba, no un dato inventado. Los 3 casos pendientes (Tabscoob, Tamulté, Traconis) quedan fuera hasta que alguien confirme la coordenada o la existencia del lugar tal como se nombró.
