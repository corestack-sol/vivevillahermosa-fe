# Recuperar contraseña en cuentas Google/Facebook — confirmado por backend

**Fecha:** 2026-09-10. **Estado: confirmado, comportamiento intencional-adjacente, no bug.**

**Origen:** duda real detectada al auditar `/auth/recuperar-password`
(bug del input de código, ver commit `2335c80`) — ¿qué pasa si alguien
registrado solo con Google/Facebook usa "recuperar contraseña"? No se
pudo verificar en vivo con curl (OAuth no se automatiza sin navegador
real), se le preguntó directo al equipo de backend.

## Respuesta del backend (textual, resumida)

1. **`POST /auth/recuperar-password` responde idéntico** para cuenta
   OAuth-only. `solicitar()` hace `findUnique({ where: { email } })` y
   nunca mira `user.password` — genera código real, lo guarda hasheado,
   manda el correo. Mismo `{ ok: true }` genérico y mismo padding de
   tiempo (~200ms) que cualquier otro caso — el criterio anti-enumeración
   se mantiene porque SÍ hace el trabajo completo, no porque lo salte.

2. **`.../confirmar` SÍ fija una contraseña real, sin chequear si ya
   tenía una.** `confirmar()` ejecuta:
   ```ts
   this.prisma.user.update({
     where: { id: user.id },
     data: { password: passwordHash, sesionesRevocadasDesde: new Date() },
   })
   ```
   Resultado: la cuenta queda con DOS formas de entrar — `googleId`/
   `facebookId` intactos (sigue funcionando OAuth) + `password` nuevo
   (ahora también funciona correo+contraseña, el guard de `login()` que
   antes decía "esta cuenta usa Google/Facebook" deja de dispararse).
   Efecto colateral: `sesionesRevocadasDesde` cierra TODAS las sesiones
   activas (incluida la abierta por Google) — hay que volver a iniciar
   sesión después, con cualquiera de los dos métodos. Mismo comportamiento
   que una recuperación normal.

3. **No está documentado como feature, pero no es un bug.** El código de
   recuperación llega al correo YA verificado de la cuenta — quien lo
   recibe demuestra control del inbox, que ya era el vector real de
   recuperación de la cuenta de Google de todos modos. No hay downgrade
   de seguridad: se pasa de 1 factor a 2 vías independientes. Es el mismo
   patrón que "agregar una contraseña a tu cuenta de Google" en la
   mayoría de plataformas grandes.

## Decisión

**Dejarlo como está** — no se bloquea. Backend explícitamente desaconseja
agregar un `if (!user.password) return` en `solicitar()`: rompería el
anti-enumeración (el comportamiento observable — correo recibido o no —
pasaría a diferir entre cuenta OAuth y cuenta normal) y quitaría una
capacidad legítima y usada por otras plataformas.

## Pendiente opcional (no urgente, no bloqueante)

- **Backend**: copy del correo de recuperación hoy dice "restablecer tu
  contraseña" / "tu contraseña sigue siendo la misma" — impreciso para
  quien nunca tuvo una. Podría condicionarse a "crear una contraseña"
  cuando `user.password` es `null` al momento de generar el código.
- **Frontend**: hint opcional en `/auth/login` tipo "¿Te registraste con
  Google? También puedes usar 'recuperar contraseña' para crear una y
  entrar sin Google." — ver si el usuario lo pide antes de construirlo,
  no implementado todavía.

## Frontend actual

`src/app/auth/recuperar-password/page.tsx` no distingue tipo de cuenta —
ni falta, según lo de arriba: el mismo flujo sirve para ambos casos sin
ningún cambio necesario.
