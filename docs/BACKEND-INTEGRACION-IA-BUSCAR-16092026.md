# Integración de POST /ia/buscar (búsqueda por texto libre)

**Estado: IMPLEMENTADO (frontend)**
**Fecha: 16/09/2026**

## Qué cambió

La búsqueda por texto libre dentro de `/propiedades` (buscador inline,
`src/app/propiedades/PropertiesClient.tsx`) ahora llama a `POST
/ia/buscar` y muestra el resultado tal cual — ya no pasa por
`interpretarBusqueda()` (`/ia/busqueda-inteligente`) → `updateFilters()` →
`applyFilters()`/`searchProperties()` como segunda etapa de filtrado.

**No tocado, sigue exactamente igual:**
- Filtros manuales (`FilterPanel`, chips del mapa, `SortSelect`, sugerencia
  de lugar exacto) — siguen yendo por `updateFilters()`/`clearFilters()`
  reales → `useSearch()` → `applyFilters()`/`searchProperties()`.
- El buscador de Home (`SearchBar.tsx`) — sigue usando
  `interpretarBusqueda()` + navegación a `/propiedades?...` con filtros
  estructurados. Ver "Fuera de alcance" abajo.
- `FilterPanel.tsx`, `filters.ts` (flujo manual), `PropertyCard.tsx`,
  autenticación, favoritos, diseño visual — sin cambios.

## Verificado en vivo antes de integrar (verificacion-backend-en-vivo, 16/09/2026)

Endpoint público, sin efectos secundarios — se probó directo contra
producción sin necesidad de cuenta desechable.

- La forma real de la respuesta **no es plana** — cada propiedad viene
  envuelta: `{ propiedad: {...}, score, tipoCoincidencia, razones,
  faltantes }`, no un objeto `Property`-compatible directo.
- `altamenteRelevantes`/`totalAltamenteRelevantes` **solo existen cuando
  ese grupo tiene al menos 1 resultado** — el backend los omite del todo
  si no, no los manda como arreglo vacío. El código no puede asumir que
  existen.
- **Hallazgo importante:** `resultados` no es un cuarto grupo aparte —
  ya es una copia del grupo que corresponde a `modo`. Confirmado con
  `modo: "parcial"`: `resultados` y `parciales` fueron el MISMO arreglo
  (mismos 4 ids, mismo orden). Con `modo: "exacta"`, `resultados` traía
  solo las exactas y `parciales` las demás (sin traslape). El frontend
  usa esto para armar "Todo lo demás" sin duplicar tarjetas — resta de
  `parciales`/`altamenteRelevantes` lo que ya esté en `resultados`
  (`agruparRespuestaIA()` en `buscarIA.ts`).
- `fueraDeCobertura` viene en la raíz de la respuesta (no solo dentro de
  `filtros`), `modo: "sin-resultados"` cuando aplica.
- Validación real del body: `query` debe ser string, 1-300 caracteres —
  faltante o de otro tipo → 400 con
  `["query must be a string", ...]`.

## Flujo nuevo (texto libre en /propiedades)

```
texto libre → POST /ia/buscar → resultado ya rankeado → grid + mapa
```

`aplicarBusquedaIA()` guarda el resultado en estado propio (`iaQuery`,
`iaResultados`, `iaTodoLoDemas`), separado de `filters`/`useSearch` —
nunca se vuelve a filtrar/ordenar del lado del cliente. Un `iaSeqRef`
(mismo patrón que `evaluarSeqRef` en `PublishForm.tsx`) evita que una
respuesta vieja pise una búsqueda más nueva.

Cualquier interacción con un filtro manual (`updateFiltersManual`/
`clearFiltersManual`) apaga el modo IA y vuelve al flujo de siempre.

## Fallback

Si `POST /ia/buscar` falla (timeout de 12s, error HTTP, red), cae
automáticamente a `aplicarBusquedaFiltrosFallback()` — el código que
existía antes de este cambio, sin modificar (interpretarBusqueda →
filtros → updateFilters). El usuario no ve un error, ve el comportamiento
anterior.

## Fuera de alcance de este cambio

- **SearchBar.tsx (buscador de Home)** sigue sin usar `/ia/buscar` — solo
  navega a `/propiedades` con filtros ya extraídos por
  `interpretarBusqueda()`. No se tocó a propósito (el pedido explícito
  fue auditar primero e implementar "únicamente lo necesario"; el ejemplo
  de éxito dado se cumple igual buscando directo en `/propiedades`). Si
  se quiere que Home también dispare `/ia/buscar`, es un cambio aparte a
  decidir.
- `score`, `razones`, `faltantes`, distancia, badges nuevos — no se
  muestran todavía (pedido explícito: primero validar la integración
  funcional).
- Paginación server-side de `/ia/buscar` — hoy pagina en el cliente
  (`iaDisplayCount`, bloques de 12) sobre el arreglo completo que ya
  regresó el backend.

## Limitación de verificación

No hay entorno de staging — el backend real (producción) bloquea CORS
desde `localhost` (confirmado: todas las llamadas a
`api.vivevillahermosa.corestacksolutions.com.mx` devuelven
`net::ERR_FAILED` al correr `npm run dev` local). No fue posible probar
el flujo completo en un navegador real contra datos reales antes de
subir a producción. Cubierto en su lugar con:
- Pruebas unitarias (`src/lib/buscarIA.test.ts`) contra la lógica de
  agrupación y el llamado a `buscarIA()` (éxito, vacíos, parciales,
  fuera de cobertura, error → debe rechazar para que el llamador haga
  fallback), con mocks basados en las respuestas reales capturadas en
  vivo arriba.
- `npx tsc --noEmit`, `npx eslint`, `npx vitest run` (436/436) y
  `npm run build` — todos limpios.
- Revisión de código manual de cada punto de integración
  (race condition, filtros manuales, mapa, "todo lo demás", fallback).
