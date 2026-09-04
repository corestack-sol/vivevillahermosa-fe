# Investigación del Mercado Inmobiliario en Tabasco — Problemáticas y Áreas de Oportunidad

**Fecha:** 2026-08-02
**Método:** investigación web con fuentes de 2025-2026 (AMPI Tabasco, INEGI, CONAGUA, SEDEC, medios locales de Tabasco). Todas las fuentes están listadas al final de cada sección y en el resumen de fuentes.
**Alcance:** a pedido explícito, esta investigación se limita al mercado de Tabasco/Villahermosa — no es un análisis del mercado inmobiliario nacional. Complementa `docs/tabasco-proptech.html` (estrategia de negocio) y `docs/BACKEND.md` (auditoría técnica, sección V2.A) con datos de mercado actuales y con fuente citable.

---

## 1. Panorama del mercado

- El mercado inmobiliario de Tabasco **creció entre 5% y 10% durante 2024**, según la AMPI (Asociación Mexicana de Profesionales Inmobiliarios) — el motor principal fue el **desarrollo industrial y logístico**, no la vivienda residencial. [Xeva](https://xeva.com.mx/tabasco/252144/mercado-inmobiliario-en-tabasco-crecio-10-en-el-2024)
- **Desequilibrio oferta-demanda:** la propia AMPI señaló un déficit notable en vivienda residencial frente al auge industrial — hay más inversión en naves/infraestructura logística que en "casa habitación". [Xeva](https://xeva.com.mx/tabasco/252144/mercado-inmobiliario-en-tabasco-crecio-10-en-el-2024)
- **Precios en Villahermosa (Vivanuncios, 2026):**
  | Recámaras | Venta (promedio Tabasco) | Renta (promedio Tabasco) |
  |---|---|---|
  | 1 | $981,111 | $4,277/mes |
  | 2 | $1,419,661 | $6,797/mes |
  | 3 | $3,053,906 | $11,516/mes |
  | 4 | $4,837,333 | $19,913/mes |

  En Villahermosa Centro, venta va de $432,550 a $17,000,000; renta de $5,000 a $90,000/mes. [Vivanuncios](https://www.vivanuncios.com.mx/pages/propiedades/tabasco/villahermosa.php)
- Las rentas cayeron hasta **10% en el primer bimestre de 2026** en general, pero se mantuvieron firmes en corredores de alta plusvalía (Bicentenario) — el mercado no es uniforme, varía mucho por zona. [El Heraldo de Tabasco](https://oem.com.mx/elheraldodetabasco/finanzas/disminuye-precio-de-rentas-en-villahermosa-en-primer-bimestre-28634061)
- **INFONAVIT** tiene actualmente en desarrollo **~50,000 viviendas en Tabasco** (meta sexenal): 12,300 en el centro del estado, 7,444 en Huimanguillo, 3,322 en Comalcalco, 640 en Macuspana, 320 en Cunduacán, con 10,000 adicionales anunciadas para el primer trimestre de 2026. [Portal Tabasco](https://tabasco.gob.mx/comunicados/sera-2026-ano-de-la-vivienda-y-el-empleo-en-tabasco-javier-may)
- Comalcalco se está posicionando como zona atractiva para inversión por su crecimiento económico sostenible y su relevancia cultural/turística, más allá de Villahermosa. [Corredor 66](https://corredor66.mx/tabasco-un-mercado-en-crecimiento-para-la-inversion-inmobiliaria/)

**Lectura para la plataforma:** el crecimiento real está en zonas fuera de Villahermosa Centro (Comalcalco, Huimanguillo, Macuspana, Cunduacán) y en vivienda de interés social vía INFONAVIT — el catálogo y el contenido SEO no deberían concentrarse solo en Villahermosa.

---

## 2. Motores de demanda específicos de Tabasco

### 2.1 Refinería Dos Bocas (Paraíso)
- Aún hay **~33,000 empleados** en Dos Bocas (llegó a tener 37,000 en el pico 2021-2022); 99% mexicanos, 36% originarios de Tabasco. [Portal Tabasco](https://tabasco.gob.mx/noticias/construccion-de-refineria-dos-bocas-ha-generado-34-mil-42-nuevos-empleos-para-los)
- La llegada masiva de trabajadores **disparó las rentas cerca de la obra hasta $50,000-$70,000/mes** en su pico, y hay empleados que optan por vivir en Isla Andrés García por los precios inaccesibles cerca del sitio. [Reforma](https://www.reforma.com/dos-bocas-la-vecina-invasiva/ar3169364)
- Esto confirma con datos reales lo que ya está construido en la plataforma (filtro "cerca de Dos Bocas", `cercaDosoBocas` en el modelo de propiedad) — el problema es real y sigue vigente, no es solo hipótesis de estrategia.

### 2.2 Corredor Interoceánico del Istmo de Tehuantepec
- Sheinbaum anunció que **estará terminado y en operación plena en la primera mitad de 2026** (77.3% de avance en la vía férrea a la fecha del reporte). Conecta los puertos de Coatzacoalcos, Salina Cruz, Dos Bocas y Puerto Chiapas, con 1,200 km de vías rehabilitadas. [Inmobiliare](https://inmobiliare.com/noticias/corredor-interoceanico-2026/), [Proyectos México](https://www.proyectosmexico.gob.mx/en/interoceanic-corridor-of-the-isthmus-of-tehuantepec/)
- El impacto inmobiliario se reconoce como "amplio" por el desarrollo económico que trae a cada región que cruza, aunque no hay todavía cifras públicas de plusvalía proyectada específicas — es una oportunidad de ser la primera fuente que las publique. [Lamudi](https://www.lamudi.com.mx/journal/corredor-interoceanico/)

**Lectura para la plataforma:** con la conclusión del corredor en 2026, este es el momento correcto para publicar contenido/datos sobre su impacto en plusvalía — llegar primero a esa narrativa es exactamente el tipo de "ventaja competitiva difícil de copiar" que ya identifica `tabasco-proptech.html`.

---

## 3. Riesgo de inundaciones (ya es una fortaleza de la plataforma — esto la refuerza con datos actuales)

- CONAGUA ubica el periodo de máximas precipitaciones 2026 entre junio y septiembre; Tabasco, junto con Veracruz, Campeche, Quintana Roo y Yucatán, podría registrar **acumulados históricos de lluvia en septiembre**. [Ámbito](https://www.ambito.com/mexico/informacion-general/inicia-la-temporada-lluvias-2026-mexico-municipios-y-estados-afectados-segun-conagua-n6283604)
- Tabasco se mantiene en **riesgo alto de inundaciones y deslizamientos** en temporada de lluvias. Las zonas más vulnerables identificadas: **poblaciones costeras de Centla** y **zonas deprimidas de Macuspana**. La capital (Villahermosa) y su red carretera son propensas a inundarse — en un huracán fuerte, el municipio podría quedar aislado. [Excélsior](https://www.excelsior.com.mx/nacional/vulnerabilidad-viviendas-lluvias-tabasco-con-peores-indices)
- El gobierno federal destinó **más de 455 millones de pesos en 2026** específicamente para reducir el riesgo de inundaciones en Tabasco — señal de que el problema es prioritario a nivel de política pública, no solo percepción local. [Infobae](https://www.infobae.com/mexico/2026/04/22/se-destinaran-mas-de-455-mdp-para-evitar-inundaciones-en-tabasco-se-invertiran-en-infraestructura/)
- En enero 2026, ríos desbordados en la sierra de Tabasco ya afectaron al menos 49 viviendas — el riesgo no es solo de temporada alta, ocurre también fuera de junio-septiembre. [La Jornada](https://www.jornada.com.mx/noticia/2026/01/28/estados/rios-desbordados-en-la-sierra-de-tabasco-causan-dano-en-al-menos-49-viviendas)

**Lectura para la plataforma:** el badge de riesgo de inundación por propiedad (ya construido) sigue siendo el diferenciador correcto — dato confirmado como demandado y sin resolver por portales nacionales. Con datos frescos de Centla/Macuspana como zonas de mayor riesgo costero (distinto del riesgo fluvial/urbano de Villahermosa ya cubierto por el Atlas de Riesgos Municipal usado en `PublishForm.tsx`), hay espacio para expandir la cobertura de datos de riesgo más allá del municipio Centro cuando se publique inventario en Centla/Macuspana.

---

## 4. Seguridad — un problema de percepción medido, no solo anécdota

- Según la Encuesta Nacional de Seguridad Urbana (ENSU) del INEGI, **Villahermosa cerró 2024 como la ciudad con mayor percepción de inseguridad de todo México — 95.3% de sus habitantes mayores de 18 años se sienten inseguros.** [El Sol de México](https://oem.com.mx/elsoldemexico/mexico/villahermosa-tabasco-es-la-ciudad-con-mayor-percepcion-de-inseguridad-inegi-21300467)
- El delito de alto impacto más frecuente son las lesiones por arma de fuego; Tabasco está entre los estados con más casos de extorsión del país. [Radio Fórmula](https://www.radioformula.com.mx/estilo-de-vida/2025/1/23/las-colonias-de-villahermosa-que-ni-de-chiste-debes-pisar-por-la-inseguridad-segun-la-ia-849617.html)
- Colonias señaladas repetidamente como de mayor incidencia delictiva en distintas notas: **Gaviotas Sur y Norte, La Manga 1 y 2, Tamulté (de las Barrancas), Atasta, Ciudad/Zona Industrial, Miguel Hidalgo, José María Pino Suárez, Ocuilzapotlán, y el propio Centro**. [Diario Presente](https://www.diariopresente.mx/villahermosa/estas-son-las-colonias-mas-peligrosas-en-villahermosa/225519), [MercadoSeguridad.mx](https://www.mercadoseguridad.mx/zonas-de-riesgo/villahermosa)

**Lectura para la plataforma:** esto es exactamente el dato que `docs/BACKEND.md` (sección V2.A) ya proponía como "Índice de Seguridad por Colonia" para una fase futura — esta investigación confirma que (a) el problema es real y medido oficialmente por INEGI, no solo percibido, y (b) ya existe una lista inicial de colonias citada por múltiples medios que podría servir de semilla editorial, igual que `zones.json` ya cura datos de colonias para el riesgo de inundación. No se recomienda construirlo ahora (es una pieza de datos sensible que necesita fuentes oficiales verificables, no solo notas de prensa) pero la investigación deja lista la justificación y el punto de partida para cuando se priorice.

---

## 5. Fraude y falta de regulación — el hallazgo más accionable de esta investigación

Esta es la sección con el hallazgo más directamente aplicable a lo que ya existe en la plataforma.

- **Solo el 10% de los ~2,000 asesores inmobiliarios que operan en Tabasco tienen licencia** (unos 200 licenciados). Es decir, **9 de cada 10 personas que se anuncian como "asesor inmobiliario" en Tabasco no están registradas.** [XEVT](https://www.xevt.com/tabasco/alarma-ampi-por-aumento-de-fraudes-en-venta-y-renta-de-viviendas-por-empresas-no-registradas/400617)
- **1 de cada 5 operaciones de compraventa en Tabasco la ejecuta un "coyote"** (intermediario informal, sin registro). [XEVT](https://www.xevt.com/tabasco/alarma-ampi-por-aumento-de-fraudes-en-venta-y-renta-de-viviendas-por-empresas-no-registradas/400617)
- Casos concretos documentados en 2025-2026: venta irregular de terrenos en la zona "La Ladrillera" (Laguna del Negro), investigada por INVITAB; una persona haciéndose pasar por trabajador de INVITAB para ofrecer viviendas/terrenos falsos, con al menos 5 afectados en la colonia Casa Blanca; pérdidas de hasta $300,000 MXN por víctima en estafas de empresas no registradas. [Diario de Tabasco](https://www.diariodetabasco.mx/tabasco/2025/06/20/crece-informalidad-en-sector-inmobiliario-ampi-tabasco/), [Tabasco Hoy](https://www.tabascohoy.com/invitab-alerta-por-falso-trabajador-que-ofrecia-viviendas-y-terrenos/)
- **Existe un registro oficial real y verificable**: el **Registro Estatal de Agentes Inmobiliarios de Tabasco (REDAIT)**, operado por la Secretaría de Desarrollo Económico y Turismo (SEDEC), accesible en línea. Requisitos para registrarse: capacitación mínima de 30 horas en corretaje/intermediación, carta de no antecedentes penales (delitos patrimoniales), identificación oficial, constancia de situación fiscal reciente, y registro del Contrato de Adhesión ante PROFECO. [SEDEC](https://sedec.tabasco.gob.mx/redait/), [AMPI Villahermosa](https://ampivillahermosa.com/requisitos-licencia-inmobiliaria/)
- A nivel nacional (contexto, no Tabasco específico): el 78% de los fraudes inmobiliarios detectados en México están ligados a **rentas**, no a ventas — los "monta rentas" operan sobre todo vía Facebook Marketplace. [La Prensa](https://oem.com.mx/la-prensa/metropoli/fraude-inmobiliario-crece-en-mexico-7-de-cada-10-casos-estan-ligados-a-rentas-28255981)

### Por qué esto es directamente accionable para Vive Villahermosa

Ya se construyó (frontend-only) una función de **"Verificación de agencia"** en `/dashboard/perfil` (`src/lib/verificacionDemo.ts`) que hoy pide "RFC o constancia de situación fiscal" genérico. Este hallazgo sugiere una mejora concreta y de bajo esfuerzo:

- **Agregar el número de folio del REDAIT como campo de verificación**, en vez de (o además de) un documento genérico — es un dato público, verificable, específico de Tabasco, y ataca directamente el problema que la propia AMPI está denunciando activamente (informalidad, coyotaje). Un badge "Verificado ante REDAIT" es un diferenciador de confianza mucho más fuerte y defendible que un genérico "✓ verificado" interno de la plataforma.
- Esto también le da una razón concreta y urgente a una inmobiliaria para registrarse en la plataforma: no es solo "publica gratis", es "demuestra que no eres uno de los 9 de cada 10 sin licencia."
- El mensaje de marketing "en Vive Villahermosa, verificamos que tu asesor esté registrado ante el Estado" es un ángulo de PR/prensa local concreto (la nota de AMPI sobre informalidad ya generó cobertura en 3+ medios de Tabasco en 2025-2026 — es un tema que la prensa local ya está cubriendo activamente).

---

## 6. Fricciones en el proceso de renta (fiador, aval, depósito)

- El requisito más común para rentar en Villahermosa: **fiador + contrato a 12 meses + comprobación de ingresos + identificación + depósito**. [Century21 México](https://blog.century21mexico.com/administracion-empresarial/fiador-y-aval/)
- Sin fiador/aval/póliza jurídica de arrendamiento, el arrendador normalmente pide **2 meses de depósito** en vez de 1, para reducir su exposición al riesgo — un obstáculo real de liquidez para quien no tiene quién le sirva de fiador (migrantes internos, jóvenes, trabajadores foráneos de Dos Bocas). [Mercado Libre / RADE](https://rade.mx/blog/articulo/garantias-en-el-arrendamiento-diferencias-entre-obligado-solidario-aval-y-fiador)
- Existen alternativas formales al fiador tradicional (pólizas jurídicas de arrendamiento) que hoy no están integradas a ningún flujo de la plataforma. [El Financiero](https://www.elfinanciero.com.mx/mis-finanzas/2022/11/12/quieres-rentar-un-depa-pero-no-tienes-aval-estas-son-las-3-opciones-que-tienes/)

**Lectura para la plataforma:** esto conecta directamente con la sección "Dos Bocas" de arriba — un trabajador foráneo que llega a Paraíso/Villahermosa por el proyecto probablemente no tiene fiador local, es justo el perfil más afectado por este requisito. Es un candidato natural para el "marketplace de servicios complementarios" ya mencionado como ventaja competitiva en `tabasco-proptech.html` (ítem #10): una alianza con una aseguradora de pólizas de arrendamiento podría resolver una fricción real y documentada, no una hipótesis.

---

## 7. Resumen de áreas de oportunidad, priorizadas

| # | Oportunidad | Qué tan accionable | Ya existe en la plataforma |
|---|---|---|---|
| 1 | Verificación de agencia ligada al folio real del **REDAIT** (no solo un documento genérico) | Alta — viabilidad confirmada 2026-09-03 (padrón público real encontrado en `turismo.tabasco.gob.mx/redait/agentes`, 88 agentes vigentes con folio/nombre/vencimiento). Documentado como **Módulo 13 de Fase 2**, no Fase 1 | ⚠️ Existe versión genérica (`verificacionDemo.ts`), falta el campo de folio REDAIT |
| 2 | Contenido/SEO sobre el impacto del **Corredor Interoceánico** al concluir en 2026 | Alta — ventana de oportunidad de tiempo específica | ❌ No existe |
| 3 | Expandir catálogo/contenido más allá de Villahermosa Centro — **Comalcalco, Huimanguillo, Macuspana, Cunduacán** están creciendo más rápido en vivienda | Media — requiere inventario real en esas zonas | ⚠️ El catálogo demo no las cubre bien |
| 4 | **Índice de seguridad por colonia** (dato INEGI real + colonias ya identificadas por prensa) | Media — necesita fuente oficial verificable, no solo notas de prensa | ❌ No existe (ya estaba en el roadmap de `docs/BACKEND.md`) |
| 5 | Categoría/mensajería específica para **renta de trabajadores foráneos de proyectos (Dos Bocas)**, incluyendo alianza con pólizas de arrendamiento como alternativa a fiador | Media — depende de conseguir un socio/aseguradora | ⚠️ Existe el filtro `cercaDosoBocas`, falta la mensajería y el servicio de fiador |
| 6 | Mensajería anti-fraude explícita ("nunca pagues antes de ver la propiedad", contraste directo con Facebook Marketplace) | Alta — solo requiere contenido/copy, sin desarrollo | ❌ No existe como mensaje explícito en la plataforma |
| 7 | Cobertura de riesgo de inundación en **Centla y Macuspana** (riesgo costero/fluvial, no solo el urbano de Villahermosa) | Media — depende de tener inventario ahí | ⚠️ El sistema de riesgo ya existe, falta cobertura geográfica |
| 8 | **Sección de "roomies" / cuartos compartidos** — ver análisis §8 | **Baja por ahora — a propósito no priorizada, ver veredicto** | ❌ No existe |

---

## 8. Análisis: sección de "roomies" / cuartos compartidos — ¿vale la pena?

**Fecha de este análisis:** 2026-09-03. **Nota:** esta sección es una evaluación, no un compromiso de roadmap — no está en `fase2-spec.md` a propósito, ver veredicto.

### 8.1 La demanda es real y hoy se resuelve mal

Hay al menos 3 grupos de Facebook activos específicos de Villahermosa dedicados a esto ("BUSCO ROOMIES! VILLAHERMOSA TABASCO", "Roomies Villahermosa, Tabasco. Casa de Huéspedes", más el grupo genérico "RENTA DE DEPARTAMENTOS VILLAHERMOSA"), una página nacional "Busco Roomies" (~1,007 likes, modelo de posts gratis, buscoroomies.mx), y dos competidores con listados reales y activos en la ciudad: **Roomgo** (perfiles de roomies en Villahermosa) y **Pincali** (categoría "Busco Roomie" en colonias como Cumbres; cuartos individuales desde $4,500/mes + mantenimiento en Bonanza Centro). No es un mercado vacío — es un mercado servido de forma informal (scroll de posts en Facebook, sin verificación, sin filtro real).

### 8.2 Segmentos reales en Tabasco

- **Estudiantes UJAT** — universidad grande (29,367 inscritos en el ciclo 2022-2023 según Data México; uniRank la ubica en el rango de 35,000-39,999). Es el ancla natural de demanda de roomies, patrón consistente con cualquier ciudad universitaria mexicana.
- **Contratistas de PEMEX** — se descartó como segmento principal para esto: en 2025 el sector vivió protestas y bloqueos carreteros por adeudos de PEMEX a subcontratistas por más de 400,000 millones de pesos a nivel nacional. Es un segmento inestable/volátil ahora mismo, no la base sobre la que construir un producto nuevo.

### 8.3 El riesgo que cualquier implementación tendría que diseñar en contra

El patrón de fraude "monta rentas" (alguien publica una propiedad que no es suya, cobra un adelanto, desaparece) es activo y documentado en México en 2025-2026, con recomendaciones oficiales de la SSPC de nunca pagar por adelantado sin contrato firmado y nunca cerrar tratos solo por redes sociales/mensajería. Un post de "persona buscando roomie" sin ninguna propiedad real verificable detrás reproduce exactamente el hueco que explotan estos fraudes.

### 8.4 Flujo evaluado (si se construyera)

La arquitectura recomendada NO es un post de persona suelta, sino extender una propiedad **ya real y ya publicada** con un campo "cuartos disponibles para compartir":

1. Al publicar/editar una propiedad en renta, toggle "¿Rentas por habitación / buscas roomie?" revela: número de habitaciones disponibles, precio POR habitación (no precio total), mini-perfil de qué busca el publicador en un roomie (edad aprox., fumador/no, mascotas — sin datos sensibles).
2. La propiedad pasa por el mismo filtro anti-fraude de siempre; la card se etiqueta "Roomie / Cuarto compartido".
3. Quien busca puede filtrar/buscar por esta intención (requiere que el prompt de IA del backend aprenda a reconocerla).
4. Contacto vía la mensajería in-app ya construida — nunca WhatsApp/teléfono directo hasta que ambas partes acepten, mismo patrón "message-first" que ya usa el resto de la plataforma.
5. Reportes y el sistema de 3 strikes ya existentes cubren abuso en este flujo sin construir nada nuevo.

Este diseño hereda ~90% de la infraestructura de confianza que ya existe (login-gate, moderación, mensajería) — la parte nueva real es: campos en `Property`, UI de publicar/mostrar, filtro de búsqueda, y ampliar el prompt de IA del backend (esto último es trabajo de backend, no solo frontend).

### 8.5 Veredicto — no priorizar todavía

**No se recomienda construir esto ahora**, por:

- No es trabajo aislado de frontend — toca schema del backend y el prompt de IA del backend, cruza varias capas.
- Ya hay competencia real sirviendo Villahermosa (Roomgo, Pincali) — no es mercado vacío; la ventaja de "más seguro" es real pero no urgente para captar mercado desde cero.
- La plataforma todavía no termina Fase 1 al 100% y Fase 2 ya tiene su propio roadmap priorizado — esto competiría por el mismo tiempo de desarrollo de backend contra trabajo ya comprometido.
- El riesgo de esperar es bajo: la demanda ya existe y se sirve (mal) en Facebook — no se evapora si se posterga.

**Se documenta aquí como candidato futuro (post-Fase 2), no como ítem de roadmap comprometido.** Si en el futuro hay una razón de negocio puntual (ej. campaña de marketing, temporada de inscripciones UJAT) que justifique adelantarlo, revisar esta sección antes de diseñar desde cero.

---

## Fuentes consultadas

- [Mercado inmobiliario en Tabasco creció 10% en el 2024 — XEVA](https://xeva.com.mx/tabasco/252144/mercado-inmobiliario-en-tabasco-crecio-10-en-el-2024)
- [Precios de propiedades en Villahermosa — Vivanuncios](https://www.vivanuncios.com.mx/pages/propiedades/tabasco/villahermosa.php)
- [Disminuye precio de rentas en Villahermosa en primer bimestre — El Heraldo de Tabasco](https://oem.com.mx/elheraldodetabasco/finanzas/disminuye-precio-de-rentas-en-villahermosa-en-primer-bimestre-28634061)
- [Será 2026 año de la vivienda y el empleo en Tabasco — Portal Tabasco](https://tabasco.gob.mx/comunicados/sera-2026-ano-de-la-vivienda-y-el-empleo-en-tabasco-javier-may)
- [Tabasco: Un Mercado en Crecimiento para la Inversión Inmobiliaria — Corredor 66](https://corredor66.mx/tabasco-un-mercado-en-crecimiento-para-la-inversion-inmobiliaria/)
- [Construcción de Refinería Dos Bocas ha generado 34,042 empleos — Portal Tabasco](https://tabasco.gob.mx/noticias/construccion-de-refineria-dos-bocas-ha-generado-34-mil-42-nuevos-empleos-para-los)
- [Dos Bocas, la vecina invasiva — Reforma](https://www.reforma.com/dos-bocas-la-vecina-invasiva/ar3169364)
- [Gobierno de México concluirá el Corredor Interoceánico en 2026 — Inmobiliare](https://inmobiliare.com/noticias/corredor-interoceanico-2026/)
- [Corredor Interoceánico del Istmo de Tehuantepec — Proyectos México](https://www.proyectosmexico.gob.mx/en/interoceanic-corridor-of-the-isthmus-of-tehuantepec/)
- [Corredor interoceánico y su impacto inmobiliario — Lamudi](https://www.lamudi.com.mx/journal/corredor-interoceanico/)
- [Inicia la temporada de lluvias 2026 en México — Ámbito](https://www.ambito.com/mexico/informacion-general/inicia-la-temporada-lluvias-2026-mexico-municipios-y-estados-afectados-segun-conagua-n6283604)
- [La vulnerabilidad de las viviendas ante las lluvias; Tabasco con los peores índices — Excélsior](https://www.excelsior.com.mx/nacional/vulnerabilidad-viviendas-lluvias-tabasco-con-peores-indices)
- [Se destinarán más de 455 mdp para evitar inundaciones en Tabasco — Infobae](https://www.infobae.com/mexico/2026/04/22/se-destinaran-mas-de-455-mdp-para-evitar-inundaciones-en-tabasco-se-invertiran-en-infraestructura/)
- [Ríos desbordados en la sierra de Tabasco afectaron 49 viviendas — La Jornada](https://www.jornada.com.mx/noticia/2026/01/28/estados/rios-desbordados-en-la-sierra-de-tabasco-causan-dano-en-al-menos-49-viviendas)
- [Villahermosa es la ciudad con mayor percepción de inseguridad — El Sol de México](https://oem.com.mx/elsoldemexico/mexico/villahermosa-tabasco-es-la-ciudad-con-mayor-percepcion-de-inseguridad-inegi-21300467)
- [Estas son las colonias más peligrosas en Villahermosa — Diario Presente](https://www.diariopresente.mx/villahermosa/estas-son-las-colonias-mas-peligrosas-en-villahermosa/225519)
- [Los municipios más peligrosos de Villahermosa 2026 — MercadoSeguridad.mx](https://www.mercadoseguridad.mx/zonas-de-riesgo/villahermosa)
- [Las colonias de Villahermosa más inseguras según la IA — Radio Fórmula](https://www.radioformula.com.mx/estilo-de-vida/2025/1/23/las-colonias-de-villahermosa-que-ni-de-chiste-debes-pisar-por-la-inseguridad-segun-la-ia-849617.html)
- [Crece "informalidad" en sector inmobiliario: AMPI Tabasco — Diario de Tabasco](https://www.diariodetabasco.mx/tabasco/2025/06/20/crece-informalidad-en-sector-inmobiliario-ampi-tabasco/)
- [Alarma AMPI por aumento de fraudes en venta y renta por empresas no registradas — XEVT](https://www.xevt.com/tabasco/alarma-ampi-por-aumento-de-fraudes-en-venta-y-renta-de-viviendas-por-empresas-no-registradas/400617)
- [INVITAB alerta por falso trabajador que ofrecía viviendas y terrenos — Tabasco Hoy](https://www.tabascohoy.com/invitab-alerta-por-falso-trabajador-que-ofrecia-viviendas-y-terrenos/)
- [Investiga INVITAB fraudes por venta ilegal de predios en La Ladrillera — XEVA](https://xeva.com.mx/villahermosa/283016/investiga-invitab-fraudes-por-venta-ilegal-de-predios-en-la-ladrillera)
- [Registro Estatal de Agentes Inmobiliarios de Tabasco (REDAIT) — SEDEC](https://sedec.tabasco.gob.mx/redait/) — ⚠️ dominio caído al 2026-09-03, no resuelve DNS
- [Padrón de agentes REDAIT vigentes (fuente viva confirmada 2026-09-03)](https://turismo.tabasco.gob.mx/redait/agentes)
- [Requisitos para licencia de operaciones inmobiliarias — AMPI Villahermosa](https://ampivillahermosa.com/requisitos-licencia-inmobiliaria/)
- [Agentes Inmobiliarios del Estado de Tabasco — Portal Tabasco](https://tabasco.gob.mx/agentes-inmobiliarios-del-estado-de-tabasco)
- [Fraude inmobiliario crece en México: 7 de cada 10 casos ligados a rentas — La Prensa](https://oem.com.mx/la-prensa/metropoli/fraude-inmobiliario-crece-en-mexico-7-de-cada-10-casos-estan-ligados-a-rentas-28255981)
- [Diferencias entre fiador y aval en contratos de renta — Century21 México](https://blog.century21mexico.com/administracion-empresarial/fiador-y-aval/)
- [Garantías en el arrendamiento: obligado solidario, aval y fiador — RADE](https://rade.mx/blog/articulo/garantias-en-el-arrendamiento-diferencias-entre-obligado-solidario-aval-y-fiador)
- [¿No tienes aval? 3 opciones para rentar un depa — El Financiero](https://www.elfinanciero.com.mx/mis-finanzas/2022/11/12/quieres-rentar-un-depa-pero-no-tienes-aval-estas-son-las-3-opciones-que-tienes/)

**Fuentes del análisis de roomies (§8):**
- [BUSCO ROOMIES! VILLAHERMOSA TABASCO — Facebook](https://www.facebook.com/groups/1643732995770825/?locale=es_LA)
- [Roomies Villahermosa, Tabasco. Casa de Huéspedes — Facebook](https://www.facebook.com/groups/1453023748050052/)
- [Busco Roomies — Facebook](https://www.facebook.com/buscoroomies/)
- [Busco Roomie - Renta cuarto Cumbres — Pincali](https://www.pincali.com/en/home/busco-roomie-renta-cuarto-cumbres)
- [Roomgo Villahermosa](https://www.roomgo.com.mx/en-renta-villahermosca/juan-villahermosca/L260531135453326)
- [Habitación en Renta, Bonanza Centro Villahermosa — Inmuebles en México](https://mexico.inmobiliarie.com/inmuebles-en-venta-y-renta/habitacion-en-renta-departamento-en-bonanza-centro-villahermosa-tabasco/)
- [Universidad Juárez Autónoma de Tabasco — Data México](https://www.economia.gob.mx/datamexico/es/profile/institution/universidad-juarez-autonoma-de-tabasco)
- [UJAT — uniRank](https://www.unirank.org/mx/uni/universidad-juarez-autonoma-de-tabasco/)
- [Contratistas despliegan anuncios móviles en Tabasco para exigir pagos a Pemex — Expansión Política](https://politica.expansion.mx/estados/2025/08/30/contratistas-despliegan-anuncios-moviles-en-tabasco-para-exigir-pagos-a-pemex)
- [¿Buscas rentar un departamento este 2026? SSPC comparte claves para evitar caer en una estafa — El Universal](https://www.eluniversal.com.mx/nacion/buscas-rentar-un-departamento-este-2026-ten-cuidado-con-las-estafas-sspc-comparte-claves-para-evitar-fraudes/)
- [¿Cómo operan monta rentas en CDMX? — MedioTiempo](https://www.mediotiempo.com/actualidad/comunidad/monta-rentas-en-cdmx-asi-operan-estafadores-en-apps-de-alquiler-en-2026-nuevo-fraude)
