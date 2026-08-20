# Auditoría de edge cases — puntos para el backend — 2026-08-20

Handoff de `docs/AUDITORIA-EDGE-CASES-20082026.md`. El frontend ya corrigió todo lo que podía resolver por sí solo (ver ese documento, sección "Ya corregido"). Lo que sigue aquí son los puntos que **requieren cambios en el backend** (repo NestJS separado) para quedar cerrados de verdad — algunos porque el frontend ya hizo su parte pero la defensa real solo existe si el servidor también la aplica, y otros porque son 100% lógica de servidor, inauditable desde el frontend.

## 1. Moderación de fotos por IA — fail-open sin red de seguridad server-side

**Contexto:** `PublishForm.tsx` (`analizarFoto`) llama a `POST /ia/analizar-imagen`. Si esa llamada falla (red, timeout, imagen que Gemini rechaza), el frontend devuelve `{ apta: true, relacionada: true, señalesFraude: [], notas: '' }` — aprobado por defecto. Es intencional para no bloquear publicar por un error transitorio, pero significa que cualquier imagen que le cause un error a Gemini pasa sin ninguna señal.

**Mitigación ya aplicada en frontend (2026-08-20):** `addFiles` ahora valida con `createImageBitmap()` que el archivo realmente decodifica como imagen antes de aceptarlo — cierra el caso de "archivo no-imagen renombrado". No cierra el caso de una imagen real que Gemini rechaza por otro motivo (formato raro, tamaño, error del proveedor).

**Pedido:** cuando `POST /ia/analizar-imagen` falla o Gemini no puede procesar la imagen, en vez de que el frontend asuma "aprobada", el backend debería:
- Aceptar la foto igual (no bloquear publicar, mismo criterio de UX), pero
- Marcarla internamente como "pendiente de revisión" (ej. un campo `revisionManual: boolean` en la foto o en la propiedad) en vez de "aprobada sin señales" — para que exista un lugar donde un admin la vea después, en vez de que la falla de IA equivalga silenciosamente a un pase limpio.

## 2. Validación de contenido de archivo — reforzar server-side

**Contexto:** el frontend ya no confía solo en el MIME type del navegador (createImageBitmap real, ver arriba) — pero cualquiera puede saltarse el frontend completo y llamar a `POST /propiedades/fotos` directo.

**Pedido:** confirmar que el backend valida el contenido real del archivo (magic bytes / con una librería como `file-type`, no solo el `Content-Type` del request) antes de subirlo a Cloudinary. Si ya lo hace, no se necesita ninguna acción — este punto es solo para confirmar que existe, ya que no es auditable desde aquí.

## 3. Techo de precio — reforzar server-side

**Contexto:** `publishSchema.ts` ahora rechaza un precio mayor a $500,000,000 MXN en el formulario. Es solo la primera línea de defensa (mismo criterio que `LIMITE_PROPIEDADES` — el frontend evita el caso obvio, el servidor es quien de verdad lo hace cumplir).

**Pedido:** confirmar que `POST /propiedades` valida el mismo techo (o uno que el equipo defina) server-side. Sin esto, alguien puede publicar un precio absurdo llamando al endpoint directo.

## 4. Auto-revocación del último admin — regla de servidor, no solo de UI

**Contexto:** `admin/usuarios/page.tsx` ahora muestra una advertencia explícita + checkbox de confirmación cuando un admin intenta bloquearse o revocarse a sí mismo — pero es solo fricción de UI, no una garantía. Alguien podría llamar `POST /admin/usuarios/:id/revocar-admin` directo sobre su propio id.

**Pedido:** que `POST /admin/usuarios/:id/revocar-admin` (y `/bloquear`) rechace la acción si `id === adminId` de la sesión Y es el último admin activo (`count({where:{esAdmin:true}}) === 1`) — mismo criterio que ya se documentó como pendiente en el plan del panel de administración. Sin esto, un solo clic accidental (o un ataque que abuse del endpoint directo) puede dejar la plataforma sin ningún admin.

## 5. Puntos 100% backend, no auditables desde el frontend

Sin evidencia file:line posible desde este repo — recomendado auditar directo en el repo NestJS:

- **Parseo de precios en la IA de búsqueda** — rangos, decimales, "1.5m", `min > max` en "entre X y Y".
- **Timing exacto del 3er aviso de moderación de búsqueda** — si el bloqueo aplica antes o después de servir la respuesta que lo dispara.
- **Cuentas anónimas y el sistema de 3 avisos** — confirmar si pueden repetir el mismo patrón de abuso sin acumular avisos (el sistema es descrito como solo para cuentas con sesión).
- **Spoofing de `X-Forwarded-For`** — confirmar que la corrección ya aplicada a las rutas de búsqueda no deja alguna otra ruta con el mismo patrón vulnerable sin corregir.

## Resumen

| # | Punto | Acción pedida |
|---|---|---|
| 1 | Fail-open de moderación de fotos | Marcar para revisión manual en vez de aprobar sin señal cuando la IA falla |
| 2 | Validación de contenido de archivo | Confirmar que ya valida magic bytes, no solo Content-Type |
| 3 | Techo de precio | Validar el mismo límite (o uno definido por el equipo) en `POST /propiedades` |
| 4 | Auto-revocación de admin | Rechazar en servidor si es el último admin, no solo advertir en UI |
| 5 | Parseo de precios, timing de moderación, bypass anónimo, spoofing de IP | Auditoría directa en el repo NestJS — sin evidencia posible desde aquí |
