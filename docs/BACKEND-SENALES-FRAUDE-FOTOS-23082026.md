# Backend — persistir y exponer señales de fraude ya detectadas en fotos (2026-08-23)

## Contexto / por qué

Pedido explícito: conectar al panel admin la detección de fraude que ya
existe pero se descarta. Al publicar, cada foto pasa por Gemini vision y
el resultado incluye `apta`, `relacionada` y `señalesFraude: string[]`
(foto que no parece ser del inmueble, señales de manipulación, etc.).

**Corrección importante sobre el primer intento de esta tarea:** el plan
original era que el FRONTEND mandara el resultado de su propio chequeo
(`analizarFoto()` en `PublishForm.tsx`, que llama a `POST
/ia/analizar-imagen` sobre una miniatura de 512px, solo para avisarle al
publicador en el momento) como un campo nuevo dentro del body de
`POST /propiedades`. **Se revirtió antes de comitear** — `backendApi.ts`
ya deja documentado que el `ValidationPipe` de NestJS es global
(comentario `BACKEND-AUDITORIA-EXHAUSTIVA-20082026`), y el bug real ya
confirmado en vivo esta misma sesión (`PATCH /propiedades/:id` rechaza
TODO el request con 400 si el body trae un campo que no reconoce) casi
seguro aplica igual a `POST /propiedades`, porque un pipe global no se
configura distinto por endpoint salvo que alguien lo haya hecho a
propósito. Mandar un campo nuevo sin confirmar eso primero arriesgaba
romper la publicación de CUALQUIER propiedad — mucho peor que no tener
esta feature. No se implementó nada en el frontend por esta vía.

## La solución real no necesita tocar el frontend

`PublishForm.tsx` ya deja documentado (comentario junto a la subida de
fotos) que **el servidor vuelve a analizar cada foto con Gemini por su
cuenta**, de forma independiente y más confiable que el chequeo del
navegador (imagen completa, no una miniatura de 512px), como parte de
`POST /propiedades/fotos` — antes de aceptarla y subirla a Cloudinary.
Ese resultado hoy se usa solo para decidir aceptar/rechazar la foto y
después se descarta. **No hace falta que el frontend mande nada nuevo —
el backend ya tiene la señal real, en el mejor momento posible, solo
falta que la guarde en vez de tirarla.**

## Modelo de datos nuevo

```
AlertaFoto
  id          String   @id
  fotoUrl     String   // la URL de Cloudinary ya devuelta por /propiedades/fotos
  apta        Boolean
  relacionada Boolean
  senales     String   // JSON.stringify(string[]) — SQLite no soporta arrays nativos en Prisma
  notas       String?
  createdAt   DateTime @default(now())

  @@index([fotoUrl])
```

Se escribe en `POST /propiedades/fotos`, en el mismo momento en que hoy
se decide aceptar/rechazar — un registro por foto, exista o no señal
(así el admin también puede ver fotos limpias como contraste, no solo
las marcadas). Alternativa más simple si se prefiere: solo escribir el
registro cuando `!apta || !relacionada || señales.length > 0` — menos
filas, pero pierde el contraste de "cuántas fotos se revisan en total".

## Cómo se conecta con la propiedad ya publicada

No hace falta ninguna relación nueva ni depende de `Property.userId`
(ese gap es sobre el DUEÑO, no sobre la propiedad en sí — `Property` ya
es una tabla real). Con `fotoUrl` guardado, alcanza con:

```sql
SELECT p.*, a.*
FROM "Property" p, "AlertaFoto" a
WHERE a."fotoUrl" = ANY(p.fotos)  -- o el equivalente según cómo esté guardado Property.fotos
```

## Endpoint admin nuevo

`GET /api/admin/alertas-fotos` (gateado por `requireAdmin()`, mismo
patrón que el resto de `/api/admin/**` — ver plan de panel de
administración) — lista paginada de `AlertaFoto` con `apta:false` o
`señales.length > 0`, unida con los datos básicos de la propiedad dueña
(`titulo`, `id`, `municipio`) para que el admin pueda saltar directo a
revisarla. Vista nueva en `/admin/alertas-fotos`, mismo estilo de tabla
de solo lectura que ya se planea para `/admin/intentos-sospechosos`.

## Fuera de alcance

- Cambiar el chequeo del frontend (`analizarFoto()`, aviso al publicador
  en el momento) — sigue exactamente igual, sirve un propósito distinto
  (avisar ANTES de subir, con una miniatura liviana) y no es lo que se
  persiste aquí.
- Bloquear la publicación automáticamente por señales de fraude — esto es
  solo visibilidad para revisión humana, igual que el resto del panel
  admin (nunca acción automática sobre una cuenta/propiedad sin que un
  admin decida).
