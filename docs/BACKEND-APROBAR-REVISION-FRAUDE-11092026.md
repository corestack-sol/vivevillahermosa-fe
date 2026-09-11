# Quitar marca "En revisión" de una propiedad — contrato para backend

**Fecha:** 2026-09-11. **Estado: NO implementado, frontend ya listo.**

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

## Endpoint necesario

| Ruta | Método | Body | Qué hace |
|---|---|---|---|
| `/admin/propiedades/:id/aprobar-revision` | POST | `{ motivo?: string }` | Quita el aviso "En revisión" de la propiedad — limpia `alertaFraude` (o el campo equivalente que hoy alimenta `BackendPublicProperty.alertaFraude`) para que `FraudAlertBadge` deje de mostrarse en la ficha pública. Requiere `esAdmin`, mismo guard que el resto de `/admin/**`. |

## Puntos a decidir del lado del backend

- **Qué pasa con el registro en la cola de `/admin/intentos-fraude`** —
  ¿se marca como "resuelto"/"aprobado" (recomendado, para no perder el
  historial ni la reincidencia) o se borra? Reincidencia
  (`intentosMismoUsuario`) se calcula sobre esa tabla — borrar registros
  aprobados legítimamente no debería contar como "reincidencia" hacia
  adelante.
- **Auditoría** — mismo patrón que `AccionAdmin` ya usado para bloqueos
  de cuenta: guardar quién aprobó, cuándo, y el `motivo` opcional.
- **¿Debe bajar `riesgo` a "bajo" en el registro histórico, o solo
  limpiar `alertaFraude` de la propiedad?** Recomendado: NO reescribir
  el `riesgo` original del intento (es un dato histórico real de lo que
  la IA detectó en su momento) — solo limpiar el campo que controla si
  la ficha pública muestra el aviso.

## Frontend (ya conectado, esperando el endpoint)

`src/app/admin/fraude/page.tsx` — botón "Quitar marca" en cada fila
(y en el modal de detalle) cuando el intento tiene `propiedadId`. Llama
a `POST /admin/propiedades/:id/aprobar-revision`; si el backend
responde 404 (ruta inexistente), muestra un aviso honesto en vez de
fallar en silencio — mismo criterio que el resto de esta página con
`GET /admin/intentos-fraude` mientras no existía.
