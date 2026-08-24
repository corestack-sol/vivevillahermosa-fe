---
name: auditor-catalogos-geograficos
description: Audita los catálogos geográficos curados a mano de Vive Villahermosa (colonias.ts, landmarks.ts, zonasDestacadas.ts) por inconsistencias reales — nombres duplicados entre municipios, coordenadas fuera de Tabasco, entradas literalmente repetidas, referencias huérfanas — y las convierte en pruebas de Vitest reales, no en una lectura manual que hay que repetir cada vez. Usar cuando estos catálogos crecen (import nuevo, colonia agregada a mano) o antes de confiar en que "no debería haber duplicados".
---

# Auditor de catálogos geográficos curados

`src/lib/colonias.ts` (`COLONIAS_COORDS` + `COLONIAS_MUNICIPIOS`, ~753
entradas del import de INEGI), `src/lib/landmarks.ts`, y
`src/lib/zonasDestacadas.ts` son catálogos que **solo existen en el
frontend** — no hay backend ni base de datos verificando su consistencia.
El bug real de 85 colonias con el mismo nombre en municipios distintos
(que `matchColonia()` resolvía siempre al primero del arreglo) se
encontró por accidente escribiendo pruebas unitarias, no porque hubiera
una forma de pedir "audita estos catálogos". Esta skill existe para que
la próxima vez sea una pregunta directa, no un hallazgo de casualidad.

## Cuándo usar

- Se agrega/edita una entrada a mano en cualquiera de los 3 catálogos.
- Se vuelve a importar el catálogo INEGI de colonias (fuente del bug
  original) o cualquier fuente externa similar.
- Antes de confiar en un supuesto tipo "esta colonia es única" al escribir
  código nuevo que use `matchColonia()`/`getLandmark()`.

## Qué audita, concretamente

1. **Nombres de colonia duplicados entre municipios distintos** — no es
   un bug en sí (`matchColonia(nombre, municipioHint)` ya lo resuelve),
   pero la lista debe quedar enumerada y estable: si crece de forma
   inesperada, algo cambió en los datos de origen que vale la pena mirar.
2. **Entradas literalmente repetidas** — mismo nombre + mismo municipio +
   coordenada casi idéntica bajo DOS keys distintas (el caso real
   encontrado: `18-de-marzo-macuspana` y
   `18-de-marzo-macuspana-2701200910001`). Esto SÍ es un bug de datos —
   cero duplicados literales debería ser un assert que falla si aparece
   uno nuevo.
3. **Coordenadas inválidas** — `lat`/`lng` en `0,0`, `NaN`, o fuera del
   polígono real de Tabasco (`estaEnTabasco()` en
   `src/lib/tabascoBoundary.ts` ya existe para esto, reusarlo — no
   reinventar un bounding box nuevo).
4. **`municipio` huérfano** — un valor que no aparece en el catálogo
   canónico de los 17 municipios (`MUNICIPIO_CENTERS` en
   `src/lib/publishSchema.ts`) — típicamente un typo de captura.
5. **Referencias colgantes en `zonasDestacadas.ts`** — si una zona
   destacada apunta a un landmark/colonia por nombre, ese nombre debe
   resolver de verdad contra `landmarks.ts`/`colonias.ts`.
6. **`radioKm` fuera de rango razonable** en `landmarks.ts` — un radio de
   0 nunca matchea nada, uno absurdamente grande (ej. >20km) probablemente
   es un error de captura, no una decisión real.

## Flujo

1. Si no existe todavía, crear `src/lib/catalogosGeograficos.test.ts`
   (mismo patrón que el resto de `src/lib/*.test.ts` de esta sesión —
   Vitest, `environment: 'node'` por defecto salvo que se necesite algo
   del DOM).
2. Un `describe` por catálogo, un `it` por chequeo de la lista de arriba.
   Cada `it` que encuentre algo debe imprimir QUÉ encontró en el mensaje
   de fallo (no solo "falló") — quien lo lea después necesita saber qué
   corregir sin volver a escribir el chequeo.
3. Los duplicados de nombre-entre-municipios (#1) no son un `it` que
   falla — es un `it` que hace snapshot/assert de la CUENTA conocida hoy
   (o de la lista completa) para que un cambio inesperado se note en el
   diff, sin bloquear el catálogo por tener duplicados legítimos.
4. Correr `npx vitest run src/lib/catalogosGeograficos.test.ts` y arreglar
   cualquier hallazgo real (#2-#6) directamente en el catálogo, no
   silenciando el test.
5. Si algo se corrige, correr la suite completa
   (`npx vitest run`) — un catálogo cambiado puede afectar aserciones de
   `colonias.test.ts`/`filters.test.ts` que ya asumen los datos actuales.

## Ejemplo real (esta sesión)

Al escribir pruebas para `matchColonia()` con datos reales, un caso de
prueba con "Magisterial" devolvía silenciosamente la colonia de Centro en
vez de la de Paraíso — no porque el test estuviera mal, sino porque el
catálogo tenía las dos con el mismo nombre y el código no tenía forma de
distinguirlas. El fix real fue en dos partes: `matchColonia()` ganó un
`municipioHint`, y **esta clase de duplicado se volvió algo que se puede
enumerar a propósito** en vez de tropezarse con él de nuevo.

## Errores comunes a evitar

- Tratar CUALQUIER nombre duplicado entre municipios como un bug — la
  mayoría son legítimos (Tabasco tiene colonias con el mismo nombre en
  municipios distintos de verdad), el chequeo es que la lista no crezca
  sin que alguien lo note, no que llegue a cero.
- Escribir el chequeo una sola vez y no volver a correrlo — sin integrarlo
  a `npx vitest run` (que ya corre en esta sesión antes de cada commit),
  vuelve a ser un hallazgo de casualidad.
- Inventar un bounding box de Tabasco nuevo en vez de reusar
  `estaEnTabasco()`, que ya existe y ya está verificado.
