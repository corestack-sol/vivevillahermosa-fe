# Nombres populares de colonias en Tabasco — investigación y fix

**Fecha:** 2026-09-04
**Origen:** reporte real del usuario — buscar "colonia petrolera" no encontraba la propiedad real en esa colonia (nombre oficial: Heriberto Kehoe Vicent, Centro).
**Método:** lectura del código real (`src/lib/colonias.ts`, `src/lib/filters.ts`) + verificación en vivo contra el backend de producción + investigación web de nombres populares reales y verificables.

---

## 1. Causa raíz — no era falta de datos, era falta de alias

`src/lib/colonias.ts` ya tenía toda la infraestructura necesaria construida de antes:

- `ColoniaCoord.aliases?: string[]` — el campo ya existía (otras colonias como Pino Suárez o Club Campestre ya lo usaban).
- `matchColonia(nombre, municipioHint?)` — ya compara contra `label` + `aliases`, ya tolera typos, y ya resuelve ambigüedad cuando el mismo nombre existe en más de un municipio (caso real ya resuelto antes: "Magisterial" existe en Centro, Cunduacán, Huimanguillo, Macuspana, Paraíso y Tenosique).

El problema real: la colonia **Heriberto Kehoe Vicent** (key `heriberto-kehoe-vicent`, Centro) no tenía ningún alias registrado — nadie le había agregado "Petrolera" a su lista de `aliases`. Verificado en vivo contra producción (`POST /ia/busqueda-inteligente`) que la IA del backend, al no reconocer "Petrolera" como colonia catalogada, la trataba como un nombre literal válido — y por casualidad **sí existe** una entrada real con ese nombre en `colonias-municipios.json` (catálogo estatal de 753 nombres), pero ubicada en **Cárdenas**, no en Centro.

## 2. "Petrolera" es un nombre real compartido por DOS lugares distintos

Investigación confirmó que ambos son reales:

1. **Fraccionamiento Heriberto Kehoe Vicent** (Centro/Villahermosa) — nombre oficial, apodado popularmente "Petrolera" o "La Petrolera" por los propios vecinos y por inmobiliarias locales (AMPI Villahermosa, KW México, propiedades.com lo listan indistintamente con ambos nombres).
2. **Colonia Petrolera** (Cárdenas, Tabasco) — localidad real catalogada por INEGI, C.P. 86597, ~2,130 habitantes. Ese es el nombre OFICIAL de ese lugar, no un apodo.

No era un dato erróneo en el catálogo — eran dos lugares reales con el mismo nombre popular, en municipios distintos.

## 3. El fix

Una línea por colonia, en `src/lib/colonias.ts`:

```ts
{ key: 'heriberto-kehoe-vicent', label: 'Heriberto Kehoe Vicent', municipio: 'Centro', ...,
  aliases: ['Petrolera', 'La Petrolera', 'Colonia Petrolera'] },
```

**Por qué esto resuelve la ambigüedad correctamente, sin trabajo extra:** `todasLasColonias()` concatena el catálogo curado de Centro (`COLONIAS_COORDS`) **antes** que el catálogo estatal completo (`COLONIAS_MUNICIPIOS`, donde vive la Petrolera de Cárdenas). `matchColonia()` sin pista de municipio devuelve el primer match — o sea, Centro gana por defecto. Si alguien especifica `municipioHint: 'Cárdenas'` (porque la IA sí lo extrajo, o el usuario lo escribió), la rama `exactoEnMunicipio` de `matchColonia()` sigue resolviendo correctamente a la Petrolera real de Cárdenas. **Esto ya cumple, para este caso concreto, el pedido de "sin municipio especificado, el resultado cae en Centro por defecto."**

Verificado con 3 tests nuevos en `src/lib/colonias.test.ts` (37/37 pasan):
```ts
expect(matchColonia('Petrolera')?.key).toBe('heriberto-kehoe-vicent');       // sin pista -> Centro
expect(matchColonia('Petrolera', 'Cárdenas')?.key).toBe('petrolera');          // con pista -> Cárdenas real
```

## 4. Otros 2 alias reales agregados en la misma pasada

Investigados y verificados con fuentes reales (no inventados):

| Colonia oficial | Alias agregado | Fuente |
|---|---|---|
| Centro Histórico (Villahermosa) | **Zona Luz** | Designación oficial "Barrio Mágico", usada indistintamente en medios, Facebook oficial de la zona y Wikipedia — [Zona Luz, el nuevo Barrio Mágico de Tabasco](https://www.mexicodesconocido.com.mx/zona-luz-el-nuevo-barrio-magico-de-tabasco.html), [Centro histórico de Villahermosa — Wikipedia](https://es.wikipedia.org/wiki/Centro_hist%C3%B3rico_de_Villahermosa) |
| Tabasco 2000 | **T2000** | Usado en planeación oficial ("Plan 2030... relanzamiento de T2000") — [De Tabasco 2000 a Villahermosa 2030](https://novedadesdetabasco.com.mx/2026/06/26/de-tabasco-2000-a-villahermosa-2030/) |

## 5. Lo que NO se agregó, y por qué

Se investigaron también "Indeco", "Casa Blanca", "Real de Minas", "Deportiva Residencial" y varios nombres de calles históricas de Villahermosa (detabascosoy.com) — ninguno tiene un alias popular distinto **verificable** con una fuente real; son solo el nombre oficial de siempre. Se prefirió no inventar apodos que "suenan lógicos" pero no están confirmados — mismo criterio que ya sigue este proyecto en otras investigaciones (nunca fabricar datos sin fuente).

## 6. Cómo encontrar más alias reales, hacia adelante (recomendación)

Adivinar apodos populares uno por uno vía búsqueda web tiene rendimientos decrecientes — ya se agotaron las señales fáciles de encontrar. La fuente más confiable a partir de aquí es el propio uso real de la plataforma: cuando `matchColonia()` devuelve `undefined` para un texto que de todos modos parece un nombre de lugar (la IA no lo pudo anclar a nada), eso es exactamente la señal de "posible apodo sin catalogar". Vale la pena, más adelante, registrar esos casos (mismo espíritu que `precargarColoniasDescubiertas()`, que ya existe para colonias nuevas descubiertas vía backend) en vez de seguir adivinando a mano.

## 7. Pendiente — requiere una decisión, no lo implementé solo

El pedido de "sin municipio especificado, los primeros resultados deben caer en Centro" tiene dos alcances distintos:

- **Para colisiones de nombre ambiguo** (como Petrolera) — ✅ ya resuelto, ver §3.
- **Para el ORDEN GENERAL de resultados** (`/propiedades` sin ningún filtro de lugar) — el sistema YA tiene una prioridad "Centro primero" (`src/lib/filters.ts`, `PRIORIDAD_MUNICIPIO`, derivada de `MUNICIPIO_CENTERS` donde `'Centro'` ya es la primera clave), pero **solo como último desempate**, después de destacado → con fotos → más reciente. Si dos propiedades empatan en todo lo demás, gana Centro — pero una propiedad destacada de Cárdenas sigue apareciendo antes que una de Centro sin destacar, porque "destacado" pesa más que municipio en el orden actual.

No lo cambié porque mover la prioridad de Centro más arriba (antes que "destacado") chocaría con una decisión de negocio ya tomada explícitamente ("ordenar como lo hacen las grandes empresas — destacado primero", pedido 2026-09-02) — eso afecta directamente el valor de destacar una propiedad pagada en otro municipio. Prefiero que decidas tú si quieres que Centro le gane a "destacado", o si el desempate actual (Centro solo como último criterio) ya es suficiente.
