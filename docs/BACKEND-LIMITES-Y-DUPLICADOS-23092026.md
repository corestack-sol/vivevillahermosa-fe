# Límites de peticiones y avisos duplicados (23-09-2026)

Reporte de producción: al publicar varias veces salió "muchas peticiones al servidor", y otras personas recibieron la misma alerta repetida (~4 veces). Todo lo de abajo está medido en vivo contra producción con cuentas desechables (ya borradas).

## 1. `POST /ia/analizar-imagen` da 429 siempre

- Con una cuenta recién creada respondió **429 `ThrottlerException: Too Many Requests` desde la primera petición**, y siguió igual tras esperar 75 s y luego otros ~65 s.
- Al mismo tiempo, `POST /propiedades/fotos` aceptó 8 subidas seguidas (201) y `POST /ia/analizar-fraude` aceptó 25 seguidas (201).
- Las cabeceras muestran `x-ratelimit-limit: 120`, `x-ratelimit-reset: 60` (el límite general): no exponen el límite propio de esta ruta ni `Retry-After`.

Pedidos:
1. Confirmar cuál es el límite real de `/ia/analizar-imagen` (por usuario, por IP o global) y su ventana. Si es por IP, hay redes móviles con IP compartida donde varias personas pueden agotarlo entre sí.
2. Devolver `Retry-After` en los 429 y, si se puede, cabeceras `x-ratelimit-*` de la ruta afectada.
3. Confirmar si `POST /propiedades/fotos` comparte ese contador (el backend re-analiza cada foto al subirla).

Lo que ya hizo el front: la foto se analiza de una en una y, tras el primer 429, no vuelve a llamar por 90 s (el análisis es opcional: sin él la publicación sigue). Las subidas van de 2 en 2, reintentan un 429 con espera, y un reintento de Publicar ya no vuelve a subir lo que ya subió.

## 2. Alertas repetidas: el backend no deduplica

`POST /alertas` con los mismos criterios 3 veces guardó **3 alertas** (`GET /alertas` devolvió 3). Cada alerta repetida genera su propio aviso por cada propiedad que coincide: con 4 iguales, la misma propiedad avisa 4 veces.

Sí funciona bien el caso normal (verificado con dos cuentas): **1 alerta + 1 propiedad = exactamente 1 notificación**, y **editar la propiedad 2 veces no vuelve a avisar**.

Pedidos:
1. Restricción única sobre (usuario + municipio + colonia + tipo + operación + precioMax + dosBocas + sinRiesgo). Al repetir, devolver la existente (200) o 409, no crear otra.
2. Restricción única por (alerta, propiedad) en las notificaciones, para que aunque haya un reintento del servicio nunca se genere dos veces el mismo aviso.
3. Limpiar las alertas duplicadas que ya existan en producción.

Lo que ya hizo el front: no permite crear una alerta idéntica a una existente y bloquea el doble toque (incluido "Deshacer"). El service worker usa `tag` para que avisos idénticos se vean como uno solo en el teléfono.

## 3. Suscripciones push

`POST /push/suscripciones` con el mismo `endpoint` tres veces respondió 201 `{"ok":true}` las tres. No hay forma de listar las filas guardadas, así que no pude confirmar si se duplican.

Pedido: que `endpoint` sea único (upsert) y confirmar que enviar el mismo push dos veces al mismo endpoint no ocurre. Un push duplicado por endpoint se ve como el mismo aviso repetido.

## 4. (Opcional) Idempotencia al publicar

`POST /propiedades` con la misma petición dos veces crea dos propiedades (y dispara alertas dos veces). El front ya evita el doble envío, pero una cabecera `Idempotency-Key` cerraría el caso por completo.
