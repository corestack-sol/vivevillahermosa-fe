# Backend — sistema de 3 niveles de fraude + panel admin (2026-08-31)

Pedido explícito del dueño del producto: hoy el análisis de fraude (`POST
/ia/analizar-fraude`) clasifica en `bajo`/`medio`/`alto`, pero **ningún
nivel bloquea de verdad publicar** — solo `bloqueado` (un flag aparte, para
texto extremo que ni describe una propiedad real) lo hace. El frontend ya
corrigió su parte (`riesgo === 'alto'` ahora bloquea el formulario), pero
eso es **solo del lado del cliente** — cualquiera que llame a `POST
/propiedades` directo, sin pasar por el formulario, no lo ve. Esto no es
opcional: sin el punto 1 de abajo, todo lo demás de este documento es
cosmético.

También hay una pregunta de fondo que motiva la mitad de este documento:
**¿qué pasa cuando alguien reescribe el texto para dejar de activar el
detector, sin dejar de ser fraudulento?** Ningún clasificador de solo texto
resuelve esto solo — mostrarle a la persona evaluada exactamente qué frase
la marcó es, sin querer, un manual de cómo evadir la próxima vez. La
respuesta no es un mejor prompt, es no depender de un solo tipo de señal.
Este documento agrega señales que reescribir el texto NO cambia.

---

## 1. Nivel "alto" debe bloquear también en el servidor — 🔴 urgente

**Hoy:** `POST /propiedades` ya rechaza un caso extremo (confirmado en vivo
esta sesión: texto tipo "registro técnico/verificación" → rechazo directo),
pero no hay confirmación de que rechace TODO lo que `/ia/analizar-fraude`
clasifica como `riesgo: "alto"`. Si no lo hace, el bloqueo del formulario es
puramente cosmético — un estafador con conocimientos técnicos básicos lo
evade con una sola llamada directa a la API.

**Se necesita:** que `POST /propiedades` vuelva a correr la misma
clasificación de fraude sobre `titulo`/`descripcion` (server-side, nunca
confiar en que el cliente ya lo hizo — mismo criterio que ya se aplica a
`estaEnTabasco()` en las coordenadas) y rechace con 400/403 si el resultado
es `alto` o `bloqueado`. Confirmar esto es el paso #1, antes que cualquier
otra cosa de este documento.

---

## 2. Nueva tabla `IntentoFraude` — historial real, no solo el intento actual

Hoy cada llamada a `/ia/analizar-fraude` se evalúa y se olvida — no hay
registro de que una cuenta ya intentó publicar algo similar antes. Sin
esto, "reescribir el texto" resetea todo a cero cada vez.

```
IntentoFraude
  id               String   @id @default(cuid())
  userId           String
  propiedadId      String?  // null mientras es un borrador, se llena si sí se llegó a crear la propiedad
  titulo           String
  descripcion      String
  riesgo           String   // 'medio' | 'alto'
  bloqueado        Boolean  @default(false)
  motivoBloqueo    String?
  señales          String   // JSON string (array) — SQLite no soporta arrays nativos, mismo patrón que AlertaFoto
  exifDistanciaKm  Float?   // ver punto 4
  contactoReutilizado Int   @default(0) // ver punto 4
  createdAt        DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
```

- Se escribe en `POST /ia/analizar-fraude` cada vez que el resultado es
  `medio` o `alto` (nunca para `bajo` — no tiene sentido acumular ruido de
  anuncios sanos).
- `bajo` nunca se guarda aquí — evita que la tabla crezca sin límite con
  cada tecleo del debounce del formulario (el frontend re-evalúa cada
  1.5s mientras se escribe, ver `PublishForm.tsx`).
- Considerar un límite razonable de frecuencia por usuario (ej. no guardar
  más de 1 fila por minuto por cuenta) para que el debounce del cliente no
  genere decenas de filas idénticas mientras alguien edita su descripción.

---

## 3. `GET /admin/intentos-fraude` — cola de revisión para el panel admin

El frontend ya tiene la página lista: `/admin/fraude`
(`src/app/admin/fraude/page.tsx`) — hoy muestra un estado vacío honesto
("el backend todavía no expone esta cola") hasta que este endpoint exista.
Mismo patrón que `/admin/intentos-sospechosos` y `/admin/reportes` ya
implementados.

```
GET /admin/intentos-fraude?page=1&riesgo=alto
Respuesta:
{
  intentos: [{
    id, userId, propiedadId, titulo, riesgo, bloqueado, motivoBloqueo,
    señales: string[],           // ya parseado de JSON a array
    exifDistanciaKm: number|null,
    contactoReutilizado: number,
    createdAt,
    intentosMismoUsuario: number, // COUNT(*) de IntentoFraude de este mismo userId, ver punto 5
    user: { id, email, nombre, bloqueado }
  }],
  total, page, perPage
}
```

- `riesgo` query param opcional: `alto` | `medio` | ausente (trae ambos).
- Requiere `requireAdmin()`, mismo gate que el resto de `/admin/**`.
- El botón "Bloquear" de esta página **reusa** `POST
  /admin/usuarios/:id/bloquear` que ya existe — no hace falta un endpoint
  nuevo para eso.
- Agregar `intentosFraude: <count total>` a la respuesta de `GET
  /admin/metricas` — el tile ya está listo en `/admin/page.tsx`, oculto
  solo mientras el campo no exista.

---

## 4. Señales que el texto reescrito NO puede evadir

El frontend ya calcula y manda dos de estas — **hoy se ignoran en
silencio** (confirmado en vivo: `POST /ia/analizar-fraude` con query
params desconocidos responde 201 normal, no rompe nada, pero tampoco hace
nada con ellos todavía):

### 4.1. GPS de foto que contradice la ubicación declarada

`?exifDistanciaKm=N` — el frontend ya lee el EXIF de cada foto subida
(`analizarGPSFoto()` en `PublishForm.tsx`, mismo mecanismo que ya usa para
sugerir el pin cuando SÍ coincide). Cuando el GPS de una foto está a más de
3km de la colonia declarada (o 20km del centro del municipio, si la colonia
no está catalogada), manda esta distancia. Una foto reciclada de otro
anuncio/lugar trae el GPS real de donde se tomó — no se puede "corregir"
reescribiendo el título.

**Se necesita:** que el backend lea este query param y lo:
1. Considere como señal adicional en la clasificación de riesgo (ej. sube
   de `bajo`/`medio` a `medio`/`alto` si la distancia es grande).
2. Guarde en `IntentoFraude.exifDistanciaKm` para que se vea en el panel.

### 4.2. Contacto reutilizado

`?contactoReutilizado=N` — el frontend ya cuenta, al llegar al paso de
Contacto, cuántas OTRAS propiedades activas usan el mismo teléfono/WhatsApp
(consulta al catálogo público completo, sin datos privados). Un agente/
casero real con varias propiedades también da un número aquí — **por eso
nunca debe ser suficiente por sí solo**, es una señal más, no una
acusación.

**Se necesita:** mismo tratamiento — leer el query param, considerarlo en
la clasificación combinada, guardarlo en `IntentoFraude.contactoReutilizado`.

### 4.3. Reincidencia de la cuenta (el más importante de los tres)

Este es el que de verdad ataca "reescribir el texto para evadir": contar
cuántas veces esta MISMA cuenta ya aparece en `IntentoFraude` con
`riesgo IN ('medio','alto')`, sin importar si el texto cambió entre
intentos. Reescribir el título no borra el historial.

**Se necesita:**
- `intentosMismoUsuario` en la respuesta de `GET /admin/intentos-fraude`
  (ya especificado arriba) — para que el panel lo muestre.
- Recomendado (mismo patrón ya validado en producción por
  `src/lib/moderacionBusqueda.ts`, 3 strikes para manipulación del
  buscador): si una cuenta acumula **3 intentos `alto`** (o alguna
  combinación medio+alto que el equipo defina), bloquear la cuenta
  automáticamente en el próximo intento, sin esperar a que un admin lo
  revise a mano. Esto es lo que de verdad le sube el costo a "corregir el
  texto y volver a intentar" — la cuarta vez ya ni siquiera llega a
  publicarse, sin importar qué tan bien redactado esté.

### 4.4. Fotos duplicadas contra TODO el catálogo (no solo las del mismo dueño)

El frontend ya construyó esto para el caso "mismo dueño, foto repetida"
(`src/lib/fotoHash.ts`, dHash perceptual) — comparar solo contra las
propias propiedades del usuario. Extender esto a nivel de índice en el
backend (guardar el hash de cada foto en `POST /propiedades/fotos`,
comparar contra TODAS las fotos activas de la plataforma) detecta una foto
robada de OTRO anuncio real — el patrón de fraude más común de "propiedad
que no existe" reutiliza fotos de un anuncio legítimo. No se propone un
schema exacto aquí porque ya existe `AlertaFoto` documentado en
`docs/BACKEND-PENDIENTES-30082026.md` §6 — este campo (`hash`) encaja ahí
mismo, no hace falta una tabla nueva.

---

## 5. Precio — descartado por completo, no solo excluido del backend

**Actualización 2026-08-31:** la primera versión de esta propuesta incluía
un cálculo de precio-vs-promedio-de-zona mostrado solo al propio vendedor
como sugerencia (nunca enviado al backend). Se quitó del todo — pedido
explícito: una casa puede valer más o menos por construcción, acabados,
estado, ubicación exacta dentro de la colonia, etc., y la plataforma **no
debe posicionarse como juez de qué precio es "correcto"**, ni siquiera en
forma de sugerencia bien intencionada. Ya no existe ningún código de precio
vs. zona en el flujo de publicar — no es un feature oculto ni pausado, se
eliminó.

**Para quien construya el backend:** esto significa que **precio nunca
debe ser una señal de fraude, en ninguna forma, ni sola ni combinada con
otras.** Las señales independientes reales para nivel alto son las del
punto 4 (GPS, contacto reutilizado, reincidencia, foto duplicada) —
ninguna de ellas depende del precio declarado.

---

## 6. Verificación

Mismo método que el resto de esta sesión (`verificacion-backend-en-vivo`):
cuenta de prueba desechable, publicar un borrador con texto que dispare
`riesgo: alto`, confirmar que:
1. El formulario del frontend bloquea (ya confirmado, es cliente).
2. `POST /propiedades` con ese mismo texto, llamado DIRECTO por curl (sin
   pasar por el formulario), también lo rechaza — esta es la prueba real
   del punto 1.
3. `GET /admin/intentos-fraude` trae el intento, con `intentosMismoUsuario`
   subiendo en cada repetición.
4. Repetir el intento 3 veces con textos ligeramente distintos (simulando
   "reescribir para evadir") y confirmar que la cuenta se bloquea sola en
   el intento configurado (punto 4.3), sin importar que el texto cambió.

Borrar la cuenta de prueba al terminar, como siempre.
