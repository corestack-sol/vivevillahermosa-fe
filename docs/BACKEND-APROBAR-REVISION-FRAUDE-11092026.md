# Quitar marca "En revisión" de una propiedad — contrato para backend

**Fecha:** 2026-09-11. **Estado (2026-09-11, mismo día): IMPLEMENTADO,
en producción.**

**Hallazgo real que salió al implementar esto (avisado por el backend):**
el mecanismo que este documento asumía (`alertaFraude` marcándose en
riesgo "medio") estaba muerto desde el 31 de agosto — `riesgo: 'alto'`
siempre rechazaba la publicación con `400` antes de guardar nada, y
"medio" no tocaba ningún campo. El backend lo revivió apuntándolo a
"medio" (el único caso que de verdad se publica) — ahora si funciona
como se pedía. Esto significa que en la práctica ESTA cola/acción solo
aplica a intentos "medio" — "alto" nunca llega a tener una propiedad real
que aprobar, consistente con lo que ya decía la página
("Nivel alto ya bloquea publicar").

**Contrato final del endpoint** (igual al propuesto, confirmado):

**Por qué hace falta:** junto con este pedido se ocultaron las señales
exactas de fraude tanto de quien publica (`PublishForm.tsx`, riesgo
"medio") como del público (`FraudAlertBadge.tsx`) — mismo criterio que
ya existía para riesgo "alto"/bloqueado: mostrar el motivo exacto le
sirve de mapa a alguien deshonesto para reescribir y evadir la
detección la próxima vez, sin pasar nunca por una revisión real.

Ese cambio quita a la persona la posibilidad de "corregir a ciegas"
reescribiendo hasta que deje de marcar. El reemplazo real es esto:
un administrador con acceso a las señales completas (`/admin/fraude`,
ya construido y confirmado en vivo que el backend ya expone `GET
/admin/intentos-fraude`) puede revisar el caso y, si es un falso
positivo, quitar la marca manualmente.

| Ruta | Método | Body | Qué hace |
|---|---|---|---|
| `/admin/propiedades/:id/aprobar-revision` | POST | `{ motivo?: string }` (opcional, máx 500 caracteres) | Requiere `esAdmin`. Limpia `alertaFraude` de la propiedad → `FraudAlertBadge` deja de mostrarse en la ficha pública. Responde `200 { ok: true }`. `404` si la propiedad no existe. `409` si la propiedad no tiene ninguna marca de fraude que quitar (ya se aprobó antes, o nunca tuvo una). |

**Decisiones que tomó el backend** (las 3 preguntas que este doc dejaba
abiertas):
- El registro en `/admin/intentos-fraude` se marca resuelto, no se borra
  — nuevos campos `resueltoEn: string | null` (ISO) y
  `resueltoPor: { id, nombre, email } | null`.
- `intentosMismoUsuario` ya EXCLUYE del lado del servidor los intentos
  con `resueltoEn` distinto de null — un falso positivo aprobado deja de
  contar como reincidencia hacia adelante, como se recomendaba.
- `GET /admin/intentos-fraude` gana un filtro aditivo opcional
  `?estado=pendiente|resuelto` (sin mandarlo, trae todo).
- **Efecto colateral útil, avisado por el backend:** si el dueño reescribe
  el contenido y el nuevo análisis ya no da riesgo "medio", la marca se
  limpia sola — no hace falta que un admin la apruebe manualmente en ese
  caso.

## Frontend (ya conectado, en producción)

`src/app/admin/fraude/page.tsx` — filtro de estado (pendiente/resuelto/
todos) además del de riesgo, botón "Quitar marca" quitado y reemplazado
por un badge "Resuelto · hace X días (por Fulano)" en las filas ya
resueltas, manejo específico del `409` con mensaje propio en vez del
genérico de `BackendApiError`. El fallback "el backend no lo tiene
todavía" se quitó del modal — ya no aplica.
