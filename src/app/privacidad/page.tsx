import type { Metadata } from 'next';
import Image from 'next/image';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { EliminarCuentaSection } from '@/components/account/EliminarCuentaSection';

export const metadata: Metadata = {
  title: 'Aviso de privacidad | Vive Villahermosa',
  description: 'Qué datos recolecta Vive Villahermosa, para qué los usa, y cómo puedes ejercer tus derechos ARCO o solicitar la eliminación de tu cuenta.',
};

export default function PrivacidadPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={22} className="text-brand" />
        <h1 className="text-3xl font-heading font-bold text-gray-900">Aviso de privacidad</h1>
      </div>
      <p className="text-sm text-gray-400 mb-10">Última actualización: 19 de agosto de 2026</p>

      {/* Grid principal + mascota fija a la derecha — mismo patrón sticky
          que el sidebar de /zonas/[slug] (lg:col-span-1, sticky top-24).
          Pedido explícito 2026-08-19: ícono propio de "terms & conditions"
          del lado derecho, mantiene su posición al hacer scroll. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 prose prose-sm max-w-none text-gray-700 space-y-8">
        <section>
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-2">1. Responsable</h2>
          <p className="leading-relaxed">
            Vive Villahermosa (&quot;nosotros&quot;, &quot;la plataforma&quot;) es responsable del tratamiento de los datos personales que recolecta a través de este sitio, con domicilio en Villahermosa, Tabasco, México.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-2">2. Qué datos recolectamos</h2>
          <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
            <li>Datos de cuenta: nombre, correo electrónico y contraseña (almacenada siempre cifrada, nunca en texto plano).</li>
            <li>Si inicias sesión con Google o Facebook: el nombre, correo y foto de perfil que esos proveedores nos comparten con tu autorización.</li>
            <li>Datos de contacto que escribes al enviar un mensaje sobre una propiedad: nombre, teléfono y correo.</li>
            <li>Preferencias de búsqueda que guardas como alertas (municipio, tipo de propiedad, precio máximo, etc.).</li>
            <li>Si publicas una propiedad: los datos de contacto que tú decides mostrar a interesados (nombre, teléfono, correo).</li>
            <li>Analítica de uso (qué páginas se visitan, qué botones se usan) mediante PostHog — sin usar cookies de rastreo, y sin registrar lo que escribes en ningún formulario (nombre, teléfono, correo, mensajes). Solo mide comportamiento agregado, nunca el contenido de lo que escribes. Adicionalmente, si ocurre un error técnico en nuestro servidor mientras usas la plataforma, se envía a PostHog información técnica del momento del error (tu dirección IP, navegador, y la ruta que estabas usando) — únicamente con fines de diagnóstico, nunca el contenido de lo que escribiste.</li>
          </ul>
          <p className="leading-relaxed mt-3">
            Algunas preferencias (propiedades favoritas antes de iniciar sesión, comparador, búsquedas recientes) se guardan únicamente en tu navegador (localStorage), no en nuestros servidores, y desaparecen si borras los datos de ese navegador.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-2">3. Para qué usamos tus datos</h2>
          <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
            <li>Crear y mantener tu cuenta, y permitirte iniciar sesión.</li>
            <li>Mostrar tus propiedades favoritas y gestionar tus alertas.</li>
            <li>Enviarte un correo cuando se publique una propiedad que coincide con una alerta que creaste.</li>
            <li>Permitir que un propietario o agente vea tu mensaje de contacto cuando escribes sobre una de sus propiedades.</li>
            <li>Mejorar la plataforma (qué se busca más, qué falla).</li>
          </ul>
          <p className="leading-relaxed mt-3">
            No usamos tus datos para publicidad de terceros ni los vendemos a nadie.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-2">4. Con quién compartimos tus datos</h2>
          <p className="leading-relaxed">
            Hoy no compartimos tus datos personales con terceros para fines comerciales. Sí usamos proveedores de servicio que procesan datos en nuestro nombre para que la plataforma funcione:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 leading-relaxed mt-2">
            <li>Un proveedor de correo transaccional para enviar las notificaciones de alertas.</li>
            <li>Proveedores de autenticación (Google, Facebook) cuando eliges iniciar sesión con ellos.</li>
            <li>PostHog para analítica de uso (nunca para publicidad).</li>
            <li>Cloudinary — almacenamiento de las fotos que subes al publicar una propiedad.</li>
            <li>OpenRouter (Google Gemini) — procesa el texto de tus publicaciones (título, descripción) para el análisis automático de fraude y la generación de descripciones asistida, y el texto de tus búsquedas para el buscador con IA.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-2">5. Tus derechos (ARCO)</h2>
          <p className="leading-relaxed">
            Puedes solicitar en cualquier momento <strong>Acceder</strong> a tus datos, <strong>Rectificarlos</strong> si están desactualizados, <strong>Cancelarlos</strong> (eliminar tu cuenta) u <strong>Oponerte</strong> a un uso específico. Para eliminar tu cuenta puedes usar el formulario de esta misma página — no necesitas escribirnos para eso.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-2">6. Cambios a este aviso</h2>
          <p className="leading-relaxed">
            Si cambiamos este aviso de forma importante, lo publicaremos aquí con una nueva fecha de actualización.
          </p>
        </section>
      </div>

      {/* Sidebar — solo decorativa (mascota), sticky para que acompañe el
          scroll del contenido largo sin quedar huérfana arriba. Oculta en
          móvil (no hay ancho para un tercer riel). */}
      <div className="hidden lg:block lg:col-span-1">
        <div className="sticky top-24 bg-brand-pale rounded-2xl shadow-sm p-6 text-center">
          <Image
            src="/images/icons/terms-mascota.webp"
            alt=""
            width={180}
            height={217}
            className="mx-auto"
          />
          <p className="text-sm text-gray-600 mt-2">
            Aquí no hay letra chica — este aviso dice exactamente lo que recolectamos y para qué.
          </p>
        </div>
      </div>
      </div>

      {/* Eliminar cuenta */}
      <div className="mt-12 pt-10 border-t border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 size={20} className="text-red-500" />
          <h2 className="text-xl font-heading font-bold text-gray-900">Eliminar mi cuenta</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Ejerce tu derecho de cancelación directamente desde aquí.
        </p>
        <EliminarCuentaSection />
      </div>
    </div>
  );
}
