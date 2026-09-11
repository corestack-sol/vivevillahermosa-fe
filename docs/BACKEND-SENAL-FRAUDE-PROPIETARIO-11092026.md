# Señal de fraude "suena a propietario directo" — hallazgo real

**Fecha:** 2026-09-11. **Estado: confirmado en vivo, backend (IA de `/ia/analizar-fraude`), no es frontend.**

**Origen:** usuario publicó una propiedad real (casa 60m², 1 recámara,
2 baños, $8000/mes, colonia Unión Hace La Fuerza) y recibió "riesgo
medio" con esta señal exacta del backend:

> "El anuncio usa un tono muy directo como si fuera el propietario, lo
> cual es común en fraudes para generar confianza."

## Por qué es un problema real

1. **Circular / no discrimina nada.** El razonamiento es "sonar como
   propietario directo es común en fraudes para generar confianza" —
   pero eso es cierto de CUALQUIER anuncio, real o falso. Un dueño real
   que dice "soy el propietario" también "suena directo" — la señal no
   distingue entre los dos casos, solo penaliza el hecho de afirmarlo.
2. **Penaliza el caso más común y legítimo del mercado.** En Tabasco
   (y en general) una fracción enorme de rentas/ventas son trato
   directo con el dueño, sin inmobiliaria — es la norma, no la
   excepción. Verificado en vivo (3 pruebas con `curl` contra
   `/ia/analizar-fraude`, distintas variantes de "soy el propietario"
   con descripciones completas y honestas) — el modelo A VECES no la
   marca (dio "bajo" en 2 de 3 pruebas), pero cuando el resto del
   anuncio es más escueto (como en el caso real de arriba), sí la
   agrega como señal negativa aunque no haya nada más sospechoso.
3. La OTRA señal de la misma respuesta real ("Precio de renta muy bajo
   ... especialmente mencionando que el dueño es el propietario") repite
   el mismo error: conecta precio bajo con "ser propietario" como si la
   combinación fuera sospechosa, cuando un dueño real rentando barato
   (ej. una sola recámara, zona específica) es perfectamente normal.

## Recomendación

Quitar "menciona ser el propietario" / "tono directo de propietario"
como señal de riesgo por sí sola — no aporta poder de discriminación
real (positivo y negativo se parecen demasiado) y penaliza
sistemáticamente al segmento más grande y más legítimo de la
plataforma: dueños publicando directo. Las señales que SÍ funcionaron
bien en las pruebas (ausencia de fotos, sin dirección exacta, pedir
depósito antes de la visita, propietario "fuera del país" sin poder
mostrar el inmueble) siguen siendo señales fuertes y correctas — el
problema es específico a esta.

## Nota aparte (frontend, ACTUALIZADA — ya resuelta también para "medio")

Para riesgo "alto"/bloqueado, el frontend deliberadamente NO le muestra
las señales a quien publica (evita enseñarle a un defraudador real qué
frase evitar la próxima vez). Esta nota decía que para riesgo "medio"
las señales SÍ se listaban completas — eso cambió el mismo día
(2026-09-11, ver `PublishForm.tsx` y `FraudAlertBadge.tsx`): con el
mismo criterio que "alto", "medio" ahora también oculta las señales
exactas tanto a quien publica como al público, mostrando un aviso
neutral ("en revisión") en su lugar. El reemplazo real es la revisión
manual de un administrador (`/admin/fraude`, ver
`docs/BACKEND-APROBAR-REVISION-FRAUDE-11092026.md`), no la persona
corrigiendo a ciegas.
