import type { Metadata } from 'next';
import { Target, Zap, Phone } from 'lucide-react';
import { PublishForm } from '@/components/forms/PublishForm';

export const metadata: Metadata = {
  title: 'Publica tu propiedad gratis en Tabasco | Vive Villahermosa',
  description:
    'Publica tu casa, departamento, habitación o terreno en Villahermosa y Tabasco gratis. Sin comisiones. Contacto directo con interesados. Listo en minutos.',
};

export default function PublicarPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      <div className="max-w-2xl mx-auto text-center mb-8">
        <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2">
          Publica tu propiedad gratis
        </h1>
        <p className="text-gray-500">
          Llena el formulario y empieza a recibir mensajes de interesados.
          <strong className="text-brand"> Sin comisiones, sin complicaciones.</strong>
        </p>
      </div>

      <PublishForm />

      <div className="max-w-2xl mx-auto mt-6 grid grid-cols-3 gap-4 text-center">
        {[
          { Icon: Target, label: 'Sin comisiones', desc: 'El contacto es directo' },
          { Icon: Zap, label: 'Listo en minutos', desc: 'Sin procesos largos' },
          { Icon: Phone, label: 'Contacto directo', desc: 'Hablas con el interesado' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl p-4 border border-gray-100">
            <item.Icon size={20} className="mx-auto mb-1.5 text-brand" strokeWidth={1.75} />
            <p className="text-xs font-semibold text-gray-700">{item.label}</p>
            <p className="text-xs text-gray-400">{item.desc}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
