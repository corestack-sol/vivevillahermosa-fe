// Grilla dinámica de tarjetas de propiedad (auto-fill + minmax), no columnas
// fijas por breakpoint — el número de columnas sale solo de cuánto ancho hay
// disponible, en vez de saltar en escalones rígidos. minWidth crece por
// breakpoint (más chico en móvil, para garantizar 2 columnas incluso en
// un teléfono angosto; más grande en escritorio) porque un solo valor no
// puede servir para "mínimo 2 en móvil" Y "3 columnas alrededor de
// 1366-1600px de ancho" a la vez — pedido explícito (2026-08-09): mínimo
// 2, máximo 5, y que 3 sea el punto natural en resoluciones de laptop
// grande/escritorio estándar.
// auto-fill, NO auto-fit — con auto-fit, las columnas vacías colapsan y
// el 1fr restante se lo reparte entre las tarjetas que sí existen (con 1
// solo resultado, esa tarjeta se estira a ocupar toda la fila). auto-fill
// mantiene las columnas vacías como espacio muerto, así el tamaño de
// cada tarjeta no depende de cuántos resultados haya — pedido explícito
// 2026-08-19.
//
// Extraída de PropertiesClient.tsx (2026-08-19) para reusarla tal cual en
// /zonas/[slug] — antes esa página tenía su propia grilla fija
// (grid-cols-1 md:grid-cols-2), así que sus tarjetas se veían más grandes
// que en cualquier otra página del sitio con pocos resultados (ej. un
// municipio con solo 3 propiedades). Una sola fuente de verdad evita que
// las dos grillas se desalineen otra vez.
//
// Matemática de los puntos de quiebre (ancho de grilla ya sin sidebar/
// padding/gaps, con gap-4 = 16px entre tarjetas):
//   móvil  (<640px):  minmax(140px,1fr) → nunca baja de 2 columnas
//   sm     (≥640px):  minmax(220px,1fr) → 2-3 según ancho
//   lg     (≥1024px): minmax(260px,1fr) → 2-3, sidebar de filtros ya visible
//   xl     (≥1280px): minmax(300px,1fr) → 3 columnas ~1010-1600px de
//                      grilla (cubre laptop/escritorio estándar), 4 a
//                      partir de ~1600px, 5 a partir de ~1920px.
// El techo de nunca pasar de 5 lo pone el contenedor (max-w del layout que
// la use), no esta clase — con minWidth=300px, una 6ª columna
// matemáticamente no cabe en un contenedor de 2200px.
export const PROPERTY_GRID_CLASSES =
  'grid gap-4 ' +
  'grid-cols-[repeat(auto-fill,minmax(140px,1fr))] ' +
  'sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] ' +
  'lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] ' +
  'xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]';
