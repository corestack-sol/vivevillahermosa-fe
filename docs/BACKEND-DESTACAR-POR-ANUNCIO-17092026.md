# Destacar por ver un anuncio (solo cuentas particulares)

**Estado: PENDIENTE**
**Fecha: 17/09/2026**

## Qué se quiere construir

Nueva forma de conseguir "destacado" para cuentas **particulares** (no
inmobiliarias): ven un anuncio publicitario corto dentro de la plataforma
y, al terminar, su propiedad queda destacada por **24 horas**. Reemplaza
nada existente — es una vía adicional, paralela al destacado ya real de
inmobiliarias (`featuredDias: 7|15|30`, ya implementado).

Reglas del producto (pedido explícito del dueño de la plataforma):
- Solo 24 horas por vez — nada de 7/15/30, para no saturar el mapa/
  resultados con destacados de particulares.
- **No apilable**: solo puede volver a canjear un anuncio cuando el
  destacado anterior YA venció. Mientras siga activo, no puede renovar
  viendo otro anuncio.
- Solo particulares — inmobiliarias ya tienen su propio mecanismo pagado/
  incluido, esto no es para ellas.

## 2 hallazgos verificados en vivo antes de pedir esto (cuenta/propiedad desechables, borradas)

1. **`featuredDias` no acepta 1 día.** `PATCH /propiedades/:id` con
   `{"featured": true, "featuredDias": 1}` → 400
   `["featuredDias must be one of the following values: 7, 15, 30"]`.
   El mecanismo actual, tal cual, no puede representar "24 horas" —
   necesitamos algo nuevo, no solo relajar el enum.

2. **El PATCH actual no restringe por rol.** Con una cuenta `rol:
   "particular"` recién creada, `PATCH /propiedades/:id` con
   `{"featured": true, "featuredDias": 7}` funcionó igual que con una
   cuenta profesional — devolvió `featured: true` con `featuredHasta` a 7
   días. Hoy, cualquier cuenta (particular incluida) puede destacar su
   propiedad gratis e indefinidamente (repitiendo `featuredDias: 30` cada
   vez que venza) llamando la API directo — el candado "solo
   inmobiliarias" que tenemos hoy es **solo de interfaz** (se oculta el
   botón si `rol !== 'agente'`), no algo que el servidor exija. Lo
   reportamos aparte porque es relevante para lo que pedimos abajo, pero
   es una pregunta separada de si quieren cerrar ese hueco en el PATCH
   genérico también.

## Lo que pedimos

Un endpoint dedicado, no una extensión del PATCH genérico — para que el
servidor (no el frontend) sea quien de verdad decida la duración y la
regla de "no renovar antes de tiempo", en vez de confiar en que el
cliente mande los valores correctos:

```
POST /propiedades/:id/destacar-por-anuncio
```

Comportamiento esperado:
- Solo `rol: 'particular'` puede llamarlo — 403 para cualquier otro rol
  (incluida `agente`, que no lo necesita).
- El servidor decide la duración (24h fija) — no recibe `dias` del
  cliente, para que no se pueda pedir más tiempo del permitido.
- Si la propiedad YA está destacada (`featured: true`,
  `featuredHasta` en el futuro) → rechazar con 409, no renovar/extender
  silenciosamente.
- Si acepta: mismo comportamiento que el `featured`/`featuredHasta`
  actual — se apaga solo al vencer, sin proceso aparte.
- Respuesta: igual que el PATCH normal, con `featured`/`featuredHasta`
  actualizados.

## No bloqueante, para cuando puedan

¿Tiene sentido además que el `PATCH /propiedades/:id` genérico (el de
`featuredDias: 7|15|30`) sí valide `rol === 'agente'` server-side? Hoy
cualquier cuenta puede usarlo directo sin pasar por la interfaz. Lo
dejamos como pregunta aparte, no queremos bloquear lo de arriba por esto.

## Frontend

En cuanto confirmen el endpoint, construimos: el modal/flujo del anuncio
(ya investigado desde antes — AdSlot existente + un timer propio, sin
depender del producto "Rewarded Ads" de Google que requiere aprobación
aparte) y el botón "Ver anuncio y destacar" visible solo para
`rol === 'particular'` en su propia ficha/panel.

---

## Actualización 18/09/2026 — endpoint verificado en vivo

El backend entregó `POST /propiedades/:id/destacar-por-anuncio`. Verificado en
producción con cuenta y propiedad desechables (ambas borradas al terminar,
login posterior 401):

| Prueba | Resultado |
|---|---|
| Sin sesión | 401 |
| POST con propiedad activa propia | 200, `featured: true`, `featuredHasta` = ahora + 24 h exactas |
| Repetir el POST | 409 `{ code: "YA_DESTACADA", featuredHasta }` (mismo valor) |
| POST con `{"featuredDias":30}` en el body | 409 igual — el body se ignora |
| `GET /propiedades/mias` después | `featured: true`, mismo `featuredHasta` |

Contrato completo (403/404/409 sin code/429, límite 10 por hora) en el reporte
del backend; no se probaron 403/429 en vivo.

## Corrección al plan de frontend de arriba

El plan original ("AdSlot existente + un timer propio") **no se debe
construir**. Revisado contra la documentación oficial de Google (18/09/2026):

- AdSense prohíbe mostrar anuncios de Google en pop-ups/modales — un modal con
  un `<ins class="adsbygoogle">` y una cuenta regresiva es exactamente eso, y
  es el mismo patrón por el que la cuenta recibió "anuncios en pantallas sin
  contenido de publicadores" (ver `/publicar/gracias`, ya retirado).
- El formato oficial con recompensa en AdSense web es el "Rewarded ad" del
  Offerwall (Privacidad y mensajería): da **acceso a contenido**, sin
  callback de JavaScript documentado para ligarlo a una acción propia como
  "destacar", y solo se muestra si hay demanda en la cuenta. Sin callback no
  se puede saber que el usuario vio el anuncio antes de llamar al endpoint
  (el servidor tampoco lo verifica).
- Una recompensa de "visibilidad de mi anuncio por 24 h" no aparece ni como
  permitida ni como prohibida en la política de rewarded ads (solo permite
  recompensas indirectas no monetarias, canjeables solo dentro de la
  plataforma, con opt-in y aviso previo de qué se recibe).
- Ad Manager sí tiene rewarded ads para web con callbacks (GPT), pero es otro
  producto, aparte de AdSense.

Bloqueado hasta decidir con el dueño: (a) esperar a que la cuenta esté
aprobada y evaluar Rewarded ad units / Ad Manager, o (b) ofrecer "Destacar 24
h" sin anuncio (el servidor ya impone 24 h fijas, solo particulares, sin
apilar).
