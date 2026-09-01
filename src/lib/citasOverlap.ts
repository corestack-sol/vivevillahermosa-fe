export interface CitaExistente {
  id: string;
  titulo: string;
  nombreCliente: string;
  fecha: string;
  duracionMin: number;
  estado: 'confirmada' | 'cancelada' | 'completada';
}

/**
 * El backend ya valida traslape al agendar (`POST /citas`) — esto es solo
 * el pre-chequeo del lado del cliente, con las citas que
 * dashboard/citas/page.tsx ya tiene cargadas para el mes visible, para que
 * NuevaCitaModal.tsx pueda avisar MIENTRAS la persona elige fecha/hora, en
 * vez de que se entere hasta enviar el formulario (reporte real
 * 2026-09-01, mismo patrón que el límite de propiedades). Una cita
 * 'cancelada' nunca cuenta como traslape.
 */
export function citaSolapada(
  candidato: { fecha: string; duracionMin: number },
  citas: CitaExistente[],
  excluirId?: string,
): CitaExistente | null {
  const inicio = new Date(candidato.fecha).getTime();
  if (Number.isNaN(inicio)) return null;
  const fin = inicio + candidato.duracionMin * 60_000;

  for (const c of citas) {
    if (c.estado === 'cancelada') continue;
    if (excluirId && c.id === excluirId) continue;
    const cInicio = new Date(c.fecha).getTime();
    if (Number.isNaN(cInicio)) continue;
    const cFin = cInicio + c.duracionMin * 60_000;
    if (inicio < cFin && cInicio < fin) return c;
  }
  return null;
}
