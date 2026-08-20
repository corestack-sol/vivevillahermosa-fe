# Recuperación de contraseña — contrato para backend — 2026-08-20

## Contexto

No existía ningún flujo de recuperación de contraseña en la plataforma (hallazgo de la auditoría de edge cases, `docs/AUDITORIA-EDGE-CASES-20082026.md`) — una persona que olvidaba su contraseña no tenía forma de recuperar su cuenta. El frontend ya está construido y en `master` (`src/app/auth/recuperar-password/page.tsx`, link "¿Olvidaste tu contraseña?" agregado en `/auth/login`); este documento es el contrato que le falta al backend (repo NestJS separado) para que funcione de verdad — hoy los dos endpoints que el frontend llama no existen.

## Flujo (3 pasos, confirmado con el usuario)

1. **Introducir correo registrado** — pantalla `paso: 'email'`.
2. **Revisar correo y obtener el código** — pantalla `paso: 'codigo'`, el paso en sí ocurre fuera de la plataforma (bandeja de entrada).
3. **Introducir el código y establecer una nueva contraseña** — mismo formulario que el paso 2 en el frontend (código + contraseña nueva + confirmación, un solo submit).

## Endpoints

### `POST /auth/recuperar-password`

Body: `{ "email": string }`

- Si el correo corresponde a una cuenta real: genera un código de **6 dígitos numéricos**, lo guarda (hasheado, no en texto plano — mismo criterio que una contraseña) junto con `email`, `expiraEn` (recomendado: 15 minutos) y un contador de intentos en 0, e invalida cualquier código previo sin usar para esa cuenta. Envía el código por correo.
- Si el correo NO corresponde a ninguna cuenta: no hacer nada del lado de datos, pero responder exactamente igual.
- **La respuesta HTTP es idéntica en ambos casos** (mismo status, mismo body genérico) — mismo criterio ya aplicado en `POST /cuenta/solicitar-revision`: nunca confirmar ni desmentir si un correo existe en el sistema. El frontend ya está escrito asumiendo esto (pasa al paso "revisa tu correo" sin importar la respuesta, salvo error de transporte real).
- **Rate limit por email y por IP** — sin esto, es un vector de spam de correos hacia cualquier dirección. El frontend tiene un cooldown de 30s en el botón "Reenviar", pero es solo cortesía de UI, no protección real.

### `POST /auth/recuperar-password/confirmar`

Body: `{ "email": string, "codigo": string (6 dígitos), "password": string (≥10 caracteres, mismo mínimo que registro) }`

- Válido solo si: existe un código activo para ese `email`, no expiró, coincide con el hash guardado, y el contador de intentos no superó el límite (recomendado: 5 intentos, luego invalidar el código y exigir pedir uno nuevo — el código de 6 dígitos es fuerza-bruteable sin este límite, ~1M combinaciones).
- Al confirmar: actualiza la contraseña (hasheada igual que en registro), invalida el código usado, y **cierra todas las sesiones activas de esa cuenta** (mismo espíritu que el chequeo de `bloqueado` en tiempo real de `getSession()` — si alguien más tiene una sesión abierta con la contraseña vieja, esta es la oportunidad de cortarla; conviene por seguridad aunque no fue pedido explícitamente).
- Errores esperados por el frontend (mensajes via `BackendApiError`): código incorrecto, código expirado, demasiados intentos.

## Seguridad — resumen de lo que ya se decidió

| Punto | Decisión |
|---|---|
| ¿Se confirma si el correo existe? | No, nunca — misma respuesta siempre |
| Formato del código | 6 dígitos numéricos |
| Vigencia del código | 15 minutos (sugerido, ajustable) |
| Intentos máximos por código | 5 (sugerido) |
| Rate limit de envío | Por email y por IP — obligatorio, sin esto es spam-as-a-service |
| Sesiones al cambiar contraseña | Cerrar todas las activas de esa cuenta |
| Almacenamiento del código | Hasheado, nunca texto plano |

## Correo

Reusa el mismo proveedor/patrón ya usado para otros correos transaccionales (alertas, resolución de solicitudes de revisión — ver `docs/BACKEND-ALERTAS-20082026.md` y el plan del panel admin). Contenido mínimo: el código de 6 dígitos, cuánto tarda en expirar, y una nota de "si no fuiste tú, ignora este correo".

## Resumen — acción para backend

| # | Qué | Acción |
|---|---|---|
| 1 | `POST /auth/recuperar-password` | Nuevo — genera código, envía correo, respuesta genérica siempre |
| 2 | `POST /auth/recuperar-password/confirmar` | Nuevo — valida código + intentos + expiración, actualiza contraseña, cierra sesiones activas |
| 3 | Rate limiting | Por email y por IP en el endpoint de envío |
| 4 | Límite de intentos | Por código, en el endpoint de confirmación |
| 5 | Email transaccional | Código + vigencia + aviso de "si no fuiste tú" |
