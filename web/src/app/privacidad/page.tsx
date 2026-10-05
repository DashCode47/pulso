import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Política de privacidad · Pulso' };

// ponytail: placeholder, cámbialo por el correo real de soporte antes de publicar en la tienda
const CONTACT_EMAIL = 'soporte@pulso.ec';
const UPDATED = '1 de octubre de 2026';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-12">
      <article className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed text-ink-soft [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <header>
          <h1 className="text-2xl font-semibold text-ink">Política de privacidad</h1>
          <p className="mt-1 text-xs">Última actualización: {UPDATED}</p>
        </header>

        <p>
          Esta política explica qué datos recopila la aplicación Pulso, cómo los usamos y qué derechos tienes sobre ellos.
        </p>

        <h2>Datos que recopilamos</h2>
        <ul>
          <li><strong>Cuenta:</strong> correo electrónico y contraseña (almacenada cifrada) para iniciar sesión.</li>
          <li><strong>Perfil:</strong> nombre y, si decides subirla, tu foto de perfil.</li>
          <li><strong>Actividad en el gimnasio:</strong> membresía, reservas de clases, asistencia y estadísticas de progreso.</li>
          <li><strong>Notificaciones:</strong> un identificador de dispositivo para enviarte notificaciones push.</li>
        </ul>

        <h2>Permisos del dispositivo</h2>
        <ul>
          <li><strong>Fotos:</strong> solo para elegir tu foto de perfil de la galería, cuando tú lo solicitas.</li>
          <li><strong>Notificaciones:</strong> para avisos de clases, reservas y novedades del gimnasio.</li>
        </ul>
        <p>No accedemos a tu cámara, micrófono, ubicación ni contactos.</p>

        <h2>Cómo usamos tus datos</h2>
        <ul>
          <li>Gestionar tu cuenta, membresía y reservas.</li>
          <li>Mostrarte tu progreso y la tabla de clasificación del gimnasio.</li>
          <li>Enviarte notificaciones relacionadas con el servicio.</li>
        </ul>
        <p>No vendemos tus datos ni los usamos para publicidad.</p>

        <h2>Dónde se almacenan</h2>
        <p>
          Los datos se guardan en Supabase, nuestro proveedor de base de datos y almacenamiento, y las notificaciones se
          envían a través de Expo y Firebase Cloud Messaging. Estos proveedores solo procesan los datos para prestar el
          servicio. Toda la comunicación viaja cifrada (HTTPS).
        </p>

        <h2>Conservación y eliminación</h2>
        <p>
          Conservamos tus datos mientras tu cuenta esté activa. Puedes solicitar la eliminación de tu cuenta y de todos
          tus datos escribiendo a <a className="text-ink underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
          la atenderemos en un plazo máximo de 30 días.
        </p>

        <h2>Tus derechos</h2>
        <p>
          Puedes acceder, corregir o eliminar tus datos personales, así como oponerte a su tratamiento, conforme a la Ley
          Orgánica de Protección de Datos Personales del Ecuador.
        </p>

        <h2>Menores de edad</h2>
        <p>Pulso no está dirigida a menores de 13 años ni recopila conscientemente sus datos.</p>

        <h2>Contacto</h2>
        <p>
          Si tienes dudas sobre esta política, escríbenos a{' '}
          <a className="text-ink underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
    </main>
  );
}
