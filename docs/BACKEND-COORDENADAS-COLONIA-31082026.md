# Backend — `latPublico`/`lngPublico` ignora el pin real, usa tabla propia desactualizada (2026-08-31)

**Severidad: 🔴 alta.** Afecta la ubicación mostrada en el mapa de TODAS las
propiedades publicadas, no solo un caso puntual. Reporte real de un
propietario: publicó en Gaviotas Norte, colocó el pin correctamente en el
formulario, y la ficha pública mostró el radio de ubicación a ~4km de la
colonia real.

## 1. Qué está pasando

`POST /propiedades` recibe `lat`/`lng` (el pin real que la persona coloca en
el mapa del formulario) y devuelve `latPublico`/`lngPublico` (el punto que el
frontend usa para dibujar el marcador y el círculo de "zona aproximada" en la
ficha pública — ver `MapViewDynamic ... approximate approximateRadius={350}`
en `PropertyDetailView.tsx`).

**`latPublico`/`lngPublico` no tiene ninguna relación con el `lat`/`lng` que
se envía.** Se calculan a partir del nombre de la colonia contra una tabla
propia del servidor, y esa tabla tiene valores viejos e incorrectos.

## 2. Prueba en vivo (reproducible, 2026-08-31)

Cuenta de prueba desechable, creada y eliminada en la misma sesión de
verificación — sin dejar rastro en producción.

**Llamada A** — `POST /propiedades` con `lat: 17.9811, lng: -92.9195`
(centro real y verificado de Gaviotas Norte) y `colonia: "Gaviotas Norte"`:

```json
// Respuesta (recortada):
"lat": 17.9811, "lng": -92.9195,          // ✅ el pin real, correcto, tal cual se envió
"latPublico": 18.0141, "lngPublico": -92.9312   // ❌ a 3.9km del pin real
```

**Llamada B** — mismas coordenadas exactas (`lat: 17.9811, lng: -92.9195`),
solo cambia `colonia: "Tabasco 2000"`:

```json
"lat": 17.9811, "lng": -92.9195,
"latPublico": 17.9994, "lngPublico": -92.9316   // valor distinto, propio de "Tabasco 2000"
```

Mismo `lat`/`lng` real, dos colonias distintas → dos `latPublico`/`lngPublico`
distintos. **Confirma que el cálculo depende únicamente del texto de
`colonia`, nunca de la coordenada real enviada.**

Verificación adicional: el reporte original (propiedad real, slug
`departamento-en-renta-en-gaviotas-norte-centro-1-rec-40-m-e873dacc`) tiene
exactamente `latPublico: 18.0141, lngPublico: -92.9312` — el mismo valor de
la Llamada A. El propietario colocó el pin bien; el servidor lo ignoró igual.

## 3. De dónde salió el valor incorrecto

El valor que el backend sigue usando para "Gaviotas Norte" (`18.0141,
-92.9312`) es un valor que este mismo proyecto (frontend) tuvo en su propio
catálogo y **corrigió el 2026-08-21** después de verificarlo contra
Nominatim/OpenStreetMap — el valor viejo resultó estar a ~3.9km del punto
real (ver comentario en `src/lib/colonias.ts`, entrada `gaviotas-norte`). El
valor de "Tabasco 2000" (`17.9994, -92.9316`) sigue siendo el mismo en ambos
lados — por eso la Llamada B no mostró ningún error, esa colonia nunca tuvo
que corregirse.

Conclusión: la tabla del backend se sincronizó en algún momento desde datos
de este frontend (posiblemente el `properties.json` de demo, que también
tenía el mismo valor viejo) y nunca se volvió a actualizar cuando el
frontend corrigió su catálogo.

## 4. Qué se necesita corregir

1. **Dejar de ignorar `lat`/`lng`.** El punto público debe derivarse del pin
   real que la persona colocó, no solo del nombre de colonia — la persona
   puede estar en cualquier punto dentro de la colonia (o cerca del borde),
   no siempre en el mismo centroide.
2. **Aplicar un desplazamiento aleatorio pequeño sobre el pin real**, no
   sustituirlo. El frontend ya asume esto: dibuja un círculo de radio fijo
   350m (`approximateRadius={350}` en `PropertyDetailView.tsx`) alrededor de
   `latPublico`/`lngPublico`, bajo el supuesto de que el punto real cae
   dentro de ese círculo. Si el servidor sigue prefiriendo enmascarar por
   colonia en vez de por jitter sobre el pin, entonces como mínimo:
3. **Sincronizar la tabla de colonias del servidor con la fuente ya
   verificada de este repo** — `src/lib/colonias.ts` (arreglo
   `COLONIAS_COORDS`, Centro y alrededores) y `src/data/colonias-municipios.json`
   (resto de los 17 municipios). Cada entrada de `colonias.ts` lleva
   comentarios documentando cómo se verificó (Nominatim, reverse-geocode con
   segunda fuente independiente) — no son valores aproximados a mano.

   Copia completa de `COLONIAS_COORDS` (88 colonias, Centro + alrededores),
   lista para importar tal cual (`key` = identificador interno, `label` =
   nombre mostrado, no usar como llave de búsqueda por ser menos estable):

   ```json
   [
     { "key": "tabasco-2000", "label": "Tabasco 2000", "municipio": "Centro", "lat": 17.9994, "lng": -92.9316 },
     { "key": "gaviotas-norte", "label": "Gaviotas Norte", "municipio": "Centro", "lat": 17.9811, "lng": -92.9195 },
     { "key": "gaviotas-sur", "label": "Gaviotas Sur", "municipio": "Centro", "lat": 18.0089, "lng": -92.9278 },
     { "key": "framboyanes", "label": "Framboyanes", "municipio": "Centro", "lat": 18.0056, "lng": -92.9288 },
     { "key": "sector-carrizal", "label": "Sector Carrizal", "municipio": "Centro", "lat": 17.9875, "lng": -92.9421 },
     { "key": "atasta", "label": "Atasta", "municipio": "Centro", "lat": 17.9846, "lng": -92.9495 },
     { "key": "centro-historico", "label": "Centro Histórico", "municipio": "Centro", "lat": 17.9896, "lng": -92.9282 },
     { "key": "olmeca", "label": "Olmeca", "municipio": "Centro", "lat": 17.9812, "lng": -92.9502 },
     { "key": "gil-y-saenz", "label": "Gil y Sáenz", "municipio": "Centro", "lat": 17.9867, "lng": -92.9356 },
     { "key": "col-del-parque", "label": "Col. del Parque", "municipio": "Centro", "lat": 17.9734, "lng": -92.9267 },
     { "key": "magisterial", "label": "Magisterial", "municipio": "Centro", "lat": 18.0036, "lng": -92.9287 },
     { "key": "fraccionamiento-carrizal", "label": "Fraccionamiento Carrizal", "municipio": "Centro", "lat": 18.0141, "lng": -92.953 },
     { "key": "el-bellote", "label": "El Bellote", "municipio": "Paraíso", "lat": 18.425, "lng": -93.1534 },
     { "key": "frontera", "label": "Frontera", "municipio": "Centla", "lat": 18.5322, "lng": -92.6461 },
     { "key": "adolfo-lopez-mateos", "label": "Adolfo López Mateos", "municipio": "Centro", "lat": 18.0002, "lng": -92.9299 },
     { "key": "alvaro-obregon", "label": "Álvaro Obregón", "municipio": "Centro", "lat": 17.9959, "lng": -92.9403 },
     { "key": "bonanza", "label": "Bonanza", "municipio": "Centro", "lat": 18.004, "lng": -92.9385 },
     { "key": "bosques-de-villahermosa", "label": "Bosques de Villahermosa", "municipio": "Centro", "lat": 18.0106, "lng": -92.9452 },
     { "key": "brisas-del-grijalva", "label": "Brisas del Grijalva", "municipio": "Centro", "lat": 18.0118, "lng": -92.906 },
     { "key": "infonavit-ciudad-industrial", "label": "Infonavit Ciudad Industrial", "municipio": "Centro", "lat": 18.0256, "lng": -92.9011 },
     { "key": "cosmos", "label": "Cosmos", "municipio": "Centro", "lat": 18.0278, "lng": -92.904 },
     { "key": "cotip", "label": "Cotip", "municipio": "Centro", "lat": 17.973, "lng": -92.9711 },
     { "key": "del-bosque", "label": "Del Bosque", "municipio": "Centro", "lat": 17.9732, "lng": -92.9492 },
     { "key": "florida", "label": "Florida", "municipio": "Centro", "lat": 17.9971, "lng": -92.9317 },
     { "key": "fovissste-casa-blanca", "label": "Fovissste Casa Blanca", "municipio": "Centro", "lat": 18.0021, "lng": -92.9137 },
     { "key": "francisco-villa", "label": "Francisco Villa", "municipio": "Centro", "lat": 18.0281, "lng": -92.8897 },
     { "key": "galaxia", "label": "Galaxia", "municipio": "Centro", "lat": 18.0001, "lng": -92.9505 },
     { "key": "guadalupe", "label": "Guadalupe", "municipio": "Centro", "lat": 17.9769, "lng": -92.9634 },
     { "key": "guadalupe-borja", "label": "Guadalupe Borja", "municipio": "Centro", "lat": 17.9769, "lng": -92.9634 },
     { "key": "heriberto-kehoe-vicent", "label": "Heriberto Kehoe Vicent", "municipio": "Centro", "lat": 18.0091, "lng": -92.9412 },
     { "key": "insurgentes", "label": "Insurgentes", "municipio": "Centro", "lat": 18.0334, "lng": -92.9005 },
     { "key": "jardines-del-sol", "label": "Jardines del Sol", "municipio": "Centro", "lat": 18.0262, "lng": -92.9048 },
     { "key": "jardines-del-sur", "label": "Jardines del Sur", "municipio": "Centro", "lat": 17.9649, "lng": -92.9547 },
     { "key": "jesus-garcia", "label": "Jesús García", "municipio": "Centro", "lat": 17.9955, "lng": -92.9343 },
     { "key": "jose-maria-pino-suarez", "label": "José María Pino Suárez", "municipio": "Centro", "lat": 17.973, "lng": -92.9518 },
     { "key": "jose-pages-llergo", "label": "José Pagés Llergo", "municipio": "Centro", "lat": 17.982, "lng": -92.9697 },
     { "key": "la-manga-ii", "label": "La Manga II", "municipio": "Centro", "lat": 17.9999, "lng": -92.9087 },
     { "key": "las-delicias", "label": "Las Delicias", "municipio": "Centro", "lat": 17.9714, "lng": -92.9692 },
     { "key": "lindavista", "label": "Lindavista", "municipio": "Centro", "lat": 17.9916, "lng": -92.9421 },
     { "key": "loma-linda", "label": "Loma Linda", "municipio": "Centro", "lat": 17.9936, "lng": -92.9414 },
     { "key": "marcos-buendia", "label": "Marcos Buendia", "municipio": "Centro", "lat": 17.969, "lng": -92.9246 },
     { "key": "miguel-hidalgo-i", "label": "Miguel Hidalgo I", "municipio": "Centro", "lat": 17.9777, "lng": -92.9781 },
     { "key": "multiochenta", "label": "Multiochenta", "municipio": "Centro", "lat": 18.0028, "lng": -92.9536 },
     { "key": "nueva-imagen", "label": "Nueva Imagen", "municipio": "Centro", "lat": 18.0051, "lng": -92.9405 },
     { "key": "nueva-villahermosa", "label": "Nueva Villahermosa", "municipio": "Centro", "lat": 17.9927, "lng": -92.9283 },
     { "key": "oropeza", "label": "Oropeza", "municipio": "Centro", "lat": 18.0003, "lng": -92.9402 },
     { "key": "palmitas", "label": "Palmitas", "municipio": "Centro", "lat": 17.9791, "lng": -92.9538 },
     { "key": "pensiones", "label": "Pensiones", "municipio": "Centro", "lat": 17.9768, "lng": -92.9482 },
     { "key": "prados-de-villahermosa", "label": "Prados de Villahermosa", "municipio": "Centro", "lat": 18.0058, "lng": -92.9333 },
     { "key": "primero-de-mayo", "label": "Primero de Mayo", "municipio": "Centro", "lat": 17.9734, "lng": -92.9356 },
     { "key": "punta-brava", "label": "Punta Brava", "municipio": "Centro", "lat": 17.9696, "lng": -92.966 },
     { "key": "real-de-minas", "label": "Real de Minas", "municipio": "Centro", "lat": 18.0071, "lng": -92.9457 },
     { "key": "sanchez-magallanes", "label": "Sánchez Magallanes", "municipio": "Centro", "lat": 17.975, "lng": -92.9514 },
     { "key": "triunfo-la-manga-i", "label": "Triunfo La Manga I", "municipio": "Centro", "lat": 17.9794, "lng": -92.9164 },
     { "key": "valle-marino", "label": "Valle Marino", "municipio": "Centro", "lat": 18.0158, "lng": -92.9171 },
     { "key": "villa-las-fuentes", "label": "Villa las Fuentes", "municipio": "Centro", "lat": 17.9706, "lng": -92.9512 },
     { "key": "villas-del-bosque", "label": "Villas del Bosque", "municipio": "Centro", "lat": 17.998, "lng": -92.9544 },
     { "key": "vista-alegre", "label": "Vista Alegre", "municipio": "Centro", "lat": 17.9757, "lng": -92.9558 },
     { "key": "club-campestre", "label": "Fraccionamiento Club Campestre", "municipio": "Centro", "lat": 18.0098351, "lng": -92.9497433 },
     { "key": "indeco", "label": "Colonia Indeco", "municipio": "Centro", "lat": 18.0215479, "lng": -92.8978157 },
     { "key": "pomoca", "label": "Pomoca", "municipio": "Nacajuca", "lat": 18.0513378, "lng": -92.9294658 },
     { "key": "18-de-marzo", "label": "18 de Marzo", "municipio": "Centro", "lat": 18.0095, "lng": -92.9424 },
     { "key": "carlos-a-madrazo", "label": "Carlos A. Madrazo", "municipio": "Centro", "lat": 17.9857, "lng": -92.9193 },
     { "key": "el-parque", "label": "El Parque", "municipio": "Centro", "lat": 18.0212, "lng": -92.9051 },
     { "key": "guayabal", "label": "Guayabal", "municipio": "Centro", "lat": 17.9728, "lng": -92.927 },
     { "key": "jose-colomo", "label": "José Colomo", "municipio": "Centro", "lat": 17.9863, "lng": -92.9451 },
     { "key": "la-choca", "label": "La Choca", "municipio": "Centro", "lat": 18.0041, "lng": -92.9529 },
     { "key": "las-brisas", "label": "Las Brisas", "municipio": "Centro", "lat": 17.9772, "lng": -92.9272 },
     { "key": "lomas-del-dorado", "label": "Lomas del Dorado", "municipio": "Centro", "lat": 17.959, "lng": -92.9517 },
     { "key": "tierra-colorada", "label": "Tierra Colorada", "municipio": "Centro", "lat": 18.0246, "lng": -92.9207 },
     { "key": "villa-de-las-flores", "label": "Villa de las Flores", "municipio": "Centro", "lat": 18.0276, "lng": -92.8994 },
     { "key": "villa-de-los-arcos", "label": "Villa de los Arcos", "municipio": "Centro", "lat": 17.9764, "lng": -92.9592 },
     { "key": "villa-de-los-trabajadores", "label": "Villa de los Trabajadores", "municipio": "Centro", "lat": 17.99, "lng": -92.9604 },
     { "key": "bosques-de-saloya", "label": "Bosques de Saloya", "municipio": "Nacajuca", "lat": 18.0153669, "lng": -92.9595985 },
     { "key": "blancas-mariposas", "label": "Blancas Mariposas", "municipio": "Centro", "lat": 17.9584195, "lng": -92.9469486 },
     { "key": "bonampak", "label": "Bonampak", "municipio": "Centro", "lat": 17.9600838, "lng": -93.007445 },
     { "key": "casa-blanca-1a-seccion", "label": "Casa Blanca 1a Sección", "municipio": "Centro", "lat": 18.0045817, "lng": -92.9180621 },
     { "key": "deportiva-residencial", "label": "Deportiva Residencial", "municipio": "Centro", "lat": 17.9724158, "lng": -92.9453798 },
     { "key": "el-recreo", "label": "El Recreo", "municipio": "Centro", "lat": 18.015182, "lng": -92.9216193 },
     { "key": "flores-del-tropico", "label": "Flores del Trópico", "municipio": "Centro", "lat": 18.0045595, "lng": -92.9759166 },
     { "key": "islas-del-mundo", "label": "Islas del Mundo", "municipio": "Centro", "lat": 17.9751438, "lng": -92.9807737 },
     { "key": "jose-narciso-rovirosa", "label": "José Narciso Rovirosa", "municipio": "Centro", "lat": 17.9920813, "lng": -92.9357863 },
     { "key": "lagunas", "label": "Lagunas", "municipio": "Centro", "lat": 18.0376473, "lng": -92.8977572 },
     { "key": "las-garzas", "label": "Las Garzas", "municipio": "Centro", "lat": 18.0213187, "lng": -92.9002515 },
     { "key": "los-tulipanes", "label": "Los Tulipanes", "municipio": "Centro", "lat": 17.9816059, "lng": -92.9238736 },
     { "key": "sabina", "label": "Sabina", "municipio": "Centro", "lat": 17.9517864, "lng": -92.9524085 },
     { "key": "santa-elena", "label": "Santa Elena", "municipio": "Centro", "lat": 17.9719048, "lng": -92.9905229 },
     { "key": "vicente-guerrero", "label": "Vicente Guerrero", "municipio": "Centro", "lat": 18.0315138, "lng": -92.8975353 }
   ]
   ```

   Nota: "Gaviotas Sur" (`18.0089, -92.9278`) quedó **sin corregir a
   propósito** en el frontend — no hay un match único e inequívoco en
   Nominatim (3 variantes distintas por sector, sin ninguna claramente "la"
   colonia completa, ver comentario en `colonias.ts`). No usar este valor
   como definitivo sin la misma verificación de dos fuentes independientes.

4. **Corregir la propiedad ya publicada** con el bug — slug
   `departamento-en-renta-en-gaviotas-norte-centro-1-rec-40-m-e873dacc`
   (id `e873dacc-d00e-4a50-b5b7-83de4b54be5d`) — una vez arreglado el cálculo,
   recalcular su `latPublico`/`lngPublico` (o simplemente re-guardarla, si el
   cálculo pasa a ser dinámico en cada lectura/escritura).

## 5. Verificación después de corregir

Repetir la Llamada A de la sección 2 (mismo `lat`/`lng`, colonia "Gaviotas
Norte") y confirmar que `latPublico`/`lngPublico` cae dentro de ~350-500m del
`lat`/`lng` enviado — no que coincida con un centroide fijo de colonia.
Repetir con un segundo punto claramente distinto dentro de la misma colonia
y confirmar que el `latPublico` resultante también se mueve (si sigue
devolviendo el mismo punto fijo sin importar el `lat`/`lng` real, el bug
sigue sin corregirse aunque el valor ya no sea el viejo).
