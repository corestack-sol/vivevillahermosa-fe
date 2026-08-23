# Preguntas para backend — subida de fotos y Cloudinary (2026-08-22)

## Contexto

Hoy el frontend (`PublishForm.tsx` / `src/lib/imageResize.ts`), antes de subir
una foto a `POST /propiedades/fotos`, la redimensiona y comprime EN EL
NAVEGADOR (canvas, 1280px de lado máximo, JPEG calidad 0.85) — el archivo que
de verdad viaja al backend ya es chico (unos cientos de KB), sin importar
qué tan pesado era el original. Además hay un límite de entrada: un archivo
origen de más de 20MB se rechaza antes de intentar nada (pensado para no
colgar la pestaña de quien publica al leerlo completo a base64 en memoria).

Pedido explícito del producto: el formulario debería aceptar fotos pesadas
tal cual (sin que el navegador tenga que cargarlas/comprimirlas), dejar que
Cloudinary sea quien comprima, y que el frontend muestre después la versión
ya comprimida. Antes de tocar el código del lado del cliente, necesitamos
saber cómo funciona hoy el lado del servidor — no tenemos visibilidad de eso
desde este repo (el backend vive aparte, NestJS).

## Preguntas concretas

1. **¿Cuál es el límite real de tamaño que acepta `POST /propiedades/fotos`
   hoy?** (límite de multer/body-parser o cualquier límite de la
   plataforma donde corre — necesitamos el número exacto antes de aflojar
   la compresión del lado del cliente, para no mover el mismo error de
   "foto rota" de un lado a otro sin resolverlo).

2. **Al subir una foto, ¿el backend le pide a Cloudinary una transformación
   "eager" (una versión ya comprimida/optimizada generada al momento de
   subir), o sube el archivo tal cual y devuelve la URL original sin
   procesar?**

3. **¿Qué forma tiene exactamente la URL que devuelve el backend en el
   campo `url` de la respuesta de `/propiedades/fotos`?** Necesitamos un
   ejemplo real. Específicamente: ¿sigue el patrón estándar de entrega de
   Cloudinary (`https://res.cloudinary.com/<cloud_name>/image/upload/
   <transformaciones>/<public_id>.<ext>`)? Si es así, el frontend puede
   insertar parámetros de transformación (`f_auto,q_auto,w_1200`)
   directamente en la URL para mostrar una versión comprimida sin ningún
   cambio de backend — pero necesitamos confirmar que el formato real
   coincide antes de construir esa lógica a ciegas.

4. **¿Cuál es el enfoque que prefieren a futuro?** Que el backend pida la
   transformación optimizada a Cloudinary y devuelva esa URL directamente
   (opción A), o que el frontend arme la URL con parámetros de
   transformación él mismo a partir de la URL "cruda" que devuelva el
   backend (opción B). Cualquiera de las dos funciona, pero cambia qué lado
   hace el trabajo.

## Qué NO hemos tocado todavía

Ningún cambio de código para este punto — ni la compresión del lado del
cliente, ni la visualización de fotos en `PropertyCard.tsx`/
`PropertyGallery.tsx` (hoy usan `<img src={foto}>` con la URL tal cual llega,
sin ningún parámetro de transformación). Esperando esta respuesta antes de
avanzar.
