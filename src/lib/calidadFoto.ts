/**
 * Chequeo técnico de foto — enfoque (varianza de Laplaciano) y brillo
 * promedio, 100% en el navegador con Canvas, sin ninguna llamada de red.
 * Distinto de analizarFoto() en PublishForm.tsx (esa es la IA de contenido/
 * fraude/amenidades vía backend) — esto es visión por computadora simple,
 * gratis, y corre antes/en paralelo a esa llamada.
 *
 * Umbrales calibrados a ojo sobre fotos de prueba, no medidos contra un
 * dataset real — es una sugerencia no-bloqueante (mismo criterio que el
 * resto de la IA de la plataforma), así que un falso positivo ocasional no
 * tiene consecuencia real, solo un aviso de más.
 */
export interface CalidadFoto {
  /** 0–100, mayor = mejor (nitidez + qué tan cerca del brillo ideal). */
  score: number;
  borrosa: boolean;
  oscura: boolean;
  sobreexpuesta: boolean;
}

const LADO_MUESTRA = 200;
const UMBRAL_VARIANZA_BORROSA = 250;
const BRILLO_OSCURO = 60;
const BRILLO_SOBREEXPUESTO = 220;
const BRILLO_IDEAL = 130;

export async function evaluarCalidadFoto(file: File): Promise<CalidadFoto | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = LADO_MUESTRA;
    canvas.height = LADO_MUESTRA;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return null; }
    ctx.drawImage(bitmap, 0, 0, LADO_MUESTRA, LADO_MUESTRA);
    bitmap.close();

    const { data } = ctx.getImageData(0, 0, LADO_MUESTRA, LADO_MUESTRA);
    const n = LADO_MUESTRA * LADO_MUESTRA;
    const gray = new Float32Array(n);
    let sumaBrillo = 0;
    for (let i = 0; i < n; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const v = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[i] = v;
      sumaBrillo += v;
    }
    const brillo = sumaBrillo / n;

    // Laplaciano de 4 vecinos — proxy estándar y barato de "cuánto detalle
    // de borde hay"; una foto borrosa tiene poca variación entre píxeles
    // vecinos, así que su varianza sale baja.
    let sumaLap = 0, sumaLapCuad = 0, cuenta = 0;
    for (let y = 1; y < LADO_MUESTRA - 1; y++) {
      for (let x = 1; x < LADO_MUESTRA - 1; x++) {
        const idx = y * LADO_MUESTRA + x;
        const lap = 4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - LADO_MUESTRA] - gray[idx + LADO_MUESTRA];
        sumaLap += lap;
        sumaLapCuad += lap * lap;
        cuenta++;
      }
    }
    const mediaLap = sumaLap / cuenta;
    const varianza = sumaLapCuad / cuenta - mediaLap * mediaLap;

    const nitidezScore = Math.min(varianza / 500, 1) * 60;
    const brilloScore = Math.max(0, 1 - Math.abs(brillo - BRILLO_IDEAL) / BRILLO_IDEAL) * 40;

    return {
      score: Math.round(nitidezScore + brilloScore),
      borrosa: varianza < UMBRAL_VARIANZA_BORROSA,
      oscura: brillo < BRILLO_OSCURO,
      sobreexpuesta: brillo > BRILLO_SOBREEXPUESTO,
    };
  } catch {
    return null;
  }
}
