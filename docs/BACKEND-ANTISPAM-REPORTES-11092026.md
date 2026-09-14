# Anti-spam real en `POST /propiedades/reportar` — resuelto

**Fecha:** 2026-09-11. **Estado (2026-09-14): RESUELTO del lado del
backend, sin cambios de contrato.** Confirmado por el backend: ahora un
reporte repetido desde la misma IP (o mismo usuario si hay sesión) sobre
la misma propiedad dentro de 24h se ignora en silencio del lado del
servidor — el endpoint sigue respondiendo `200 { ok: true }` igual,
nada que cambiar del lado del frontend. `src/lib/reportedProperties.ts`
(mitigación de aviso rápido en localStorage) sigue funcionando, ahora es
puramente cosmético — la protección real ya no depende de él.

**Por qué hace falta:** el reporte de anuncios es anónimo por diseño (no
requiere sesión, `ReportButton.tsx`) y, según el texto ya existente en
`admin/reportes/page.tsx`, 3+ reportes de fraude/info falsa sobre la misma
propiedad la marcan `requiereModeracion=true` automáticamente. Sin
deduplicación real del lado del servidor, esto es un vector plausible de
sabotaje: cualquiera puede forzar el estado "en revisión" sobre el anuncio
de un competidor reenviando el mismo reporte varias veces.

**Mitigación ya aplicada (frontend, insuficiente por sí sola):**
`src/lib/reportedProperties.ts` — recuerda en `localStorage` (por
navegador, sin cuenta, ya que el reporte es anónimo) qué propiedades ya se
reportaron desde ahí, y `ReportButton.tsx` muestra "Ya reportaste este
anuncio" en vez del formulario cuando ya hay un registro. Esto solo evita
el caso tonto (cerrar/reabrir el modal, recargar la página) — cualquiera
que borre `localStorage` o use otro navegador/dispositivo lo evade sin
esfuerzo. No es una defensa real.

**Pendiente de verificar en vivo** (no se hizo en esta pasada de
auditoría, solo lectura de código): ¿`POST /propiedades/reportar`
deduplica por IP+propiedadId, o por lo que sea que identifique al
reportante anónimo? Si no lo hace, se recomienda:

- Deduplicar por IP (o huella equivalente) + `propiedadId` dentro de una
  ventana de tiempo razonable (ej. 1 reporte por IP por propiedad cada
  24h), rechazando o ignorando silenciosamente los repetidos.
- Rate-limit general sobre el endpoint (ya debería existir un patrón
  reusable, ver el resto de `docs/BACKEND.md` para los límites ya
  aplicados a otras rutas anónimas/públicas).

Si el backend ya lo hace, este documento puede archivarse — verificar con
la skill `verificacion-backend-en-vivo` (cuenta desechable, reportes
repetidos contra una propiedad de prueba, confirmar si el segundo/tercer
intento se rechaza o se cuenta igual) antes de invertir más tiempo del
lado del frontend en esto.
