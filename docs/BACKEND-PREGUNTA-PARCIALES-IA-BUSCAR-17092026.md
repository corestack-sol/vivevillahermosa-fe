# Pregunta para backend: ¿está implementada la clasificación de parciales/altamente relevantes en /ia/buscar?

**Estado: PENDIENTE DE RESPUESTA**
**Fecha: 17/09/2026**

## Contexto

El frontend ya integró `POST /ia/buscar` (ver
`docs/BACKEND-INTEGRACION-IA-BUSCAR-16092026.md`) y usa `parciales`/
`altamenteRelevantes` para armar la sección "Todo lo demás" — propiedades
que cumplen algunos de los criterios pedidos pero no todos.

Un usuario reportó que esa sección no aparecía. Se probó en vivo la
consulta exacta que usó:

```
POST /ia/buscar
{"query": "propiedades en el centro"}
```

Respuesta real:
```json
{
  "modo": "exacta",
  "totalExactas": 19,
  "totalParciales": 0,
  "totalAltamenteRelevantes": 0,
  "resultados": [ /* 19 propiedades */ ],
  "parciales": [],
  "clasificacion": { "requeridos": { "municipio": "Centro" }, "preferidos": {}, "orden": {} }
}
```

## Nuestra hipótesis (sin confirmar del lado del backend)

Con un solo criterio extraído (`municipio: Centro`), no hay margen
matemático para "parcial" — una propiedad o está en Centro (entra como
exacta) o no (queda fuera). Asumimos que `parciales`/
`altamenteRelevantes` solo pueden tener contenido cuando la consulta
extrae **2 o más criterios** (ej. tipo + recámaras + municipio), y que 0
resultados aquí es el comportamiento correcto, no un hueco de
implementación.

## Lo que necesitamos que confirmen

1. ¿La clasificación de "parcial"/"altamente relevante" (cumple algunos
   criterios, no todos, con `faltantes` explicando cuáles) está
   **completamente implementada** del lado del backend, o es un campo que
   existe en el contrato pero todavía no tiene lógica real detrás en
   todos los casos?
2. Si está implementada: ¿pueden confirmar con qué tipo de consulta
   deberíamos ver `parciales`/`altamenteRelevantes` con contenido, para
   verificarlo nosotros en vivo? (nuestra hipótesis: una consulta con 2+
   criterios donde ninguna propiedad cumple TODOS pero varias cumplen
   ALGUNOS — ej. "casa con 6 recámaras en Centro", que sí nos dio 4
   parciales en pruebas anteriores del 16/09).
3. Si NO está implementada todavía (o solo parcialmente): decirnos qué
   falta, para no seguir asumiendo que el campo siempre refleja lógica
   real.
