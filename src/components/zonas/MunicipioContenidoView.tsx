import type { MunicipioContenido } from '@/types/zone';

function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Tarjeta "Sobre el municipio" unificada: la descripción corta, los datos del
 * Censo y el contenido ampliado (historia, geografía, economía, qué visitar y
 * conexiones) en un solo bloque, con las fuentes a la vista.
 * Server Component: todo el texto sale en el HTML inicial (a diferencia de un
 * bloque cargado en el navegador), que es lo que un rastreador lee.
 */
export function MunicipioContenidoView({
  descripcion,
  contenido,
}: {
  descripcion: string;
  contenido: MunicipioContenido;
}) {
  const { datos, secciones, fuentes, consultado } = contenido;
  return (
    <section
      aria-labelledby="sobre-municipio"
      className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5 animate-fade-up"
      style={{ animationDelay: '60ms' }}
    >
      <div>
        <h2 id="sobre-municipio" className="font-heading font-bold text-gray-800 mb-2">Sobre el municipio</h2>
        <p className="text-gray-600 text-sm leading-relaxed">{descripcion}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-brand-pale rounded-2xl p-4">
          <p className="text-xs text-gray-500">Población (Censo 2020)</p>
          <p className="text-xl font-display font-black text-brand mt-0.5">{datos.poblacion2020.toLocaleString('es-MX')}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Cabecera municipal</p>
          <p className="text-base font-heading font-bold text-gray-800 mt-0.5">{datos.cabecera}</p>
        </div>
      </div>

      {secciones.map((s) => (
        <div key={s.titulo}>
          <h3 className="font-heading font-bold text-gray-800 text-sm mb-1.5">{s.titulo}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{s.texto}</p>
        </div>
      ))}

      <div className="border-t border-gray-100 pt-3">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Fuentes consultadas el {fechaLarga(consultado)}:{' '}
          {fuentes.map((f, i) => (
            <span key={f.nombre}>
              {i > 0 && '; '}
              {f.url ? (
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                  {f.nombre}
                </a>
              ) : (
                f.nombre
              )}
            </span>
          ))}
          . Texto redactado por Vive Villahermosa.
        </p>
      </div>
    </section>
  );
}
