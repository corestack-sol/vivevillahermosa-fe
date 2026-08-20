# Expiración de Alertas — contrato para backend — 2026-08-20

## Problema

`Alerta` no tiene ciclo de vida — se crea y queda activa para siempre. El matching es event-driven (`POST /api/alertas/notificar`, disparado desde `PublishForm.onSubmit` en cada publicación nueva, no un cron), así que **cada alerta viva se re-evalúa en cada publicación futura, sin límite de tiempo**. Una cuenta que crea una alerta y nunca vuelve a revisar correo (o que ya encontró propiedad) sigue consumiendo matching + envíos de email indefinidamente.

## Decisión de producto (confirmada 2026-08-20)

- Cada alerta expira **15 días** después de creada. Punto fijo, sin renovación automática por ningún medio (ni por login, ni por visita a `/alertas`, ni por recibir un match).
- Al expirar, se **elimina** — no se pausa ni se archiva.
- Si la persona sigue interesada, **crea la alerta de nuevo manualmente**. No hay endpoint de renovación — decisión explícita, no construir uno.

## Cambios de schema

`Alerta` gana un campo:

```
expiraEn DateTime   // = createdAt + 15 días, fijado UNA VEZ al crear, nunca se actualiza
```

## Matching (`POST /alertas/notificar`)

Agregar `expiraEn > now()` al `WHERE` que ya filtra alertas activas contra la propiedad nueva. Es el mismo query existente, un filtro más — sin costo adicional de diseño.

## Limpieza — sin cron nuevo, a propósito

La arquitectura ya evitó un job diario para el matching (ver `fase2-spec.md` §Módulo 4); mismo criterio aquí. Borrado perezoso (lazy delete) en los dos puntos que YA tocan la tabla:

1. **`POST /alertas/notificar`** — antes de matchear, `DELETE FROM Alerta WHERE expiraEn < now()` (todas las cuentas). Se dispara en cada publicación, que ya es frecuente en el sitio.
2. **`GET /alertas`** — antes de responder, `DELETE FROM Alerta WHERE userId = :userId AND expiraEn < now()`. Así el usuario nunca ve en su lista una alerta que ya debería estar muerta, aunque el punto 1 no haya corrido todavía.

Sin endpoint ni proceso nuevo dedicado a limpieza — el volumen de publicaciones/visitas al sitio ya garantiza que la ventana de "vive de más" sea corta en la práctica.

## Contrato de API — lo único que cambia de cara al frontend

`POST /alertas` y `GET /alertas` devuelven `expiraEn` (ISO string) en cada objeto `Alerta`, junto a los campos existentes (`id, municipio, tipo, operacion, precioMax, dosBocas, sinRiesgo, createdAt`).

No hay endpoint nuevo, no hay campo de configuración (sin frecuencia, sin toggle de renovación) — mantiene el modelo simple que ya pidió el usuario.

## Resumen — acción para backend

| # | Qué | Acción |
|---|---|---|
| 1 | Campo `expiraEn` en `Alerta` | Agregar al modelo, fijar `createdAt + 15d` al crear (`POST /alertas`) |
| 2 | Filtro de matching | `WHERE expiraEn > now()` en `POST /alertas/notificar` |
| 3 | Limpieza global | `DELETE ... WHERE expiraEn < now()` al inicio de `POST /alertas/notificar` |
| 4 | Limpieza por usuario | `DELETE ... WHERE userId = :id AND expiraEn < now()` al inicio de `GET /alertas` |
| 5 | Respuesta de API | Incluir `expiraEn` en el objeto `Alerta` de `POST` y `GET /alertas` |
