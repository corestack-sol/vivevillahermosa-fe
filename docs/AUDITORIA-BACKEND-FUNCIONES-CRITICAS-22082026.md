# Auditoría exhaustiva — funciones que no pueden fallar (2026-08-22)

## Por qué este documento

Este ciclo de trabajo (frontend) encontró varios bugs reales en funciones que
llevaban tiempo en producción sin detectarse — no errores de un caso raro,
sino fallas que afectaban a CUALQUIER usuario, todo el tiempo:

- `esProfesional` comparaba contra un rol (`'inmobiliaria'`) que nunca
  existió en el enum real del backend — la función estuvo rota para
  absolutamente todos desde que se escribió, en 9 archivos, sin que nadie lo
  notara hasta hoy.
- El límite de tasa del buscador con IA se podía saltar falsificando el
  header `X-Forwarded-For`.
- Una combinación de opciones del formulario de publicar dejaba el contacto
  del propietario roto en silencio (sin error visible, simplemente no
  aparecía nada que mostrarle a quien visitaba la ficha).
- Fotos de cámaras recientes se rechazaban en silencio al publicar, sin
  ninguna explicación, por un límite de tamaño demasiado bajo.

Ninguno de estos bugs era exótico — todos vivían en el camino principal del
producto. Este documento identifica qué funciones, del lado del backend,
merecen ese mismo nivel de escrutinio: no "revisar que funcione", sino
auditar activamente buscando la falla, con la misma actitud con la que se
encontraron los bugs de arriba.

**Cómo usar esto:** las funciones están en dos niveles. Tier 0 es lo que
literalmente sostiene el negocio o maneja algo irreversible/sensible — un
bug aquí es un incidente, no un ticket de mejora. Tier 1 importa y debe
funcionar bien, pero un fallo puntual es recuperable. Al final hay una
sección de qué NO auditar todavía (funciones a medio construir o 100% de
muestra) para no gastar tiempo revisando algo que ya se sabe que no es real.

---

## Tier 0 — no puede fallar, bajo ninguna condición

### A. Autenticación y sesión

**Qué cubre:** `POST /auth/registro`, `POST /auth/login`, login con Google
(OAuth), `POST /auth/logout`, recuperación de contraseña, verificación de
sesión en cada request autenticado.

**Por qué es Tier 0:** todo lo demás depende de que esto sea correcto. Un
bug aquí no rompe una función, rompe TODAS las que requieren sesión.

**Invariantes que nunca deben romperse:**
- Una sesión vencida/revocada no debe seguir autenticando requests, sin
  importar cuánto tiempo lleve el token en el navegador.
- Una cuenta bloqueada (`bloqueado: true`) no debe poder iniciar sesión NI
  seguir usando una sesión ya activa — la revocación debe ser en tiempo
  real, no solo al próximo login.
- El login con Google y el login con email/password deben terminar en el
  MISMO estado de sesión — ya se reportó un caso real (no confirmado si es
  bug de backend o de callback) donde el login con Google no respeta la
  página de destino (`next`) que sí respeta el login normal.

**Casos borde a probar activamente:**
- Registrar dos cuentas con el mismo correo en paralelo (race condition
  clásica de "verificar si existe, luego crear").
- Login con credenciales correctas justo en el momento en que un admin
  bloquea esa misma cuenta — ¿gana el login o el bloqueo?
- Token/cookie de sesión manipulado a mano (rol distinto, `esAdmin: true`
  inyectado) — el servidor nunca debe confiar en ese campo si viene del
  cliente, debe recalcularlo desde la base de datos en cada request.
- Recuperación de contraseña: ¿el link/token de recuperación expira? ¿se
  puede reusar dos veces? ¿revela si un correo existe o no en el sistema
  (fuga de información)?

---

### B. Revelar contacto del propietario

**Qué cubre:** `GET /propiedades/:id/contacto`.

**Por qué es Tier 0:** este endpoint ES el modelo de negocio. La plataforma
completa depende de que el contacto (teléfono/WhatsApp/correo) solo se
revele a alguien con sesión iniciada — si se puede obtener sin sesión, o en
volumen, cualquiera puede scrapear el catálogo completo de contactos gratis
y el producto pierde su única razón de ser.

**Invariantes que nunca deben romperse:**
- Cero contacto revelado sin sesión válida — sin excepciones, sin endpoints
  alternos que lo filtren indirectamente (ej. algún endpoint de exportación,
  reporte, o webhook que incluya el campo completo sin querer).
- El campo de contacto NUNCA debe aparecer en el payload de listados
  públicos (`GET /propiedades`, `GET /propiedades/:id`) — solo en este
  endpoint dedicado, y solo tras validar sesión.
- Rate limiting real por cuenta — ya se encontró y corrigió una fuga real
  de contacto en volumen esta sesión de trabajo; confirmar que no existe una
  ruta equivalente sin ese límite (ej. un endpoint viejo, uno de admin, uno
  de exportación a CSV/reporte).

**Casos borde a probar activamente:**
- Pedir el contacto de 100 propiedades distintas en rápida sucesión con la
  misma cuenta — ¿hay un límite real, o solo existe del lado del frontend?
- Pedir contacto de una propiedad `pausada`/`vendida`/`rentada` — el
  frontend ya oculta el botón, pero eso es cosmético; el servidor debe
  rechazarlo igual si alguien llama al endpoint directo.
- Confirmar que el mismo dato no se filtra por otra vía: notificaciones,
  logs expuestos, respuesta de error verbosa que incluya el objeto completo.

---

### C. Publicar propiedad

**Qué cubre:** `POST /propiedades`, `POST /propiedades/fotos`.

**Por qué es Tier 0:** es la otra mitad del negocio — sin publicaciones
reales no hay catálogo. Además toca el límite de plan gratuito (3
propiedades activas), que es una regla de negocio real con dinero implícito
detrás (el argumento de upgrade a plan profesional).

**Invariantes que nunca deben romperse:**
- El límite de propiedades activas (hoy 3) se hace cumplir en el SERVIDOR,
  nunca solo confiando en que el frontend ya lo revisó — el frontend lo
  revisa para no hacer perder el tiempo al usuario, pero es trivial de
  saltar con una llamada directa al API.
- `alertaFraude` / cualquier señal de riesgo calculada por IA debe
  recalcularse en el servidor a partir de los datos reales recibidos —
  nunca aceptar ese campo tal cual si llega en el body del request (es
  trivial de falsificar u omitir desde el cliente). Esto ya está marcado
  como pendiente en el código fuente del frontend.
- Una publicación a medio completar (ej. falla la subida de la foto 3 de 5,
  o el proceso se corta a medio camino) no debe dejar la propiedad en un
  estado inconsistente ni "fantasma" en la base de datos — o se publica
  completa, o no se publica nada.
- El límite de tamaño de `/propiedades/fotos` (confirmado en 8MB, sin
  compresión del lado del servidor) debe devolver un error claro y
  distinguible (no un 500 genérico) para que el frontend pueda mostrar un
  mensaje específico — confirmar qué código/mensaje devuelve hoy.

**Casos borde a probar activamente:**
- Publicar la propiedad número 4 activa mientras ya se tienen 3 —
  simultáneo, no secuencial (dos requests de publicar disparados casi al
  mismo tiempo cuando se está justo en el límite).
- Mandar `precio: -1000`, `precio: 0`, `precio: 99999999999999`,
  `m2Construidos` negativo, `tipo`/`operacion` con un valor que no existe en
  el enum — directo por API, sin pasar por el formulario.
- Subir un archivo que no es imagen real con extensión `.jpg` (magic bytes
  falsos) al endpoint de fotos.
- Publicar dos veces con el mismo payload exacto muy rápido (doble clic en
  "Publicar") — ¿se crean dos propiedades duplicadas?

---

### D. Eliminar cuenta

**Qué cubre:** `DELETE /auth/cuenta`.

**Por qué es Tier 0:** es irreversible y toca datos personales — el peor
tipo de bug aquí no es "no funcionó", es "borró algo de la cuenta
equivocada" o "dejó datos huérfanos de alguien que ya no existe".

**Invariantes que nunca deben romperse:**
- Solo borra la cuenta DEL TOKEN/SESIÓN que hace el request — nunca acepta
  un ID de usuario distinto en el body/params sin validarlo contra la
  sesión.
- Borra TODO lo asociado (propiedades, favoritos, alertas, notificaciones,
  intentos sospechosos, solicitudes de revisión) o explícitamente decide y
  documenta qué se conserva y por qué (ej. por requisitos legales/de
  auditoría) — nunca deja registros huérfanos apuntando a un `userId` que ya
  no existe.
- Si falla a medio proceso (se borran favoritos pero no la cuenta, por
  ejemplo), no debe quedar un estado parcial silencioso — o transacción
  completa, o rollback completo, con un error claro de vuelta al frontend.

**Casos borde a probar activamente:**
- Doble clic / doble request de eliminar cuenta casi simultáneo — ¿el
  segundo request falla limpio (cuenta ya no existe) o hace algo raro?
- Eliminar una cuenta que tiene propiedades activas — ¿qué pasa con esas
  publicaciones? ¿se archivan, se borran, quedan huérfanas visibles al
  público?

---

### E. Gestión de una propiedad propia (editar/pausar/archivar/eliminar/destacar)

**Qué cubre:** `PATCH /propiedades/:id`, `DELETE /propiedades/:id`.

**Por qué es Tier 0:** es el vector clásico de IDOR (Insecure Direct Object
Reference) — cualquier endpoint que reciba un `:id` en la URL y modifique/
borre algo es sospechoso por defecto hasta confirmar que valida dueño.

**Invariantes que nunca deben romperse:**
- El usuario que hace el request debe ser DUEÑO real de esa propiedad
  (`Property.userId === session.userId`) — validado en el servidor, en
  CADA una de las acciones (editar, pausar, archivar, eliminar, destacar),
  no solo en una de ellas.
- `featured: true` (destacar) — confirmar que el servidor también valida
  algún criterio de negocio si existe uno (ej. plan/rol), y no solo confía
  en que el frontend ocultó el botón para cuentas no-profesionales — el
  frontend YA tenía este exacto bug esta sesión (el gate de rol comparaba
  contra un valor que no existía) y hubiera sido trivialmente explotable si
  alguien llamaba al endpoint directo mientras tanto.

**Casos borde a probar activamente:**
- Usuario A intenta `PATCH`/`DELETE` sobre el `:id` de una propiedad de
  usuario B, llamando al API directo (sin pasar por el frontend).
- Marcar como `featured: true` una propiedad desde una cuenta sin el
  rol/plan correspondiente, directo por API.
- Cambiar `estado` a un valor fuera del enum válido (`activa`, `pausada`,
  `vencida`, `vendida`, `rentada`).

---

### F. Moderación y bloqueo de cuenta

**Qué cubre:** el sistema de 3 intentos sospechosos (`IntentoSospechoso`),
bloqueo automático de cuenta, rate limiting del buscador con IA, y
cualquier otro lugar del backend que tome una decisión de seguridad
basándose en datos que vienen del cliente (headers, IP reportada, etc.).

**Por qué es Tier 0:** ya se encontró y corrigió una vulnerabilidad real
esta sesión — el rate limit se saltaba falsificando el header
`X-Forwarded-For`. Ese es un patrón, no un caso aislado: cualquier lugar del
backend que confíe en un header controlado por el cliente para tomar una
decisión de seguridad tiene el mismo riesgo.

**Invariantes que nunca deben romperse:**
- Ningún límite de tasa (búsqueda con IA, contacto, cualquier otro) debe
  depender de un valor que el cliente puede falsificar sin control
  (`X-Forwarded-For` sin validar contra el proxy/CDN real, `User-Agent`,
  cualquier header custom).
- El contador de intentos sospechosos debe estar atado a la CUENTA
  (userId), no solo a la IP/sesión — alguien no debe poder resetear su
  contador cerrando sesión y volviendo a entrar.
- El bloqueo debe ser efectivo de inmediato — no solo en el próximo login,
  sino revocando cualquier sesión activa en ese momento.

**Casos borde a probar activamente:**
- Repetir el ataque que ya se encontró (header `X-Forwarded-For`
  falsificado) contra CADA endpoint que tenga algún tipo de límite de tasa,
  no solo el que ya se corrigió — confirmar que la corrección se aplicó de
  forma centralizada y no caso por caso.
- Disparar el 3er intento sospechoso y confirmar que la sesión activa en
  ESE MISMO momento (en otra pestaña/dispositivo) deja de funcionar sin
  necesidad de refrescar/volver a entrar.

---

### G. Contactar al propietario (mensaje)

**Qué cubre:** `POST /propiedades/:id/contactar`.

**Por qué es Tier 0-alto (frontera con Tier 1):** es un canal de mensajería
real hacia un correo/persona real — abuso aquí (spam masivo) tiene un costo
directo de reputación/entregabilidad de correo para la plataforma completa,
no solo para un usuario.

**Casos borde a probar activamente:**
- Enviar 50 mensajes seguidos a la misma propiedad (o a 50 propiedades
  distintas) desde la misma cuenta/IP en poco tiempo — ¿hay límite real?
- Confirmar que el campo de mensaje se sanitiza antes de insertarse en el
  correo que recibe el propietario (inyección de encabezados de correo,
  HTML/script si el correo se renderiza como HTML).

---

## Tier 1 — importa, pero un fallo puntual es recuperable

- **Favoritos / Alertas** (`GET`/`POST`/`DELETE /favoritos`, `/alertas`) —
  pérdida de un dato molesta al usuario pero no es catastrófica ni
  irreversible del lado del negocio. Validar igual que un usuario no pueda
  ver/borrar favoritos o alertas de otra cuenta (mismo patrón IDOR que la
  sección E).
- **Búsqueda y filtros** (`GET /propiedades` con query params) — un bug
  degrada la experiencia pero no rompe una transacción de negocio. Vale la
  pena revisar rendimiento bajo filtros combinados raros más que
  seguridad.
- **Notificaciones** (`GET`/`PATCH /notificaciones`) — mismo criterio,
  validar propiedad del recurso (que un usuario no pueda marcar como
  leídas las notificaciones de otro).
- **Panel de administración** (`/api/admin/**` — usuarios, solicitudes de
  revisión, reportes, auditoría) — importante para confianza/seguridad del
  ecosistema, pero el flujo comprador-vendedor no depende de que esto sea
  perfecto minuto a minuto. Sí vale la pena confirmar que **todas** las
  rutas `/api/admin/**` exigen `esAdmin: true` recalculado server-side en
  cada request (no en el token) — mismo criterio que la sección A.
- **`POST /ia/analizar-fraude`, `POST /ia/analizar-imagen`,
  `POST /ia/generar-anuncio`** — si fallan, el frontend ya está diseñado
  para seguir funcionando sin bloquear al usuario (fail-open intencional).
  Vale la pena confirmar tiempos de respuesta razonables y que un error acá
  nunca tire abajo el flujo de publicar completo.

---

## Fuera de alcance de esta auditoría (por ahora)

Para no gastar tiempo revisando algo que ya se sabe que no es real o está
en pausa:

- **Leads** (`/dashboard/leads`) — confirmado en una auditoría de seguridad
  anterior de esta misma sesión de trabajo: es 100% demo/fake, no hay
  bandeja de entrada real todavía.
- **Servicios (directorio de proveedores)** — pausado por decisión de
  producto, no priorizar.
- **Analítica de propiedades** (vistas/contactos) — hoy siempre en 0, no
  existe tabla de eventos real todavía.
- **Coach de calidad de anuncio** — la capa implementada hoy es 100%
  heurística de frontend, sin ninguna llamada nueva a backend todavía.

**Sin confirmar, avisar si alguna de estas SÍ es real hoy** (no se pudo
verificar con certeza desde el frontend en esta sesión): `dashboard/citas`
(agenda) y `dashboard/equipo` — si tienen persistencia real en base de
datos, deberían evaluarse para Tier 1 con el mismo criterio de "un usuario
no puede ver/modificar recursos de otro".

---

## Metodología sugerida (el cómo, no solo el qué)

1. **Concurrencia, no solo secuencia** — la mayoría de los casos borde de
   arriba dicen "simultáneo" a propósito. Un bug de race condition casi
   nunca aparece probando una acción a la vez.
2. **Autorización cruzada en cada endpoint con `:id`** — por defecto,
   asumir que un endpoint que recibe un ID de recurso es vulnerable a IDOR
   hasta confirmar que valida dueño/permiso en el servidor.
3. **Nunca confiar en un campo calculado que venga del cliente** — cualquier
   dato que el frontend calcule para mostrar (riesgo de fraude, distancia,
   validaciones) debe recalcularse en el servidor si se usa para una
   decisión real (guardar, bloquear, cobrar).
4. **Probar por API directo, no por el formulario** — el frontend ya valida
   lo obvio; el valor real de esta auditoría está en lo que pasa cuando se
   saltea esa capa.
5. **Confirmar atomicidad** — cualquier acción de varios pasos (publicar
   con fotos, eliminar cuenta con datos relacionados) debe ser todo-o-nada.
