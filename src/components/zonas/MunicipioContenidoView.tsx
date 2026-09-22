import type { MunicipioContenido } from '@/types/zone';
import { SobreMunicipioColapsable } from './SobreMunicipioColapsable';

function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

// En móvil solo se ve el encabezado con sus dos cifras; lo demás aparece al
// abrir la tarjeta (ver SobreMunicipioColapsable). En md+ todo está visible.
const SOLO_AL_ABRIR = 'hidden md:block group-data-[abierto=true]:block';

/**
 * Tarjeta "Sobre el municipio" unificada: la descripción corta, los datos del
 * Censo y el contenido ampliado (historia, geografía, economía, qué visitar y
 * conexiones) en un solo bloque, con las fuentes a la vista.
 * Todo el texto sale en el HTML inicial (a diferencia de un bloque cargado en
 * el navegador), que es lo que un rastreador lee, aunque en móvil esté plegado.
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
    <SobreMunicipioColapsable titulo="Sobre el municipio">
      <p className={`text-gray-600 text-sm leading-relaxed ${SOLO_AL_ABRIR}`}>{descripcion}</p>

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

      <div className={`space-y-5 ${SOLO_AL_ABRIR}`}>
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
      </div>
    </SobreMunicipioColapsable>
  );
}
