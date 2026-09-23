# Alertas por colonia — lo que necesita el backend (23-09-2026)

Pedido de producto: poder crear una alerta que avise **solo cuando se publique una propiedad en una colonia concreta** (hoy solo hay municipio, tipo, operación, precio máximo, Dos Bocas y zona segura).

El frontend ya está listo (campo "Colonia (opcional)" en `/alertas`, con autocompletar del catálogo). Está apagado con una constante (`ALERTAS_POR_COLONIA_DISPONIBLE` en `src/lib/alertas.ts`) hasta que el backend confirme este contrato, porque hoy mandar el campo rompe la creación de alertas.

## Verificado en vivo (producción, cuenta desechable ya borrada)

| Prueba | Resultado |
|---|---|
| `POST /alertas` sin `colonia` (control) | 201, alerta creada |
| `POST /alertas` con `colonia` en el body | **400** `property colonia should not exist` |
| `POST /alertas?colonia=Tabasco%202000` (query param) | 201, **pero la alerta se guarda sin colonia** (se ignora en silencio) |
| `GET /alertas` | las alertas no traen ningún campo `colonia` |

Conclusión: el modelo `Alerta` no tiene `colonia`. Con solo el frontend no se puede.

## Contrato propuesto

1. **Modelo `Alerta`**: agregar `colonia String?` (nullable, sin migrar datos: las alertas existentes quedan en `null` = cualquier colonia).
2. **`POST /alertas`**: aceptar `colonia?: string` (1–120 caracteres, recortado). Si viene `colonia` **sin** `municipio`, responder 400 con un mensaje claro: muchos nombres se repiten entre municipios (por ejemplo "Centro").
3. **`GET /alertas`** y la respuesta de `POST`: incluir `colonia` (o `null`).
4. **Emparejamiento (`AlertaMatchingService`)**: una propiedad nueva coincide con una alerta con colonia solo si `municipio` coincide **y** las colonias coinciden **normalizadas**: minúsculas, sin acentos, sin espacios sobrantes y sin el prefijo genérico "colonia"/"col." (mismo criterio que `normalizarNombreColonia` en `src/lib/colonias.ts` del frontend).
5. Las alertas **sin** colonia siguen comportándose exactamente igual que hoy.
6. El mensaje de la notificación/correo puede mencionar la colonia ("Nueva propiedad en Tabasco 2000").

## Por qué normalizar

En publicar, la colonia es texto libre con sugerencias. Una persona puede escribir "tabasco 2000", "Tabasco 2000" o "Col. Tabasco 2000". Comparar el texto exacto haría que la alerta nunca coincida.

## Cómo probarlo cuando esté listo

1. Crear alerta con `municipio: "Centro"` y `colonia: "Tabasco 2000"` → 201 y la respuesta trae `colonia`.
2. `GET /alertas` la devuelve con `colonia`.
3. Publicar una propiedad en esa colonia (y otra en una distinta) → solo la primera dispara notificación.
4. `colonia` sin `municipio` → 400 con mensaje claro.

Cuando esto esté desplegado, avisar para cambiar `ALERTAS_POR_COLONIA_DISPONIBLE` a `true` en el frontend.
