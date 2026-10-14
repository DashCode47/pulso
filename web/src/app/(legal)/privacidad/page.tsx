import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/legal';

export const metadata: Metadata = { title: 'Política de privacidad · Pulso' };

export default function PrivacyPage() {
  return (
    <>
      <header>
        <h1>Política de privacidad</h1>
        <p className="mt-1 text-xs">Última actualización: {LEGAL_UPDATED}</p>
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
        <li>
          <strong>Diagnóstico:</strong> informes de errores y fallos de la app (modelo de dispositivo, versión del
          sistema y de la app) para corregir problemas. No incluyen tu contenido personal.
        </li>
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
        <li>Mostrarte tu progreso y la tabla de clasificación del gimnasio (con tu nombre y foto de perfil).</li>
        <li>Enviarte notificaciones relacionadas con el servicio.</li>
        <li>Detectar y corregir errores de la app.</li>
      </ul>
      <p>No vendemos tus datos, no los usamos para publicidad ni te rastreamos en otras apps o sitios web.</p>

      <h2>Dónde se almacenan</h2>
      <p>
        Los datos se guardan en Supabase, nuestro proveedor de base de datos y almacenamiento. Las notificaciones se
        envían a través de Expo y Firebase Cloud Messaging, y los informes de errores se procesan con Sentry. Estos
        proveedores solo procesan los datos para prestar el servicio. Toda la comunicación viaja cifrada (HTTPS).
      </p>

      <h2>Conservación y eliminación</h2>
      <p>
        Conservamos tus datos mientras tu cuenta esté activa. Puedes eliminar tu cuenta y todos tus datos siguiendo los
        pasos de <Link href="/eliminar-cuenta">Eliminar cuenta</Link>; la solicitud se atiende en un plazo máximo de 30
        días.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes acceder, corregir o eliminar tus datos personales, así como oponerte a su tratamiento, conforme a la Ley
        Orgánica de Protección de Datos Personales del Ecuador.
      </p>

      <h2>Menores de edad</h2>
      <p>Pulso no está dirigida a menores de 13 años ni recopila conscientemente sus datos.</p>

      <h2>Cambios a esta política</h2>
      <p>Si la modificamos, actualizaremos la fecha de arriba y te avisaremos en la app cuando el cambio sea relevante.</p>

      <h2>Contacto</h2>
      <p>
        Si tienes dudas sobre esta política, escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
