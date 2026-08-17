# Monetización — Vive Villahermosa / Tabasco PropTech

> Documento de estrategia, no de implementación — ningún código fue tocado para esto. Escrito desde el conocimiento real de la plataforma (auditada a fondo el 2026-08-10, ver `docs/PLAN-AUDITORIA-FASE1-MVP.md` y `docs/BACKEND.md` en el repo de Vive Villahermosa) más investigación real sobre la economía de Tabasco (fuentes al final).

## La premisa — qué activo real ya existe que nadie más tiene agregado

Antes de listar formas de monetizar, vale nombrar el activo real: la plataforma ya cruza, por cada propiedad, **datos que hoy nadie en Tabasco tiene juntos en un solo lugar** — ubicación exacta, riesgo de inundación por colonia (fuente: Atlas de Riesgos Municipal, no inventado), proximidad real a Dos Bocas/Pemex, y un catálogo de 70+ colonias y 88 landmarks verificados con coordenadas reales. Ese cruce de datos —no el listado de propiedades en sí— es lo más difícil de replicar y lo que sostiene casi todos los modelos B2B de abajo. Cualquier competidor puede copiar un directorio de anuncios; replicar el cruce geográfico verificado toma meses.

---

## Modelo A — Planes profesionales para inmobiliarias/agentes (el más directo, ya semi-construido)

Ya existe el gancho: el límite gratuito de propiedades activas (`LIMITE_PROPIEDADES_GRATIS`, hoy en revisión entre 3 y 4) empuja de forma natural a quien maneja cartera real hacia un plan de pago — y ya hay un componente `PlanesInmobiliaria` construido pero oculto (`docs/BACKEND.md` §15, V2) esperando pasarela de pago real.

**Qué vendería cada tier**, sin inventar valor — todo esto ya tiene un stub o una base real en el código:
- Más propiedades activas simultáneas (el gate ya existe, solo falta el cobro).
- Destacar un anuncio (`destacarPropiedad`/`DestacarPropiedadModal` ya existen en el frontend).
- Bot de WhatsApp Business para notificación de interesados en tiempo real — ya evaluado y documentado como opción de plan profesional en `docs/PLAN-AUDITORIA-FASE1-MVP.md` (anexo, punto 7), con el costo real de Meta (oct 2026) absorbido por el margen del plan pagado, no por el usuario individual.
- Analítica real (hoy `analiticaDemo.ts` es mock — cobrar por datos reales de vistas/contactos una vez exista la tabla de eventos).
- Verificación tipo REDAIT como badge opcional aditivo (ya validado como concepto en sesión anterior — nunca una bandera negativa para quien no la tiene).

## Modelo B — Publicidad segmentada geográficamente (no banners genéricos)

La diferencia real frente a un banner de Google Ads: la plataforma ya sabe **colonia, municipio y riesgo de inundación** de cada búsqueda y cada propiedad vista. Eso permite vender publicidad a negocios que le sirven a alguien que se está mudando — sin ser intrusivo:
- Ferreterías, mueblerías, empresas de mudanza, notarías, aseguradoras — anuncio contextual en la ficha de una propiedad de su zona de cobertura, no un banner aleatorio.
- Constructoras/desarrolladoras anunciando desarrollos nuevos, segmentado por municipio o por perfil de zona (ver `zonasDestacadas.ts`, ya categoriza por vocación: plusvalía alta, dormitorio, industrial).
- Resultado de búsqueda patrocinado — una inmobiliaria paga por aparecer primero en "casas en Tabasco 2000", con etiqueta clara de "Patrocinado" (nunca disfrazado, mismo criterio de honestidad que ya rige el resto de la plataforma).

## Modelo C — API de datos inmobiliarios/geográficos de Tabasco (B2B / B2G) — el diferenciador más fuerte

Esto es lo que ningún competidor de anuncios clasificados (Vivanuncios, Inmuebles24) puede vender, porque ellos no calculan riesgo de inundación real ni tienen el catálogo de colonias verificado: **vender acceso vía API a la capa de datos agregados**, no a los anuncios individuales.

Consumidores reales con presupuesto:
- **Aseguradoras** — riesgo de inundación por colonia para calcular pólizas de vivienda. Dato que hoy la plataforma ya calcula (`floodColors.ts`, Atlas de Riesgos) y nadie más tiene digitalizado y consultable.
- **Bancos/hipotecarias** — precio promedio real por zona (`getZonesWithLiveStats`) para avalúos automatizados.
- **Constructoras/desarrolladoras** — dónde hay demanda real (una vez exista el ranking por demanda de `docs/BACKEND.md` §9.1, hoy es por oferta) antes de decidir dónde construir.
- **Gobierno municipal/estatal (B2G)** — insumo real para planeación urbana; un municipio que hoy no tiene ningún dato agregado de su propio mercado inmobiliario.

## Modelo D — Directorio empresarial de Tabasco, monetizado (la idea que planteaste)

No es lo mismo que el "directorio de servicios" ya construido y pausado (`docs/BACKEND.md` §11 — oficios individuales: plomería, pintura, jardinería). Esto es un salto real hacia **empresas**, aprovechando que el ecosistema de "alguien que se acaba de mudar necesita..." ya empieza en la plataforma:

- Notarías, despachos de abogados inmobiliarios, aseguradoras, mudanzas, contratistas, ferreterías, mueblerías — cobrar por listado destacado/verificado.
- Cross-sell natural: en la ficha de cada propiedad, "negocios cerca de esta zona" — mismo motor de proximidad geográfica que ya existe para landmarks (`src/lib/landmarks.ts`), aplicado a negocios en vez de puntos de interés públicos.
- Este módulo casi no depende de que `Property` sea real en el backend — es prácticamente independiente, se podría empezar a construir en paralelo sin esperar a que se cierre el gap de escritura de propiedades.

## Modelo E — Leads calificados (modelo tipo Zillow Premier Agent)

En vez de (o además de) una suscripción plana, cobrar por **lead real** — alguien que de verdad mandó un mensaje de contacto, no solo una vista. Encaja con el flujo ya construido (`GET /propiedades/:id/contacto`, rate-limitado, requiere sesión) — el evento de "contacto revelado" ya es un punto de medición real, no hay que inventar el dato.

## Modelo F — Reportes e informes de mercado

Usar los datos agregados reales (precio promedio por colonia, inventario por tipo/operación) para vender informes periódicos (PDF/Excel) a desarrolladoras e inversionistas — reutiliza directamente las skills `pdf`/`xlsx` ya instaladas hoy en el entorno de Claude Code de este proyecto. Bajo esfuerzo de construcción relativo al resto de esta lista, porque el dato agregado ya existe en gran parte (`getMunicipalitiesWithLiveStats`).

## Modelo G — Expansión geográfica (franquicia del modelo, no solo del código)

Todo lo de arriba depende de la calidad de los datos geográficos verificados de Tabasco — el mismo patrón (colonias, landmarks, riesgo hídrico, zonas destacadas) es replicable estado por estado. Expansión nacional no es solo "desplegar el mismo código en otro estado" — el trabajo real y defendible es rehacer esa capa de verificación geográfica en cada estado nuevo, que es exactamente lo que hace difícil de copiar el modelo completo.

---

## El mapa como vehículo — áreas de oportunidad reales de Tabasco (investigación 2026-08-12)

Pediste específicamente investigar qué se podría sumar al mapa. Con datos reales, no supuestos:

- **Tabasco creció 3.3% en el primer semestre de 2026 — 4º lugar nacional, once veces el promedio nacional (0.3%).** Más de 59 mil millones de pesos en inversión anunciada, 88% capital privado. Esto es contexto de negocio real: hay dinero entrando al estado ahora mismo.
- **Corredor Interoceánico + Tren Maya, con conexión física confirmada en Tabasco.** El Corredor Interoceánico (El Chapo–Palenque, ~310km) conecta en Palenque con el Tren Maya, y tiene enlace directo a la **Refinería de Dos Bocas** — la plataforma **ya tiene** el campo `cercaDosoBocas` construido y en uso. Extender el mismo patrón (proximidad real, no promesa vaga) a las estaciones del Tren Maya en Tabasco (Pakal-Tenosique, El Triunfo, entre otras) es una capa de mapa nueva y verificable, no un layer decorativo — zonas cerca de nueva infraestructura de transporte suelen tener demanda inmobiliaria real y medible.
- **Sector primario (agricultura) creciendo 6.1%**, con la "ruta del cacao" ya consolidada como atractivo turístico — relevante para el ángulo de propiedades rurales/turísticas (Comalcalco, zona cacaotera) que hoy la plataforma cubre poco.
- **Turismo — Pantanos de Centla, ruta arqueológica (Palenque vía Tren Maya).** Oportunidad de una capa de mapa "zona turística/ecoturismo", relevante para quien busca propiedad de renta vacacional, no solo vivienda permanente.
- **Dependencia petrolera real: ~44% de la economía estatal sigue ligada a Pemex.** Confirma que `cercaDosoBocas` y una eventual capa "zona industrial petrolera" más amplia (no solo Dos Bocas) siguen siendo un filtro de alta relevancia real, no una ocurrencia.

**Conclusión de esta investigación:** el mapa no tiene que limitarse a mostrar dónde están las propiedades — puede ser el vehículo visual de casi todos los modelos B2B de arriba (Modelo C y D en particular), mostrando capas de infraestructura real (Tren Maya/Corredor Interoceánico), riesgo, y negocios — cada capa nueva es, en sí misma, una razón para que alguien pague por acceso a esa capa vía API o por aparecer en ella.

---

## El mapa una vez que haya usuarios y tráfico reales — datos cruzados (2026-08-12)

Todo lo de arriba usa datos geográficos ya verificados (estáticos). Esto es distinto: qué hacer con el mapa una vez que la plataforma tenga **tráfico real** — el mapa deja de ser un catálogo y se vuelve un sensor del mercado.

1. **Mapa de calor por demanda real, no oferta.** Hoy "más solicitadas" es por inventario (`getColoniasRankedByPropiedades`). Con tráfico real: colonias que se iluminan por búsquedas+vistas reales. Cruce inmediato — **oferta vs. demanda por colonia**: zonas con mucha búsqueda y poco inventario = brecha de mercado visible, no editorial. Vendible aparte a constructoras (dónde construir).

2. **Precio vs. tiempo en mercado, por zona.** Cruce precio pedido × cuánto tarda en irse una propiedad (necesita tabla de eventos, ya identificada como pendiente en `docs/BACKEND.md` §12). Colonias donde el precio está mal calibrado se ven directo en el mapa — sirve al vendedor (¿mi precio es razonable aquí?) y al comprador (dónde hay margen real de negociar).

3. **"Colonias que la gente guarda pero no contacta."** Cruce favoritos × contactos reales. Señal de aspiración vs. poder adquisitivo — la gente QUIERE esa zona pero no compra ahí. Oro para quien decide dónde construir vivienda de precio medio: hay demanda represada, no solo demanda que ya se cumple.

4. **"Colonias que sí convierten."** Cruce vistas × contacto real, tasa por zona, no solo conteo. Le dice a una inmobiliaria dónde vale la pena publicar más, y a marketing dónde meter presupuesto de ads.

5. **Corredores de interés, por comportamiento real, no reglas escritas a mano.** Si quien ve propiedades en colonia A también ve colonia B con frecuencia real (clickstream), el mapa sugiere "zonas comparables" aprendidas del uso, no de un catálogo editorial (`zonasDestacadas.ts` hoy es curado a mano).

6. **Actividad en vivo, agregada y honesta.** "3 personas viendo propiedades en Tabasco 2000 ahora" — dato real, anonimizado, agregado — mismo criterio ya validado esta sesión de nunca inventar un número.

7. **Origen geográfico del comprador.** Si mucha gente fuera de Tabasco busca cierta colonia, es señal real de inversión/migración externa — vendible aparte a desarrolladoras que apuntan a compradores foráneos.

8. **Cobertura real de agentes por zona.** Qué agente tiene más contactos/actividad exitosa en cada colonia — "quién conoce mejor esta zona", medido, no autodeclarado.

**Dependencia única, la misma para las 8:** una tabla de eventos real (vista/contacto/favorito con fecha) — hoy no existe en ningún lado (`docs/BACKEND.md` §12, hoy `GET /me/stats` es un mock determinístico). Sin eso, ninguna de estas se puede construir honesta — y honesto es la regla que ya rige toda la plataforma.

---

## Priorización — qué depende de qué

| Modelo | Depende de `Property` real en backend | Se puede empezar ya |
|---|---|---|
| A. Planes profesionales | Parcial — el gate de límite ya es real, falta pasarela de pago | Sí, la parte de pago |
| B. Publicidad segmentada | No | Sí |
| C. API de datos agregados | No — los agregados (`getZonesWithLiveStats`) ya corren sobre datos reales | Sí |
| D. Directorio empresarial | No, casi independiente | Sí |
| E. Leads calificados | Sí — necesita `Property.userId` real para atribuir | No todavía |
| F. Reportes de mercado | No | Sí |
| G. Expansión geográfica | Depende de que el modelo ya funcione en Tabasco primero | No todavía |

**Los tres que no dependen de nada pendiente y se pueden evaluar ya:** B (publicidad segmentada), C (API de datos), D (directorio empresarial) — justo el que planteaste explícitamente.

---

### Fuentes de la investigación de mercado
- [La Chispa — Tabasco crece 3.3% primer trimestre 2026](https://lachispa.mx/tabasco-crece-3-3-en-el-primer-trimestre-de-2026-y-recupera-el-cuarto-lugar-nacional-en-economia/)
- [BBVA Research — Situación Sectorial Regional México 26S1](https://www.bbvaresearch.com/wp-content/uploads/2026/04/SSRMex_26S1_Esp-1.pdf)
- [Milenio — ¿Tren Maya conectará con Tren Interoceánico?](https://www.milenio.com/politica/tren-maya-conectara-con-interoceanico-asi-es-el-mapa)
- [Tren Maya — ruta en Tabasco](https://www.trenmayatrips.com/es/estados/cual-sera-la-ruta-del-tren-maya-en-tabasco)
