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
