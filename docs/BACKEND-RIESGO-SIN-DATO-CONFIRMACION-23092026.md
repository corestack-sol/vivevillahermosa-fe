# `sin_dato`: el front ya lo soporta en producción (23-09-2026)

Respuesta a su mensaje sobre las 14 propiedades sembradas con `sin_dato`.

## No las pasen a `bajo`

El front **ya se desplegó** con soporte para `sin_dato` (Worker `30405b85`, 23-09-2026). Verificado en producción con esas mismas propiedades:

- Ficha (`/propiedades/local-comercial-en-venta-en-calzada-primera-seccion-sur-2416a899`): carga y muestra "Sin información de riesgo de inundación", con la aclaración de que eso no significa que la zona sea segura ni que se inunde. Antes daba "No pudimos cargar esta página".
- Listado (`/propiedades?municipio=Cárdenas`): las 3 tarjetas cargan, con punto gris.
- Mapa (`/mapa`): 24 pines, con un cuarto interruptor "Sin dato" (activo por defecto).

Pasarlas a `bajo` mostraría "Bajo historial de inundaciones" como si fuera un dato real. Para un comprador eso es justo lo contrario de la verdad: dice que la zona es segura sin que nadie lo haya verificado. Es mejor dejarlas como `sin_dato`.

## Estado del plan del front (paso 2)

Ya en producción: el tipo, badge y ficha, tarjetas, mapa (pines y tarjeta seleccionada, más el cuarto interruptor), coach de calidad y la pantalla de Editar (deja el campo vacío si viene `sin_dato`).

Pendiente en el front (no bloquea el paso 3):
- La opción "No sé / sin información" en los formularios de publicar y editar. Hoy el formulario siempre manda uno de los tres niveles.
- Aclarar en alertas que "zona segura" solo trae propiedades con riesgo conocido.

## Paso 3 (default `sin_dato`)

Desde el punto de vista de lectura no hay nada que bloquee: el front ya muestra `sin_dato` en todas las superficies. El formulario del front siempre manda el campo, así que cambiar el default no lo afecta. Pueden avanzar cuando quieran; solo les pedimos no tocar las propiedades ya guardadas.

## Su sugerencia sobre valores desconocidos

De acuerdo, y ya está hecha del lado del front: cualquier valor de riesgo que no reconozca (`null`, un nivel nuevo, texto raro) se trata como `sin_dato` al leerlo, en vez de romper la ficha. Entra en el próximo despliegue. Del lado del backend, un default para lo que no reconozcan en las lecturas también ayuda.
