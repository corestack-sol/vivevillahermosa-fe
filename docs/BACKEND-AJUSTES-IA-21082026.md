# Ajustes de backend pendientes — funciones de IA nuevas (2026-08-21)

Este documento junta los pedidos concretos de backend que salieron de implementar
mejoras de IA del lado del frontend. Cada sección es independiente — se puede
priorizar por separado.

---

## 1. Auto-detección de amenidades desde fotos (`POST /ia/analizar-imagen`)

**Estado del frontend:** listo para consumir el campo, ya deployado. Sin el
campo del backend, simplemente no pasa nada (no rompe nada, el selector manual
sigue funcionando igual).

**Qué se necesita:** que la respuesta de `POST /ia/analizar-imagen` incluya un
campo nuevo, opcional:

```json
{
  "apta": true,
  "relacionada": true,
  "señalesFraude": [],
  "notas": "",
  "amenidadesDetectadas": ["Alberca", "Jardín"]
}
```

**Importante — strings EXACTOS.** El frontend valida cada string contra un
catálogo cerrado (`src/lib/amenidades.ts`) y descarta cualquier valor que no
coincida exacto (case-sensitive). Las 14 labels válidas, tal cual:

```
Alberca
Jardín
Seguridad 24h
Estacionamiento techado
Terraza
Balcón
Gimnasio
Elevador
Bodega
Cuarto de servicio
Área de asadores
Jacuzzi
Clósets amplios
Aire acondicionado
```

Si el prompt de Gemini genera otra redacción ("Piscina" en vez de "Alberca",
o inglés), el frontend lo va a descartar en silencio — coordinar el prompt
para que devuelva exactamente estas strings, o avisar si prefieren mandar
keys cortas en vez de labels (el frontend se ajusta al que decidan, pero hay
que acordarlo).

**Recomendación de scope (no bloqueante, es sugerencia):** correr la
detección de amenidades SOLO sobre fotos que ya pasaron `relacionada: true`
— si la foto ni siquiera es de la propiedad, no tiene sentido sacarle
amenidades.

---

## 2. Coach de calidad de anuncio

**Capa 1 (heurística) — implementada en frontend, sin cambios de backend.**
`src/lib/coach.ts` + `src/hooks/useCoach.ts` — corre sobre datos que ya trae
`/propiedades/mias` (fotos, descripción, amenidades, días desde
`fechaPublicacion`). Costo: $0, sin llamada nueva. Aparece como badge en el
menú (`Navbar.tsx`) y como tarjeta no intrusiva en `/dashboard`
(`dashboard/page.tsx`) — solo visible si hay algo que revisar, nunca un modal
automático.

**Gate de "premium" confirmado 2026-08-22:** no existe pago real todavía
("eso es fase 2", confirmado por el usuario) — se usa `esProfesional`
(`rol === 'agente'`) como equivalente interino, mismo criterio que
"Panel profesional" y "Destacar propiedad". Cuando exista facturación real en
Fase 2, este gate debe reemplazarse por el estado de suscripción real.

**Corrección 2026-08-22:** esta sección decía `rol === 'inmobiliaria'` —
terminología vieja de una propuesta de 4 roles (particular/profesional/
inmobiliaria/agente) que nunca se construyó. El enum real del backend es
`particular | agente` únicamente. El código YA usaba ese string incorrecto en
9 archivos (bug real, no solo del doc) — corregido a `rol === 'agente'` en
todos, verificado contra el login real de producción.

**Capa 2 (IA cualitativa) — todavía NO implementada, sigue siendo propuesta.**
Solo cosas que la heurística no puede juzgar (¿la descripción es específica o
genérica?).

**Capa 2 — cualitativa, con IA, evento-driven (no polling).** Solo cosas que
una heurística no puede juzgar (¿la descripción es específica o genérica?).
Propuesta: extender la respuesta de `POST /ia/analizar-fraude` (que ya se
llama al publicar/editar) con una nota de calidad, en vez de crear un
endpoint nuevo — reusa la llamada que ya existe, no agrega costo marginal
nuevo por publicación/edición. Ejemplo:

```json
{
  "riesgo": "bajo",
  "señales": [],
  "notaCalidad": "La descripción no menciona acabados ni distribución — considera agregar más detalle."
}
```

`notaCalidad` sería opcional y NO afecta el flujo de fraude existente — es
un campo aparte, informativo, nunca bloqueante.

**Por qué evento-driven y no cron:** si esto se ejecutara en un cron
periódico sobre todo el catálogo, el costo escala con TIEMPO y NÚMERO DE
PROPIEDADES, no con actividad real — impredecible y creciente. Atado a
publicar/editar, el costo escala con acciones reales de los usuarios, mismo
patrón que ya tiene `analizar-fraude` hoy.

**Sin decidir todavía (pendiente de que el equipo de producto confirme):**
si esto termina siendo función paga, hoy no existe ningún sistema de
pagos/suscripciones en el frontend ni evidencia de uno en el backend — no
hay forma real de gatear por "pagó o no pagó". Ver el mensaje completo de
riesgos/diseño que se le compartió al usuario en la misma sesión para el
detalle completo antes de construir esto.

---

## 3. Detección de anuncios duplicados/scraping — solo idea, sin diseño de API todavía

No hay propuesta de contrato de API todavía — esta es la más ambiciosa de
las tres y necesita más discusión de producto antes de llegar a "qué debe
devolver el endpoint". Se documenta la necesidad, no la forma:

- Comparar fotos nuevas contra el catálogo existente (similitud perceptual,
  no solo hash exacto) para detectar reutilización de imágenes entre
  anuncios distintos.
- Riesgo real a considerar desde el diseño: desarrollos con plano repetido
  (edificios de departamentos en Tabasco con unidades visualmente
  idénticas) van a generar falsos positivos con cualquier comparación
  puramente visual — necesita señales adicionales (dirección, mismo dueño,
  fecha) combinadas, no solo imagen.
- Esto probablemente necesita un índice vectorial o similar del lado del
  backend (no es una llamada simple a un LLM) — infraestructura nueva, no
  solo un endpoint más.

No se pide nada concreto todavía en este punto — se deja documentado para
cuando se priorice.
