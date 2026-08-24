---
name: verificacion-backend-en-vivo
description: Verifica en vivo, contra el backend real de producción de Vive Villahermosa, cómo se comporta un endpoint (validación estricta, campos aceptados/rechazados, códigos de error) usando una cuenta de prueba desechable que SIEMPRE se borra al terminar. Usar antes de diseñar un contrato nuevo (docs/BACKEND-*.md) o de confiar en un supuesto sobre cómo valida el backend — nunca asumir, probar.
---

# Verificación en vivo contra el backend real

No hay entorno de staging — el único backend real es producción
(`https://api.vivevillahermosa.corestacksolutions.com.mx/api/v1`). Cada
vez que un diseño de frontend depende de un supuesto sobre cómo se
comporta el backend (¿rechaza campos desconocidos? ¿qué código de error
da? ¿tolera un query param que no reconoce?), ese supuesto se prueba en
vivo — no se asume. Esta sesión ya encontró un bug real así (`PATCH
/propiedades/:id` rechazaba TODO el request con 400 si el body traía un
campo que no reconocía) y estuvo a punto de repetir el mismo error de
diseño una segunda vez por no volver a probar antes de asumir.

El riesgo real de esto es dejar basura en producción — cuentas de prueba
huérfanas, propiedades de prueba visibles públicamente. Esta skill existe
para que la limpieza sea una parte obligatoria del flujo, no un paso que
se puede olvidar bajo presión cuando la prueba encontró algo interesante.

## Cuándo usar

- Antes de escribir un `docs/BACKEND-*.md` que asuma cómo el backend va a
  validar/aceptar algo nuevo.
- Cuando un bug reportado por el usuario podría ser del backend, no del
  frontend, y hace falta reproducirlo con datos reales para confirmarlo.
- Cuando `backendApi.ts`/`BackendApiError` da un mensaje ambiguo y hace
  falta ver el body de error real para saber qué campo lo causó.

## Regla no negociable: la cuenta de prueba SIEMPRE se borra

Sin excepción, incluso si la prueba falla, incluso si se encuentra un bug
interesante a mitad de camino, incluso si hay que interrumpir para
reportar algo al usuario primero. El último paso de este flujo (`DELETE
/auth/cuenta`) se ejecuta siempre — si algo salió mal a mitad de la
prueba, limpiar es lo primero que se hace al retomar, antes de investigar
más.

## Flujo

1. **Cuenta desechable.** `POST /auth/registro` con un correo con
   timestamp real (ej. `test-$(date +%s)@vivevillahermosa-test.local`) —
   nunca reusar una cuenta de prueba de una sesión anterior, puede tener
   estado que contamine el resultado. Guardar cookies de sesión en un
   archivo temporal del scratchpad (`curl -c cookies.txt`), no en el
   working directory del repo.

2. **Reproducir la duda concreta**, con `curl -b cookies.txt`, aislando
   UNA variable a la vez:
   - ¿Rechaza un campo desconocido en el body? Mandar el payload válido
     conocido, luego el mismo + 1 campo extra, comparar códigos.
   - ¿Tolera lo mismo como query param? Repetir moviendo el campo ahí.
   - Guardar el status code Y el body completo de cada respuesta — el
     mensaje de error de NestJS (`property X should not exist`, etc.)
     suele decir exactamente qué campo lo disparó.

3. **Si la prueba necesita una propiedad de prueba** (para probar
   `PATCH`/`DELETE /propiedades/:id`), crearla con datos obviamente
   ficticios (título con prefijo `[PRUEBA]`, precio simbólico) para que
   sea inconfundible si por algún motivo la limpieza fallara.

4. **Registrar el hallazgo** — qué se probó, status code, body de
   respuesta, y la conclusión concreta ("el backend rechaza X, acepta Y")
   antes de borrar nada. El hallazgo es lo que vale, no la cuenta.

5. **Limpieza, siempre**, en este orden:
   - `DELETE /propiedades/:id` de cualquier propiedad de prueba creada.
   - `DELETE /auth/cuenta` con la sesión activa.
   - Confirmar con un `GET`/login fallido que la cuenta ya no existe —
     no asumir que el DELETE funcionó solo porque devolvió 200.

6. **Aplicar el hallazgo** — recién con la limpieza confirmada, usar la
   conclusión para escribir el `docs/BACKEND-*.md` o corregir el código
   que dependía del supuesto equivocado.

## Ejemplo real (esta sesión)

Duda: ¿el body de `PATCH /propiedades/:id` tolera campos que no están en
el DTO? Se crearon 2 propiedades de prueba reales, se probó el PATCH con
`motivo`/`encontradoEnPlataforma` en el body → 400
(`"property motivo should not exist"`). Se probó lo mismo como query
string → 200. Conclusión aplicada: todo dato nuevo de esa feature se
manda por query params, nunca por body. Cuentas y propiedades de prueba
borradas al confirmar el hallazgo, antes de tocar el código del
frontend.

## Errores comunes a evitar

- Probar con una cuenta real de un usuario en vez de una desechable.
- Asumir que el comportamiento es igual en `POST` porque ya se confirmó
  en `PATCH` — un `ValidationPipe` global suele ser igual de estricto en
  ambos, pero **confirmarlo** es el punto de esta skill, no asumirlo por
  analogía (esto casi pasó esta misma sesión).
- Dejar la cuenta de prueba "para después" — bórrala en la misma pasada
  en la que la creaste.
- No guardar el body completo del error — el status code solo no basta
  para saber qué campo específico lo causó.
