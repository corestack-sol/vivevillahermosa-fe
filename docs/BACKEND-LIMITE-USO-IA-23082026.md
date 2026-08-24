# Backend — límite de uso de IA por cuenta (2026-08-23)

## Contexto / por qué

Cada llamada a `/ia/*` cuesta dinero real contra un proveedor externo
(OpenRouter para texto, Gemini para visión de fotos — ver
`docs/BACKEND-MOTIVOS-CIERRE-23082026.md` y comentarios en
`src/lib/interpretarBusqueda.ts` para la arquitectura actual). Hoy no existe
ningún mecanismo para detectar una cuenta que hace un uso desproporcionado
de estas llamadas — ni por volumen ni por frecuencia.

**Esto es un problema distinto al que ya resuelve
`src/lib/moderacionBusqueda.ts`** (3 avisos → bloqueo por manipular el
prompt de búsqueda con inyección/jailbreak). Ese sistema mira el
**contenido** de la consulta. Este documento cubre el **volumen** —
una cuenta cuyas consultas son legítimas una por una, pero que las manda
en cantidades que no tienen sentido para un uso humano normal (scripteo,
cuenta comprometida, o simplemente alguien exprimiendo el buscador para un
uso que no es el previsto). Los dos mecanismos deben convivir, no
reemplazarse.

## Superficies reales de costo — confirmadas por código, no supuestas

Se revisó cada función que menciona IA en el frontend para separar lo que
sí cuesta (llama al backend, que a su vez llama a OpenRouter/Gemini) de lo
que no:

| Función | Endpoint | ¿Cuesta? |
|---|---|---|
| Búsqueda en lenguaje natural | `POST /ia/busqueda-inteligente` | **Sí** — Llama vía OpenRouter, en cada consulta |
| Análisis de foto al publicar | `POST /ia/analizar-imagen` | **Sí** — Gemini, una llamada por foto |
| Descripción automática al publicar | `POST /ia/generar-anuncio` | **Sí** — OpenRouter, una llamada por click en "Generar con IA" |
| Resumen de reporte PDF (`reportePdf.ts`) | `POST /ia/resumen-reporte` | Sí, pero **ya limitado** — la página que lo dispara (`dashboard/analitica`) ya exige `user.rol === 'agente'`, es un subconjunto chico de cuentas y de uso poco frecuente (un reporte, no decenas). No necesita este mecanismo por ahora. |
| Título automático (`tituloGenerator.ts`) | ninguno | No — plantilla determinista, sin red (comentario explícito en el archivo) |
| Lenguaje sensible (`contentModeration.ts`) | ninguno | No — regex local en el navegador |
| Coach de calidad (`useCoach.ts` / `coach.ts`) | ninguno | No — heurística local sobre datos ya traídos con `/propiedades/mias` |

**Alcance de este documento: las primeras 3 filas.** Son las que se
disparan en volumen alto y con cualquier tipo de cuenta (incluida anónima,
en el caso de búsqueda).

## Decisión de diseño clave: no tierizar por `rol` autodeclarado

La pregunta que originó este documento fue si una cuenta particular debería
tener un límite más bajo que una inmobiliaria. La respuesta corta es sí en
principio, pero **no se puede implementar tierizando por el campo `rol`
tal cual existe hoy**, por dos razones verificadas en el código actual:

1. **`rol` es autodeclarado en el registro** — nada impide que una cuenta
   abusiva se registre como `'agente'` únicamente para heredar un límite
   más alto. Usar el campo crudo como señal de confianza sería regalar el
   bypass.
2. **`verificado` tampoco sirve hoy** — `src/lib/verificacionDemo.ts` es
   una vista previa 100% local (`localStorage`), nunca pasa a verdadero
   por sí sola, no hay backend de revisión de documentos todavía (el
   comentario del propio archivo lo deja explícito). No es una señal real
   todavía, es una demo de producto.

**Tampoco se puede tierizar hoy por "número de propiedades activas de la
cuenta"**, que sería la señal más honesta para distinguir un particular de
una inmobiliaria real — porque `Property.userId` no es una relación real
en el backend todavía (gap conocido, documentado como pendiente de Fase 2).
Sin esa relación, "cuántas propiedades tiene esta cuenta" no es una
pregunta que el backend pueda responder con confianza hoy.

### Lo que sí se puede construir ahora, de forma honesta

**Fase A (implementar ahora): límite uniforme por cuenta/IP**, sin tiers,
igual para todas las cuentas. Simple, sin señal falsa, resuelve el
problema real de costo/abuso inmediato.

**Fase B (gancho para hoy, activación manual): tier ampliado por decisión
humana de un admin**, no automática. Reusa el panel `/admin` ya
existente (`esAdmin`, `AccionAdmin` — ver plan de panel de administración):
un admin puede marcar una cuenta específica con un límite ampliado, de la
misma forma que hoy puede bloquear/desbloquear una cuenta. Esto sí es una
señal real — una persona revisó el caso — a diferencia de un checkbox que
la propia cuenta se activa. Sirve como solución puente mientras no exista
verificación real de documentos ni `Property.userId`.

**Fase C (diseño objetivo, no implementar todavía): tier automático por
número real de propiedades activas**, una vez `Property.userId` exista de
verdad (Fase 2). En ese momento, el límite de las superficies ligadas a
publicar (`analizar-imagen`, `generar-anuncio`) puede escalar con
`propiedadesActivas(cuenta)` en vez de ser plano — una inmobiliaria con 80
propiedades activas necesita, de forma legítima, muchas más llamadas que un
particular con 1. Documentado aquí para que Fase A/B no tengan que
rehacerse cuando llegue: el modelo de datos de abajo ya deja espacio para
este campo.

## Modelo de datos nuevo

```
UsoIA
  id            String   @id
  userId        String?  // null = anónimo (solo aplica a busqueda-inteligente)
  ip            String   // IP real del request — mismo cuidado que moderacionBusqueda.ts:
                          // no confiar en X-Forwarded-For sin validar (ver
                          // docs de esa función, ahí se detectó bypass real por header falso)
  superficie    String   // 'busqueda' | 'analizar-imagen' | 'generar-anuncio'
  createdAt     DateTime @default(now())

  @@index([userId, superficie, createdAt])
  @@index([ip, superficie, createdAt])
```

Un registro por llamada real a OpenRouter/Gemini (no por request HTTP —
si el backend cachea o responde 200 con neutral por timeout, como ya hace
`busqueda-inteligente` hoy, ese caso no debería contar contra el límite,
porque no generó costo real).

```
User
  + limiteIAAmpliado Boolean @default(false)   // Fase B — lo activa un admin
```

## Umbrales por superficie — números concretos y su porqué

No un solo tope global: cada superficie tiene un patrón de uso legítimo
distinto, confirmado por las constantes que ya existen en el código.

| Superficie | Base (todas las cuentas) | Ampliado (`limiteIAAmpliado`) | Por qué este número |
|---|---|---|---|
| `busqueda-inteligente` | 40/día por cuenta **y** 40/día por IP (el menor de los dos gana) | 150/día | Una sesión de búsqueda humana normal, incluso exploratoria, rara vez pasa de 10-15 consultas en lenguaje natural. 40 da margen amplio para varias sesiones el mismo día sin abrir la puerta a scripteo. Doble tope (cuenta Y IP) porque la superficie admite anónimos — sin el tope por IP, crear cuentas nuevas sería el bypass obvio. |
| `analizar-imagen` | 60/día | 300/día | `MAX_FOTOS = 5` en `PublishForm.tsx` → una publicación completa cuesta como máximo 5 llamadas. 60/día cubre publicar y volver a intentar ~10 propiedades el mismo día, generoso para el caso base. |
| `generar-anuncio` | 15/día | 60/día | Se usa una vez por propiedad, quizás 2-3 veces si la persona regenera por no gustarle el resultado. 15/día cubre de sobra publicar varias propiedades el mismo día. |

Además del tope diario, aplicar un **tope corto por ráfaga** (ej. 8
llamadas/minuto por cuenta+IP en cualquier superficie) — el patrón de abuso
más común no es "muchas llamadas en el día", es "cientos de llamadas en
segundos" vía script. Esto es independiente del tope diario y debe
evaluarse primero (falla más rápido, más barato de calcular).

## Qué pasa al cruzar el límite

Enforcement gradual, mismo criterio de "nunca castigar de más a un caso
legítimo" que ya usa `moderacionBusqueda.ts`:

1. **Bajo el límite** — respuesta normal.
2. **Cruza el tope de ráfaga** — 429 con mensaje claro ("Espera un
   momento antes de volver a intentar"), sin registrar nada punitivo. Un
   humano real nunca dispara esto sin darse cuenta.
3. **Cruza el tope diario** — 429, y se registra en `UsoIA` igual (para
   que el admin lo vea), pero **no bloquea la cuenta** — a diferencia del
   3-strikes de manipulación de contenido, esto no es necesariamente mala
   fe (puede ser una inmobiliaria real que necesita el tier ampliado). Se
   notifica a la cuenta ("Llegaste al límite diario de esta función,
   vuelve a estar disponible en X horas — si necesitas más, contáctanos")
   con una salida real, igual que la apelación del panel admin.
4. **Patrón repetido varios días seguidos cruzando el tope** — esto sí se
   marca para revisión humana (mismo lugar que ya audita
   `IntentoSospechoso`), no bloqueo automático. Un admin decide si es abuso
   o candidato a `limiteIAAmpliado`.

## Visibilidad para el admin

Nueva vista en `/admin` (ya existe el panel — ver plan de administración):
lista de cuentas que cruzaron el tope diario en los últimos N días, con
acceso directo a otorgar `limiteIAAmpliado` desde ahí. Sin esto, `UsoIA`
tendría el mismo problema que tenía `IntentoSospechoso` antes de este
panel: una tabla que nadie consulta.

## Fuera de alcance de este documento

- Tierizar automáticamente por `rol` o `verificado` — señales no
  confiables hoy, ver arriba.
- Tier automático por número de propiedades (Fase C) — bloqueado por
  `Property.userId`, no es un problema de este documento.
- `resumen-reporte` — ya suficientemente acotado por el gate de rol
  existente en la ruta que lo dispara.
- Cambiar el timeout/reintentos ya existentes de `busqueda-inteligente`
  (`TIMEOUT_CLIENTE_MS`, comentarios en `interpretarBusqueda.ts`) — no
  relacionado con este mecanismo.

## Preguntas abiertas para cuando se implemente

- ¿El tope de ráfaga se calcula en el backend (Nest, con algo tipo
  `@nestjs/throttler`) o en un layer previo (ej. Cloudflare, ya que el
  frontend corre ahí)? Afecta si `UsoIA` necesita guardar también los
  hits de ráfaga o solo los de tope diario.
- ¿`limiteIAAmpliado` lo desbloquea el mismo flujo que
  `SolicitudRevision` (apelación) o es una acción admin-only sin que la
  cuenta la pida? Se recomienda esto último para no mezclar "pido que me
  desbloqueen" con "pido más cuota" — son intenciones distintas aunque el
  mecanismo de apelación sea reusable en el frontend.
