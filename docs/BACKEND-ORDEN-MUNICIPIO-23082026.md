# Backend — orden por defecto de `/propiedades` por municipio (2026-08-23)

## Contexto / por qué

Sin filtros activos, `/propiedades` muestra las primeras 12 propiedades y
así sucesivamente por página — hoy los municipios aparecen revueltos, sin
ningún criterio de agrupación. Se evaluó geolocalización real (mostrar
primero lo cercano al usuario) y se descartó a propósito: sería
personalizado por visitante, lo que implica calcular distancia real en
cada request sin poder cachear entre usuarios — costoso a miles de
usuarios concurrentes, decisión tomada explícitamente para evitar ese
costo.

**Alternativa elegida: orden fijo por prioridad de municipio.** Mismo
resultado para todos los visitantes (cacheable, calculable una sola vez),
Centro primero y el resto en un orden estable — sin geolocalización, sin
cálculo de distancia, sin permiso del navegador de por medio.

## Prioridad — mismo orden que ya usa `MUNICIPIO_CENTERS`

El frontend ya tiene un orden canónico de los 17 municipios
(`MUNICIPIO_CENTERS` en `src/lib/publishSchema.ts`, usado hoy en el
selector de publicar) — Centro primero, resto por tamaño de mercado. Se
reusa tal cual, sin inventar un segundo catálogo:

```
1. Centro
2. Cárdenas
3. Comalcalco
4. Paraíso
5. Nacajuca
6. Jalpa de Méndez
7. Huimanguillo
8. Centla
9. Macuspana
10. Tenosique
11. Cunduacán
12. Emiliano Zapata
13. Balancán
14. Jonuta
15. Tacotalpa
16. Teapa
17. Jalapa
```

Cualquier `municipio` fuera de esta lista (dato sucio/typo) va al final,
después del 17.

## Qué cambia en la query

Cuando **no** venga `sort` en el request (o venga `sort=relevancia`, ver
nota de compatibilidad abajo), el orden por defecto pasa a ser:

```sql
ORDER BY
  CASE municipio
    WHEN 'Centro' THEN 1
    WHEN 'Cárdenas' THEN 2
    WHEN 'Comalcalco' THEN 3
    -- ... resto de la lista arriba, en orden
    ELSE 18
  END,
  featured DESC,   -- criterio actual de "relevancia" dentro de cada municipio
  createdAt DESC   -- tercer desempate, estable
```

**No reemplaza `featured`, lo antecede** — dentro de cada grupo de
municipio, las destacadas siguen apareciendo primero, igual que hoy.

## Nota de compatibilidad: `sort=relevancia`

El frontend históricamente podía mandar `sort=relevancia` de forma
literal (bug menor, ya corregido en `useSearch.ts` en esta misma pasada —
ver `if (filters.sort && filters.sort !== 'relevancia') params.sort = ...`).
De ahora en adelante el frontend **no** manda ese valor — la ausencia de
`sort` es la señal de "aplica tu orden por defecto". Si en algún punto
llega `sort=relevancia` de todas formas (cliente viejo, caché, request
directo), el backend debe tratarlo igual que la ausencia del parámetro,
no como un valor de sort desconocido a ignorar con un orden distinto.

## Cambios ya hechos en el frontend (esta pasada)

- `src/lib/filters.ts` — el camino que SÍ sigue en memoria (catálogo
  completo, cuando `categoriaLandmark`/`zonaDestacada`/`amenidad` están
  activos, ver `docs/BACKEND-PROPIEDADES-PAGINACION-23082026.md` si
  existe / o el hueco documentado si no) ya aplica este mismo criterio —
  `sortProperties()`, caso `default`, ahora ordena primero por prioridad
  de municipio (`PRIORIDAD_MUNICIPIO`, derivado de `MUNICIPIO_CENTERS`) y
  usa `featured` solo como desempate dentro del mismo municipio. Cero
  costo adicional real — ya era un sort en memoria sobre un arreglo ya
  cargado, se agregó una comparación más.
- `src/hooks/useSearch.ts` — ya no manda `sort=relevancia` literal al
  backend (ver nota de compatibilidad arriba).

**Lo que falta y es 100% backend:** la paginación real (page 1, page 2...)
viene del servidor — el frontend ordenando en memoria SOLO corrige la
página que ya tiene cargada, no corrige que la página 2 traída del
servidor siga en un orden arbitrario. Sin este cambio en la query del
backend, el problema original (municipios revueltos) sigue existiendo en
cuanto se navega más allá de la primera página.

## Fuera de alcance

- Geolocalización real / personalización por usuario — descartada a
  propósito por costo, ver Contexto.
- Cambiar qué significa `featured` o cómo se marca una propiedad como
  destacada — sin cambios, solo se antecede con el municipio.
