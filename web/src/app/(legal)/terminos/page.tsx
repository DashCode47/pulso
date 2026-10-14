import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/legal';

export const metadata: Metadata = { title: 'Términos y condiciones · Pulso' };

export default function TermsPage() {
  return (
    <>
      <header>
        <h1>Términos y condiciones</h1>
        <p className="mt-1 text-xs">Última actualización: {LEGAL_UPDATED}</p>
      </header>

      <p>
        Al crear una cuenta o usar la aplicación Pulso aceptas estos términos. Si no estás de acuerdo, no uses la app.
      </p>

      <h2>El servicio</h2>
      <p>
        Pulso es la app del estudio para consultar horarios, reservar clases, gestionar tu lista de espera, ver tu
        progreso y recibir novedades. La app es gratuita; las membresías se adquieren directamente en el estudio, no a
        través de la app.
      </p>

      <h2>Tu cuenta</h2>
      <ul>
        <li>Debes tener al menos 13 años y dar información verdadera.</li>
        <li>Eres responsable de mantener tu contraseña segura y de la actividad en tu cuenta.</li>
        <li>La cuenta es personal e intransferible.</li>
      </ul>

      <h2>Membresías y créditos</h2>
      <ul>
        <li>Cada membresía otorga un número de créditos por ciclo; cada reserva usa 1 crédito.</li>
        <li>Los créditos no usados no se acumulan al siguiente ciclo ni son reembolsables, salvo que el estudio indique lo contrario.</li>
        <li>Al vencer o cancelarse la membresía, se pierden los créditos restantes y se liberan tus reservas futuras.</li>
      </ul>

      <h2>Reservas y cancelaciones</h2>
      <ul>
        <li>Puedes cancelar una reserva hasta el plazo indicado en cada clase (por defecto 12 horas antes) y recuperar el crédito.</li>
        <li>Pasado ese plazo la reserva no se puede cancelar y el crédito se considera usado, asistas o no.</li>
        <li>Si te unes a la lista de espera y se libera un cupo, la reserva se hace automáticamente y se descuenta un crédito.</li>
        <li>El estudio puede cancelar o reprogramar clases; en ese caso se te devuelve el crédito y se te notifica.</li>
      </ul>

      <h2>Uso aceptable</h2>
      <p>
        No uses la app para fines ilegales, no intentes acceder a cuentas ajenas, no interfieras con su funcionamiento y
        no subas fotos de perfil ofensivas o que no te pertenezcan. Podemos suspender cuentas que incumplan estos
        términos.
      </p>

      <h2>Salud y responsabilidad</h2>
      <p>
        La actividad física implica riesgos. Consulta a un médico antes de empezar y sigue las indicaciones de los
        instructores. Las estadísticas y logros de la app son informativos y no constituyen consejo médico.
      </p>

      <h2>Disponibilidad</h2>
      <p>
        Procuramos que la app funcione sin interrupciones, pero puede haber fallos o mantenimientos. La app se ofrece
        “tal cual”, en la medida permitida por la ley.
      </p>

      <h2>Privacidad</h2>
      <p>
        El tratamiento de tus datos se describe en nuestra <Link href="/privacidad">Política de privacidad</Link>.
        Puedes <Link href="/eliminar-cuenta">eliminar tu cuenta</Link> cuando quieras.
      </p>

      <h2>Tiendas de aplicaciones</h2>
      <p>
        Estos términos son entre tú y Pulso, no con Apple ni Google, que no son responsables de la app ni de su
        soporte. Si descargaste la app desde el App Store, también aplica el{' '}
        <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Contrato de licencia de usuario final estándar de Apple</a>.
      </p>

      <h2>Cambios</h2>
      <p>Podemos actualizar estos términos; si el cambio es relevante te avisaremos en la app.</p>

      <h2>Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República del Ecuador.</p>

      <h2>Contacto</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </>
  );
}
