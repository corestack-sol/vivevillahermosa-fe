# Vive Villahermosa

Portal inmobiliario para Tabasco, México (Villahermosa y los 17 municipios del estado): búsqueda con filtros y mapa interactivo, riesgo de inundación por zona (Atlas de Riesgos / CONAGUA), publicación de propiedades con IA (detección de fraude, moderación de contenido), y directorio de servicios para el hogar.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4** — 100% frontend, sin base de datos propia
- Backend real en repo aparte ([`vivevillahermosa-be`](../vivevillahermosa-be), NestJS + Prisma + Postgres) — ver `docs/BACKEND.md`
- Auth: cookie httpOnly con JWT (`jose`) firmado por el backend, OAuth Google/Facebook
- Mapas: Leaflet + `leaflet.markercluster`
- Forms: `react-hook-form` + `zod`

**Importante para cualquier agente/IA trabajando en este repo:** lee `AGENTS.md` antes de escribir código — esta versión de Next.js tiene cambios respecto a lo que un modelo entrenado antes de su lanzamiento puede asumir.

## Levantar el proyecto

```bash
npm install
cp .env.example .env.local   # completar las variables (ver abajo)
npm run dev
```

Requiere el backend real corriendo aparte (`vivevillahermosa-be`, `npm run start:dev`, puerto 3001 por default) — este repo no tiene base de datos propia, todo lo que antes vivía en Prisma local (auth, moderación del buscador, colonias descubiertas) se le pregunta al backend.

Abrir [http://localhost:3000](http://localhost:3000).

Variables de entorno mínimas para desarrollo — ver `.env.example` para la lista completa y comentarios: `NEXT_PUBLIC_API_URL` (URL del backend local), `JWT_SECRET` (debe ser idéntico al del backend). El resto (OAuth, `CRON_SECRET`) es opcional en desarrollo.

## Estado del proyecto — dónde está cada cosa

Este proyecto tiene **mucho más frontend construido que backend real** — varias herramientas (formulario de publicar, gestión de "mis propiedades", panel de inmobiliaria) corren hoy sobre una simulación en `localStorage` del navegador, documentada explícitamente en el código con comentarios `⚠️ BACKEND` (`grep -rn "⚠️ BACKEND" src/` para encontrarlos todos).

**Si vas a trabajar en el backend, hay un solo documento — [`docs/BACKEND.md`](docs/BACKEND.md).** Todo lo pendiente del lado del servidor vive ahí, organizado por prioridad:
1. **V1 (MVP, bloqueante)** — búsqueda + publicación + gestión de propiedades, para cualquier cuenta.
2. **V2** — panel profesional para inmobiliarias, cobro real, agenda de citas, directorio de servicios (**en pausa**, no asignar).
3. **Seguridad e infraestructura** — transversal a V1/V2.

Otros documentos, distintos en propósito (no se fusionaron con el de arriba):

| Documento | Para qué |
|---|---|
| [`docs/investigacion-mercado-tabasco.md`](docs/investigacion-mercado-tabasco.md) | Investigación de mercado (negocio, no técnico) |
| [`fase1-spec.md`](fase1-spec.md) / [`fase2-spec.md`](fase2-spec.md) | Specs originales del roadmap por fases (parcialmente desactualizadas — ver banner al inicio de cada una) |
| [`SECURITY.md`](SECURITY.md) | Cómo reportar una vulnerabilidad |

## Comandos útiles

```bash
npm run dev          # servidor de desarrollo (Turbopack)
npx tsc --noEmit      # type-check
npx eslint src/       # lint
```
