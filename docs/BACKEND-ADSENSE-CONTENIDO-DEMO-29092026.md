# AdSense marcó el sitio: la causa real es el catálogo de demostración (29-09-2026)

Google Ad Manager/AdSense marcó `corestacksolutions.com.mx` con dos políticas a la vez:
- "Anuncios publicados por Google en pantallas sin contenido de publicadores"
- "Contenido de bajo valor"

## Causa real, verificada contra el catálogo público en producción

Google define "contenido de bajo valor" como *"texto sin valor real para quien lo lee — su propio ejemplo es 'lorem ipsum'"* ([ref](https://support.google.com/publisherpolicies/table/10563033#low-value-content)).

`GET /propiedades?all=true` (31 propiedades reales en producción) muestra que **30 de las 31** comparten, palabra por palabra, esta descripción:

> "Anuncio de demostración para revisar el catálogo del sitio. Contacta al agente para más información."

Cada ficha de propiedad muestra esa descripción Y tiene un espacio real de AdSense al lado (`propiedadSidebar`) — exactamente "anuncio junto a una pantalla sin contenido real" para el rastreador de Google, en 30 páginas indexables.

## Ya mitigado en el frontend (esta sesión)

`src/lib/ads.ts` (`esDescripcionDemo`) detecta el marcador literal "Anuncio de demostración" y `PropertyDetailView.tsx` deja de mostrar el anuncio en esas fichas. Es un parche, no la solución: esas 30 páginas siguen sin contenido real, solo dejan de tener un anuncio de Google al lado.

No se intentó detectar la otra plantilla de demo que existe (la que empieza "¡Hola! Buscas la casa perfecta...") — se parece demasiado a lo que escribiría un dueño real, y apagar un anuncio real por error no vale el riesgo. Esa (y la de arriba) se resuelven de raíz solo reemplazando el dato.

## Pedido

1. Confirmar si las 31 propiedades de producción son datos de demostración permanentes o temporales.
2. Si son temporales: sustituir la descripción de cada una por texto real (o al menos único por propiedad) antes de que el tráfico real empiece a ver anuncios de Google al lado de "anuncio de demostración" — Google puede repetir la sanción o suspender el sitio si el patrón persiste.
3. Si van a quedar varias semanas más como catálogo semilla: avisar, para evaluar si conviene ocultar `AdSlot` en TODA propiedad de demostración (no solo con el marcador exacto) hasta que haya inventario real.

## Resuelto (30-09-2026)

El backend agregó `esDemo: boolean` a toda respuesta de propiedad (`GET /propiedades`, `/propiedades/:id`, `/propiedades/mias`) — `true` solo en el catálogo semilla, nunca fijable por un usuario real al publicar/editar. Primer intento (reportado 29-09) tenía el campo en `false` en las 31 propiedades existentes porque la migración no puede "adivinar" cuáles eran demo — corregido re-corriendo el script de siembra contra producción. Verificado en vivo dos veces (antes y después de la corrección, 3 endpoints distintos cada vez): ahora 30/30 con `esDemo: true` — la propiedad #31 (la otra plantilla de relleno) se borró en el mismo reseed.

Cambios en el frontend: `Property.esDemo`/`BackendPublicProperty.esDemo` (tipo + mapeo en `api.ts`), y `PropertyDetailView.tsx` ahora oculta el anuncio con `!property.esDemo` como señal principal — `esDescripcionDemo()` (detección por texto) se deja como red de seguridad extra, no se borró.
