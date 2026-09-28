# Subida de fotos: formatos y errores (23-09-2026)

Contexto: en Android, fotos genuinas fallaban al publicar; en iPhone no. El frontend ya no depende de que el navegador decodifique la foto (ver `src/lib/fotoArchivo.ts`): la lee a memoria, detecta el formato por sus bytes y sube el original si no puede reducirla. Para cerrar el caso por completo faltan dos cosas del lado del backend.

## Verificado en vivo (producción, cuenta desechable ya borrada)

`POST /propiedades/fotos` (multipart, campo `file`):

| Archivo enviado | Resultado |
|---|---|
| JPEG normal | 201 con URL de Cloudinary |
| Bytes de JPEG, nombre `IMG.heic`, `Content-Type: application/octet-stream` | **201**: el backend valida por los bytes, ignora nombre y tipo (correcto, se mantiene así) |
| WebP / PNG | 201 |
| AVIF | 400 `El archivo no es una imagen válida (jpeg, png, webp o gif)` |
| Archivo con firma HEIC (`ftypheic`) | **500** `Internal server error` |

## Pedidos

1. **HEIC/HEIF debe responder 400, no 500.** Hoy un archivo con firma HEIC revienta el servidor. Debe dar el mismo 400 con mensaje claro que ya da AVIF. Un 500 no le dice nada a la persona y ensucia el monitoreo.
2. **(Recomendado) Aceptar HEIC/HEIF y AVIF y convertirlos a JPEG en el servidor.** Es la única solución completa para HEIC: Chrome y Firefox no lo decodifican, así que el navegador no puede convertirlo (Safari sí). Con conversión en el servidor (Cloudinary `f_jpg`/`fl_force_strip`, o `sharp` con libheif), cualquier foto de cualquier teléfono se publica. Hoy el frontend solo puede pedirle a la persona que la guarde como JPG.
3. Mantener la validación por bytes y el límite de 8MB por archivo, con un mensaje explícito si se excede (el frontend ya reduce a 1920px antes de subir, pero si el navegador no puede reducir, sube el original).

Cuando el punto 2 esté listo, avisar: el frontend puede dejar de convertir/rechazar HEIC y AVIF en el navegador.

## Resuelto (27-09-2026, PR #146 en producción)

Los 3 pedidos, resueltos:
1. HEIC/HEIF corrupto ya da 400 con mensaje claro, no 500.
2. HEIC, HEIF y AVIF se aceptan y se convierten a JPEG en el servidor (Cloudinary). La foto queda guardada como JPEG, visible en cualquier navegador.
3. El límite real es **5MB**, no 8 — el mensaje del 413 ahora es explícito ("El archivo supera el límite de 5MB.").

Cambios en el frontend (`src/lib/fotoArchivo.ts`):
- `image/heic` y `image/avif` se movieron a `ACEPTADOS_POR_BACKEND`: ya no se intenta decodificar/convertir en el navegador (Chrome/Firefox no podían igual). Se suben tal cual, como un JPEG.
- `MAX_SUBIDA_BYTES` bajó de 8MB a 5MB.
- `mensajeRechazoFoto('formato-no-soportado', ...)` ya no menciona HEIC/AVIF (nunca vuelven a caer ahí); el único caso real hoy es BMP.

### Riesgo real que quedaba (27-09-2026): HEIC pesado en Android/Chrome

El límite de 5MB no bloquea JPEG/PNG/WebP en la práctica porque el navegador siempre puede decodificarlos y reducirlos antes de subir. HEIC sí era un riesgo real: Chrome/Firefox no lo decodifican nativamente, así que un HEIC de más de 5MB (el modo "48MP" de iPhone Pro lo produce fácil) se subía SIN reducir en cualquier navegador que no fuera Safari — y si pasaba de 5MB, la persona se enteraba hasta el final, al publicar.

Cerrado con `libheif-js` (WASM, decodificador de HEIC en JavaScript puro, sin backend): `abrirHeicConWasm()` en `fotoArchivo.ts` se importa dinámicamente (nunca en el camino normal, solo si un HEIC pesado además falla al decodificar nativamente) y decodifica/reduce el HEIC en CUALQUIER navegador, no solo Safari. `advertenciaPesoExcesivo()` ahora solo avisa en el caso ya marginal de un HEIC corrupto/no estándar que ni siquiera libheif-js pueda leer.

### Confirmación cruzada del backend (28-09-2026)

El equipo de backend revisó los 3 puntos de PR #146 contra su código real (no contra este doc) y coinciden exacto, incluido el texto literal del mensaje del 413 ("El archivo supera el límite de 5MB.") carácter por carácter con lo que ya está documentado arriba. Nada pendiente de su lado. Sin cambios de frontend.
