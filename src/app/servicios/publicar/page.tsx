import type { Metadata } from 'next';
import { Camera, Clock, Percent } from 'lucide-react';
import { PublishServicioForm } from '@/components/forms/PublishServicioForm';

export const metadata: Metadata = {
  title: 'Publica tu servicio gratis | Vive Villahermosa',
  description: 'Ofrece plomería, pintura, mudanza, remodelación y más servicios para el hogar en Tabasco. Publica gratis.',
};

const BENEFICIOS = [
  {
    icon: Camera,
    titulo: 'Tu carta de presentación',
    texto: 'Arma tu propio portafolio con fotos de tus trabajos y la historia de cada uno. Se llena a tu ritmo — puedes empezar con una foto y regresar después a agregar más.',
  },
  {
    icon: Clock,
    titulo: 'No se entierra en un feed',
    texto: 'A diferencia de un post en un grupo de Facebook, tu ficha se queda buscable indefinidamente — no depende de que la gente la vea justo el día que la publicas.',
  },
  {
    icon: Percent,
    titulo: 'Sin comisión por contacto',
    texto: 'Publicar es gratis y quien te contacte lo hace directo — la plataforma no cobra nada por cada cliente que te escribe.',
  },
];

export default function PublicarServicioPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-xl mx-auto text-center mb-8">
        <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2">
          Publica tu servicio gratis
        </h1>
        <p className="text-gray-500">
          Plomería, pintura, mudanza, remodelación, albañilería y más — aparece en el directorio de servicios de Tabasco.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-10">
        {BENEFICIOS.map(({ icon: Icon, titulo, texto }) => (
          <div key={titulo} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="w-9 h-9 rounded-xl bg-brand-pale text-brand flex items-center justify-center mx-auto mb-2.5">
              <Icon size={16} />
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">{titulo}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{texto}</p>
          </div>
        ))}
      </div>

      <PublishServicioForm />
    </div>
  );
}
