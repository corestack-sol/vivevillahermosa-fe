import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MiPropiedad } from './misPropiedadesDemo';
import { ESTADO_CFG } from './misPropiedadesDemo';

const BRAND_DARK: [number, number, number] = [10, 79, 72];
const BRAND: [number, number, number] = [13, 112, 101];
const BRAND_PALE: [number, number, number] = [230, 245, 244];
const ACCENT: [number, number, number] = [245, 158, 11];
const GRAY: [number, number, number] = [107, 114, 128];
const GRAY_LIGHT: [number, number, number] = [156, 163, 175];
const INK: [number, number, number] = [17, 24, 39];
const WHITE: [number, number, number] = [255, 255, 255];
const ROW_ALT: [number, number, number] = [246, 250, 249];

const MARGIN = 14;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);
}

interface GenerarReporteParams {
  nombreCuenta: string;
  propiedades: MiPropiedad[];
  nombreEmpresa?: string | null;
  logoDataUrl?: string | null;
  // Resumen generado por el backend (POST /ia/resumen-reporte, ver
  // src/lib/aiClient.ts, obtenerResumenReporte) — opcional porque quien
  // llama a esta función puede no haberlo pedido, o la llamada pudo fallar.
  // Sin él, se usa el cálculo mecánico de siempre.
  resumenIA?: string | null;
}

/**
 * Genera y descarga un PDF con el desempeño de la cartera — pensado para
 * que un agente se lo mande al dueño de la propiedad que administra, con el
 * look de una herramienta corporativa (no una tabla simple). Corre
 * enteramente en el navegador (jsPDF), no necesita backend.
 *
 * ⚠️ Sigue las mismas reglas de honestidad que el resto del panel
 * profesional: el resumen y la tabla usan los números que ya se ven en
 * `/dashboard/propiedades` (hoy datos de muestra, ver
 * misPropiedadesDemo.ts) — el PDF lo dice explícitamente en el pie de
 * página. No incluye comparación contra el periodo anterior porque no
 * existe historial real todavía; agregarla sin datos reales sería inventar
 * una tendencia. El insight (con IA si `resumenIA` viene, o el cálculo
 * mecánico si no) es siempre un resumen real de los números que hay, nunca
 * un dato inventado.
 */
export function generarReporteDesempeno({ nombreCuenta, propiedades, nombreEmpresa, logoDataUrl, resumenIA }: GenerarReporteParams): void {
  const doc = new jsPDF();
  const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const nombreMostrado = nombreEmpresa?.trim() || nombreCuenta;

  // ── Header corporativo ──
  const HEADER_H = 38;
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, PAGE_W, HEADER_H, 'F');

  let textX = MARGIN;
  if (logoDataUrl) {
    const logoSize = 20;
    const logoY = (HEADER_H - logoSize) / 2;
    doc.setFillColor(...WHITE);
    doc.roundedRect(MARGIN, logoY, logoSize, logoSize, 3, 3, 'F');
    try {
      const pad = 2;
      doc.addImage(logoDataUrl, 'PNG', MARGIN + pad, logoY + pad, logoSize - pad * 2, logoSize - pad * 2);
    } catch {
      // Si el data URI no es válido por alguna razón, seguimos sin logo en vez de romper el reporte.
    }
    textX = MARGIN + logoSize + 6;
  }

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  // Un nombre comercial largo sin límite se salía del encabezado hacia la
  // derecha (nada en jsPDF hace wrap/clip automático de doc.text) — se
  // trunca a una sola línea que quepa en el ancho disponible antes del
  // bloque "Vive Villahermosa" de la derecha.
  const anchoDisponibleNombre = PAGE_W - textX - MARGIN - 35;
  const [primeraLinea, ...resto] = doc.splitTextToSize(nombreMostrado, anchoDisponibleNombre) as string[];
  doc.text(resto.length > 0 ? `${primeraLinea.trimEnd()}…` : primeraLinea, textX, HEADER_H / 2 - 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(210, 230, 227);
  doc.text('Reporte de desempeño de cartera', textX, HEADER_H / 2 + 5);

  doc.setFontSize(8);
  doc.setTextColor(190, 215, 211);
  doc.text('Vive Villahermosa', PAGE_W - MARGIN, 13, { align: 'right' });
  doc.text(fecha, PAGE_W - MARGIN, 19, { align: 'right' });

  // Barra de acento
  doc.setFillColor(...ACCENT);
  doc.rect(0, HEADER_H, PAGE_W, 1.6, 'F');

  let y = HEADER_H + 14;

  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Cuenta: ${nombreCuenta}`, MARGIN, y);

  y += 10;

  // ── Tarjetas de KPI ──
  const totales = propiedades.reduce(
    (acc, p) => ({
      vistas: acc.vistas + p.vistas,
      contactos: acc.contactos + p.contactos,
      favoritos: acc.favoritos + p.favoritos,
    }),
    { vistas: 0, contactos: 0, favoritos: 0 }
  );

  const kpis = [
    { label: 'Propiedades', value: propiedades.length },
    { label: 'Vistas totales', value: totales.vistas },
    { label: 'Contactos', value: totales.contactos },
    { label: 'Favoritos', value: totales.favoritos },
  ];

  const gap = 4;
  const cardW = (CONTENT_W - gap * (kpis.length - 1)) / kpis.length;
  const cardH = 24;

  kpis.forEach((k, i) => {
    const x = MARGIN + i * (cardW + gap);
    doc.setFillColor(...BRAND_PALE);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'F');
    doc.setFillColor(...ACCENT);
    doc.roundedRect(x, y, 6, 6, 1.5, 1.5, 'F');

    doc.setTextColor(...BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(String(k.value), x + 5, y + cardH - 12);

    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(k.label, x + 5, y + cardH - 4);
  });

  y += cardH + 10;

  // ── Insight — el resumen de Gemini si vino, si no el cálculo mecánico ──
  const promedioContactos = propiedades.length ? totales.contactos / propiedades.length : 0;
  const destacada = propiedades.reduce<MiPropiedad | null>(
    (max, p) => (p.contactos > (max?.contactos ?? -1) ? p : max),
    null
  );

  const textoMecanico = (destacada && promedioContactos > 0 && destacada.contactos > promedioContactos)
    ? `"${destacada.property.titulo}" recibió ${Math.round((destacada.contactos / promedioContactos - 1) * 100)}% más contactos que el promedio de tu cartera.`
    : null;
  const texto = resumenIA?.trim() || textoMecanico;

  if (texto) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lineas = doc.splitTextToSize(texto, CONTENT_W - 14) as string[];
    const boxH = lineas.length * 5 + 8;

    doc.setFillColor(...BRAND_PALE);
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 2.5, 2.5, 'F');
    doc.setFillColor(...BRAND);
    doc.roundedRect(MARGIN, y, 1.6, boxH, 0.8, 0.8, 'F');

    doc.setTextColor(...BRAND_DARK);
    doc.text(lineas, MARGIN + 6, y + 6);
    y += boxH + 10;
  }

  // ── Detalle por propiedad ──
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Detalle por propiedad', MARGIN, y);
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN, y + 1.5, 16, 1.2, 'F');
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Propiedad', 'Estado', 'Precio', 'Vistas', 'Contactos', 'Favoritos']],
    body: propiedades.map((p) => [
      p.property.titulo,
      ESTADO_CFG[p.estado].label,
      fmtMoney(p.property.precio) + (p.property.operacion === 'renta' ? '/mes' : ''),
      String(p.vistas),
      String(p.contactos),
      String(p.favoritos),
    ]),
    headStyles: { fillColor: BRAND, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3, textColor: INK },
    alternateRowStyles: { fillColor: ROW_ALT },
    margin: { left: MARGIN, right: MARGIN },
  });

  // ── Footer honesto en cada página ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GRAY_LIGHT);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 284, PAGE_W - MARGIN, 284);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(
      'Vista previa del panel profesional — datos de muestra hasta que exista publicación real (Fase 2). Generado por Vive Villahermosa.',
      MARGIN,
      289
    );
    doc.text(`Página ${i} de ${pageCount}`, PAGE_W - MARGIN, 289, { align: 'right' });
  }

  doc.save(`reporte-${nombreMostrado.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
