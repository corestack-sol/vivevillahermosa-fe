# Auditoría de derechos de autor — fotos de municipios (/zonas/[slug])

**Fecha: 17/09/2026**
**Resultado: 15/17 OK, 2 quitadas**

## Por qué

Las 17 fotos de portada de `/zonas/[slug]` (municipios de Tabasco) se
agregaron el 2026-08-19 con un crédito de autor en el código
(`MUNICIPIO_FOTO_CREDITO`, `src/app/zonas/[slug]/page.tsx`) y un mensaje
de commit que decía "licencia verificada" — sin dejar ninguna URL de
origen documentada. Pedido explícito 2026-09-17: re-verificar cada una
contra Wikimedia Commons real, sin confiar en esa nota vieja.

## Metodología

Para cada una de las 17: se leyó el `.webp` local para conocer la escena
real, se buscó en Commons una foto de ese municipio por el autor exacto
que ya estaba en el código, y se abrió la página `File:` real de cada
candidata para leer la licencia completa (no solo el ícono) y confirmar
autor + contenido visual razonablemente compatible.

## Resultado por municipio

| Municipio | Autor | Archivo de Commons | Licencia | Veredicto |
|---|---|---|---|---|
| Centro | Alfonsobouchot | [Villahermosa.Palacio de Gobierno 12.JPG](https://commons.wikimedia.org/wiki/File:Villahermosa.Palacio_de_Gobierno_12.JPG) | CC BY-SA 3.0 | OK |
| Cárdenas | Alfonsobouchot | [Cárdenas Parque Independencia.jpg](https://commons.wikimedia.org/wiki/File:C%C3%A1rdenas_Parque_Independencia.jpg) | Dominio público (PD-self) | OK |
| Comalcalco | ~~Miguel Marín~~ | **no encontrado** | — | **QUITADA** — sin autor verificable en Commons ligado a Tabasco |
| Paraíso | Alfonsobouchot | [Paraiso.Iglesia y parque.jpg](https://commons.wikimedia.org/wiki/File:Paraiso.Iglesia_y_parque.jpg) | Dominio público (PD-self) | OK |
| Jalpa de Méndez | Olavarria10 | [Jalpa.jpg](https://commons.wikimedia.org/wiki/File:Jalpa.jpg) | CC BY-SA 4.0 | OK |
| Nacajuca | Cultura Yokotan | [Nacajuca 2025.jpg](https://commons.wikimedia.org/wiki/File:Nacajuca_2025.jpg) | CC BY-SA 4.0 | OK |
| Huimanguillo | Alfonsobouchot | [Huimanguillo Parque Juárez.jpg](https://commons.wikimedia.org/wiki/File:Huimanguillo_Parque_Ju%C3%A1rez.jpg) | Dominio público (PD-self) | OK |
| Centla | Alfonsobouchot | [Pantanos de Centla 03.JPG](https://commons.wikimedia.org/wiki/File:Pantanos_de_Centla_03.JPG) | CC BY-SA 3.0 | OK |
| Macuspana | Alfonsobouchot | [Macuspana Palacio Municipal.jpg](https://commons.wikimedia.org/wiki/File:Macuspana_Palacio_Municipal.jpg) | CC BY-SA 4.0 | OK |
| Cunduacán | Alfonsobouchot | [Cunduacán.Iglesia Natividad.JPG](https://commons.wikimedia.org/wiki/File:Cunduac%C3%A1n.Iglesia_Natividad.JPG) | CC BY-SA 3.0 | OK |
| Tenosique | ~~ProtoplasmaKid~~ | **no encontrado** | — | **QUITADA** — el autor no tiene contenido de Tabasco; la única foto real del puente de Boca del Cerro en Commons es de otro fotógrafo (David Oliva) |
| Emiliano Zapata | Kazekage AMT | [Actual Malecón de Emiliano Zapata.JPG](https://commons.wikimedia.org/wiki/File:Actual_Malec%C3%B3n_de_Emiliano_Zapata.JPG) | Dominio público (PD-self) | OK |
| Balancán | Kazekage AMT | [Centro de Balancán.jpg](https://commons.wikimedia.org/wiki/File:Centro_de_Balanc%C3%A1n.jpg) | Dominio público (PD-self) | OK |
| Jonuta | Kazekage AMT | [Panorámica de Jonuta.jpg](https://commons.wikimedia.org/wiki/File:Panor%C3%A1mica_de_Jonuta.jpg) | Dominio público (PD-self) | OK |
| Jalapa | Alfonsobouchot | [Tunel Vegetal, Jalapa Tabasco.JPG](https://commons.wikimedia.org/wiki/File:Tunel_Vegetal,_Jalapa_Tabasco.JPG) | Dominio público (PD-self) | OK |
| Tacotalpa | Alfonsobouchot | [Tacotalpa. Parque principal.JPG](https://commons.wikimedia.org/wiki/File:Tacotalpa._Parque_principal.JPG) | CC BY-SA 4.0 | OK |
| Teapa | Haikabio | [Parroquia de Santiago Apóstol Teapa Tabasco.jpg](https://commons.wikimedia.org/wiki/File:Parroquia_de_Santiago_Ap%C3%B3stol_Teapa_Tabasco.jpg) | CC BY-SA 3.0 | OK |

## Acciones tomadas

1. **Comalcalco y Tenosique**: foto quitada por completo — `foto` removido
   de `src/data/municipalities.json`, ambos `.webp` borrados del repo
   (`public/images/zones/`), `Municipality.foto` ahora opcional
   (`src/types/zone.ts`). La UI ya tenía un fallback a ícono genérico sin
   foto, no hizo falta tocar el render de `/zonas/[slug]/page.tsx` para
   eso.
2. **Crédito CC BY-SA insuficiente**: 8 de las 15 restantes están bajo
   CC BY-SA (no dominio público), licencia que exige nombrar la licencia
   y avisar que la obra se adaptó (conversión a .webp + recorte), no solo
   el autor. `MUNICIPIO_FOTO_CREDITO` pasó de `Record<string, string>` a
   `Record<string, { autor: string; licencia?: { nombre, url } }>` — las
   8 con licencia SA ahora muestran "{Autor} · CC BY-SA X.0 (enlazado a
   la licencia real), adaptada".
3. **Ninguna** de las 15 confirmadas usa CC-BY-NC o CC-BY-ND (que
   prohibirían este uso comercial/derivado) — 7 son dominio público
   (PD-self, sin restricción alguna) y 8 son CC BY-SA (permiten uso
   comercial y derivados, con atribución).

## Para la próxima vez

Si se agrega o reemplaza una foto de municipio, documentar aquí mismo (o
en un archivo nuevo con esta misma disciplina) la URL exacta del archivo
de Commons — así una futura auditoría parte de evidencia real, no de un
nombre de autor sin rastro verificable.
