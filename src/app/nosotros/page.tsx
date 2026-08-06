import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Map, Zap, Users, ChevronRight, MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: '¿Quiénes somos? | Vive Villahermosa — Plataforma inmobiliaria de Tabasco',
  description:
    'Vive Villahermosa nació en Tabasco para ayudar a las personas a encontrar dónde vivir sin complicaciones. Conoce nuestra historia, misión y por qué incluimos el mapa de inundaciones.',
};

const VALUES = [
  {
    icon: <Shield size={24} className="text-brand" />,
    title: 'Transparencia',
    desc: 'Publicamos el riesgo de inundación de cada propiedad. Tabasco merece información honesta para decisiones inmobiliarias.',
  },
  {
    icon: <Map size={24} className="text-brand" />,
    title: 'Conocimiento local',
    desc: 'Somos de Tabasco. Conocemos las colonias, los tiempos de lluvias, los precios reales y las zonas con futuro.',
  },
  {
    icon: <Zap size={24} className="text-brand" />,
    title: 'Tecnología accesible',
    desc: 'Una plataforma rápida, con mapas y sin complicaciones. Publicar es gratis. Ver propiedades es gratis. Siempre.',
  },
  {
    icon: <Users size={24} className="text-brand" />,
    title: 'Comunidad primero',
    desc: 'No somos una franquicia nacional. Somos el portal inmobiliario que construye comunidad en Tabasco desde Tabasco.',
  },
];

export default function NosotrosPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-brand-pale text-brand text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
          <MapPin size={14} /> Hecho en Tabasco
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-black text-gray-900 mb-4">
          La plataforma inmobiliaria que Tabasco
          <span className="text-brand"> merecía</span>
        </h1>
        <p className="text-lg text-gray-500">
          Vive Villahermosa nació de una pregunta sencilla: ¿por qué es tan difícil encontrar casa en Tabasco?
          Creamos la plataforma que nos hubiera gustado tener cuando nosotros buscábamos.
        </p>
      </div>

      {/* Mission Statement */}
      <div className="bg-gradient-to-br from-brand-dark to-brand rounded-3xl p-8 md:p-12 text-white text-center mb-16">
        <p className="text-2xl md:text-3xl font-heading font-bold max-w-2xl mx-auto leading-snug">
          "Cada familia merece saber si su futura casa se inunda, antes de mudarse."
        </p>
        <p className="text-white/60 mt-4 text-sm">— Por qué existe Vive Villahermosa</p>
      </div>

      {/* Values */}
      <div className="mb-16">
        <h2 className="text-2xl font-heading font-bold text-center text-gray-800 mb-8">
          Lo que nos define
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {VALUES.map((v) => (
            <div key={v.title} className="bg-white rounded-2xl p-6 border border-gray-200 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-brand-pale rounded-xl flex items-center justify-center">
                {v.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">{v.title}</h3>
                <p className="text-sm text-gray-500">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Context */}
      <div className="max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl font-heading font-bold text-gray-800 mb-4">El contexto</h2>
        <div className="space-y-4 text-gray-600">
          <p>
            Tabasco es el estado con mayor precipitación pluvial de México. Villahermosa ha sufrido
            inundaciones históricas que afectan zonas completas. Sin embargo, los portales inmobiliarios
            nacionales no muestran esta información.
          </p>
          <p>
            Además, con la Refinería Dos Bocas en Paraíso, la demanda de renta en la zona costera
            se ha disparado — y nadie tenía una plataforma local para canalizarla.
          </p>
          <p>
            Vive Villahermosa integra mapa de riesgo hídrico CONAGUA, filtro especial Dos Bocas/PEMEX,
            cobertura de los 17 municipios y publicación 100% gratuita para propietarios.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        {[
          { num: '17', label: 'Municipios cubiertos' },
          { num: '24+', label: 'Propiedades activas' },
          { num: '100%', label: 'Publicación gratuita' },
          { num: '1', label: 'Sola misión: Tabasco' },
        ].map((s) => (
          <div key={s.label} className="bg-brand-pale rounded-2xl p-5 text-center">
            <p className="text-3xl font-display font-black text-brand">{s.num}</p>
            <p className="text-sm text-gray-600 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-gray-50 rounded-3xl p-8 text-center">
        <h2 className="text-2xl font-heading font-bold text-gray-800 mb-3">
          ¿Tienes una propiedad en Tabasco?
        </h2>
        <p className="text-gray-500 mb-5">
          Publica gratis y empieza a recibir mensajes de personas interesadas. Contacto directo, sin comisiones, sin intermediarios.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/publicar"
            className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Publicar gratis <ChevronRight size={18} />
          </Link>
          <Link
            href="/propiedades"
            className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:border-brand hover:text-brand transition-colors"
          >
            Ver propiedades
          </Link>
        </div>
      </div>
    </div>
  );
}
