// Parámetros de URL que llevan secretos de un solo uso (ej. el enlace de
// confirmación de cambio de correo, /cuenta/confirmar-cambio-correo?token=…).
// Se censuran antes de mandar cualquier evento a PostHog — `$current_url` se
// adjunta a cada clic y a cada salida de página, y un token ahí sería un
// secreto en manos de un tercero.
const PARAMETROS_SECRETOS = /([?&#](?:token|codigo|code)=)[^&#\s]*/gi;

export function redactarUrl(valor: string): string {
  return valor.replace(PARAMETROS_SECRETOS, '$1[redacted]');
}

export function redactarPropiedades<T extends Record<string, unknown>>(props: T): T {
  const salida: Record<string, unknown> = { ...props };
  for (const [clave, valor] of Object.entries(salida)) {
    if (typeof valor === 'string' && /[?&#](?:token|codigo|code)=/i.test(valor)) {
      salida[clave] = redactarUrl(valor);
    }
  }
  return salida as T;
}
