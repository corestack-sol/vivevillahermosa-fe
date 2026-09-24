# Nombre y correo de contacto fijos de la cuenta + correo verificado para publicar (23-09-2026)

Decisión de producto: la plataforma es para quien está registrado (no para terceros) y cada agente de una inmobiliaria tiene su **propia cuenta** (creada desde la cuenta principal que paga el plan), con su propio nombre y correo. Por eso:

1. El **nombre** y el **correo** de contacto de una propiedad son siempre los de la cuenta que publica. No se editan en el formulario; se cambian en "Mi cuenta" (donde el correo se re-verifica).
2. Para **publicar** hace falta tener el correo **verificado**.
3. El **WhatsApp** sigue siendo libre (no forma parte de la cuenta ni se verifica).

El front ya lo hace así (campos con candado que apuntan a "Mi cuenta", aviso para reenviar el correo de verificación, y detección automática cuando se verifica). **Pero un candado en el formulario no es un control**: cualquiera puede llamar al API directo.

## Verificado en vivo (producción, cuentas desechables ya borradas)

- `POST /propiedades` acepta cualquier `agenteNombre` y `agenteEmail`, aunque no coincidan con la cuenta: se publicó con `agenteNombre: "Otro Nombre Comercial"` y `agenteEmail: "contacto-distinto@ejemplo.com"` y `GET /propiedades/mias` los devolvió tal cual.
- `POST /propiedades` **no exige correo verificado**: las cuentas nuevas (`emailVerificado: false`) publicaron sin problema.
- `GET /auth/me` ya devuelve `emailVerificado`; el front lo usa para detectar la verificación sin recargar (consulta cada 6 s mientras el aviso está visible).

## Pedidos

1. **Nombre y correo desde la cuenta, en el servidor.** En `POST /propiedades` y `PATCH /propiedades/:id`, ignorar `agenteNombre`/`agenteEmail` del body y usar los del usuario autenticado (o responder 400 si difieren). Idealmente no copiarlos: leerlos de la cuenta al servir la propiedad, para que un cambio de nombre en "Mi cuenta" se refleje en todas sus publicaciones y los reportes queden homogéneos. Definir qué hacer con las propiedades ya guardadas con otro nombre/correo.
2. **Correo verificado obligatorio para publicar.** `POST /propiedades` responde 403 con un `code` estable (por ejemplo `EMAIL_NO_VERIFICADO`) si `emailVerificado` es `false`. El front ya bloquea antes de enviar y mostrará el mensaje del servidor si llegara.
3. **Cuentas de agente.** Confirmar que cada agente creado desde la cuenta principal tiene su propio `nombre`, `email` y verificación, y que se aplican las mismas reglas. Si el contacto de una propiedad debiera mostrar a la inmobiliaria en vez del agente, avisar antes de implementar nada.
4. `POST /auth/reenviar-verificacion`: el front lo llama con una espera de 60 s entre envíos. Confirmar el límite real y que responde 429 con un mensaje claro si se excede.
