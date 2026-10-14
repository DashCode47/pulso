import type { Metadata } from 'next';
import { CONTACT_EMAIL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Eliminar cuenta · Pulso' };

const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Eliminar mi cuenta de Pulso')}&body=${encodeURIComponent(
  'Hola, quiero eliminar mi cuenta de Pulso y todos mis datos.\n\nCorreo de mi cuenta: ',
)}`;

export default function DeleteAccountPage() {
  return (
    <>
      <header>
        <h1>Eliminar tu cuenta de Pulso</h1>
        <p className="mt-1">Puedes solicitar la eliminación de tu cuenta y de todos tus datos en cualquier momento.</p>
      </header>

      <h2>Cómo solicitarlo</h2>
      <ol>
        <li>
          Escribe a <a href={MAILTO}>{CONTACT_EMAIL}</a> desde el correo con el que te registraste, con el asunto
          “Eliminar mi cuenta de Pulso”.
        </li>
        <li>Confirmaremos que la solicitud viene del titular de la cuenta.</li>
        <li>Eliminamos tu cuenta en un plazo máximo de 30 días y te avisamos por correo.</li>
      </ol>
      <p>
        <a
          href={MAILTO}
          className="inline-block rounded-md bg-accent px-4 py-2 font-medium text-on-accent no-underline!"
        >
          Solicitar eliminación
        </a>
      </p>

      <h2>Qué se elimina</h2>
      <ul>
        <li>Tu cuenta (correo y contraseña) y tu perfil (nombre y foto).</li>
        <li>Tus reservas, lista de espera, historial de asistencia, progreso y logros.</li>
        <li>Tu posición en las tablas de clasificación.</li>
        <li>Los identificadores de dispositivo usados para notificaciones.</li>
      </ul>

      <h2>Qué se conserva</h2>
      <p>
        Solo los registros de pagos o membresías que la ley nos obligue a guardar con fines contables o tributarios, por
        el plazo legal correspondiente. Los informes de errores de la app se borran automáticamente a los 90 días.
      </p>

      <p>
        Eliminar la cuenta no cancela ni reembolsa automáticamente una membresía vigente; si tienes dudas, consúltalo en
        el estudio antes de enviar la solicitud.
      </p>
    </>
  );
}
