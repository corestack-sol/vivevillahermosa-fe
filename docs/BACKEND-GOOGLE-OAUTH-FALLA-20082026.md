# Login con Google falla para una cuenta específica — reporte de bug — 2026-08-20

## Síntoma

Un usuario reporta que al iniciar sesión con Google, la plataforma no lo redirige a ningún lado — se queda en `/auth/login`. Otro usuario, mismo flujo, mismo botón "Continuar con Google", **inicia y cierra sesión sin problema** — descarta un bug general de configuración/redirect URI de OAuth, esto es específico a la cuenta/correo de Google del primer usuario.

## Diagnóstico hecho en vivo (sesión de soporte, navegador real)

Navegador: Microsoft Edge, escritorio, sin modo incógnito, "Prevención de seguimiento" en Balanceado (se descartó como causa).

1. Se guio al usuario a abrir DevTools → pestaña Aplicación → Cookies, intentar el login, y revisar si `vv_session` se guarda.
2. **`vv_session` sí aparece** después del intento — la cookie se está escribiendo.
3. Pese a eso, la página no redirige — se queda mostrando el formulario de login (`AuthContext.refresh()` nunca resuelve un `user` válido, si lo hiciera el propio `/auth/login` ya redirige solo — ver `src/app/auth/login/page.tsx:61-63`, `router.replace(next)` cuando `user` existe).
4. Se le pidió repetir el intento y copiar la URL final de la barra de direcciones. Resultado exacto:

```
https://vivevillahermosa.corestacksolutions.com.mx/auth/login?error=oauth_failed
```

## Lo que esto indica

`oauth_failed` **no es uno de los códigos que el frontend reconoce** — `src/app/auth/login/page.tsx:101-109` solo mapea `config`, `state`, `token`, `profile`, `no_email`, `account_exists`, `bloqueado` a un mensaje específico; cualquier otro código (como este) cae al mensaje genérico "Error al autenticar. Intenta de nuevo." El frontend está funcionando como se espera — el problema es 100% del lado del backend, en el manejo del callback de Google.

**La combinación de datos (cookie presente + error) sugiere una falla a medio camino**: el handler del callback de Google parece estar escribiendo la cookie de sesión (u otra cookie con el mismo nombre, de un intento anterior) antes de completar todo el flujo, y luego truena en algún paso posterior — creación/búsqueda de la cuenta, algún conflicto con un correo que ya existe de otra forma, un error de base de datos, etc. — cayendo al catch genérico que redirige con `error=oauth_failed` sin limpiar o invalidar la cookie que ya se había puesto. El resultado es una cookie que existe pero no corresponde a una sesión completa/válida (`GET /auth/me` no la resuelve).

## Pedido

1. **Revisar logs/error tracking del backend filtrando por `oauth_failed`** — debería haber una excepción real capturada ahí. Buscar específicamente entradas para el correo de Google de la cuenta afectada (el usuario puede proporcionarlo directo al equipo de backend, no se incluye aquí).
2. **Confirmar que la cookie de sesión solo se escribe DESPUÉS de que el flujo completo tuvo éxito** — si algo revienta después de haberla puesto, debería invalidarse/limpiarse antes de redirigir al error, no dejarla ahí a medias.
3. **Considerar códigos de error más específicos** que `oauth_failed` (ej. `oauth_db_error`, `oauth_email_conflict`, etc.) — el frontend ya tiene la estructura lista (`oauthErrorMsg`) para mostrar un mensaje distinto por cada uno en cuanto el backend los distinga; hoy todo lo que no es uno de los 7 códigos conocidos cae al mismo mensaje genérico, lo que hace más lento diagnosticar el caso real de cada usuario.

## Resumen

| # | Qué | Acción pedida |
|---|---|---|
| 1 | Revisar logs por `oauth_failed` para el correo de Google afectado | Encontrar la excepción real que dispara este código |
| 2 | Cookie de sesión escrita antes de que el flujo termine con éxito | Solo escribirla al final, o limpiarla si algo falla después |
| 3 | `oauth_failed` es demasiado genérico | Códigos de error más específicos, el frontend ya está listo para mostrarlos distinto |
