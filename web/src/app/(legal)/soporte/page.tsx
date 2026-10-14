import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Soporte · Pulso' };

export default function SupportPage() {
  return (
    <>
      <header>
        <h1>Soporte</h1>
        <p className="mt-1">¿Necesitas ayuda con la app Pulso? Estamos para ayudarte.</p>
      </header>

      <h2>Contacto</h2>
      <p>
        Escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> indicando el correo de tu cuenta y una
        descripción del problema. Respondemos en un plazo de 1 a 2 días hábiles. También puedes acercarte a recepción
        en el estudio.
      </p>

      <h2>Preguntas frecuentes</h2>

      <h3 className="font-semibold text-ink">¿Cómo obtengo una membresía?</h3>
      <p>Las membresías se adquieren en el estudio. Una vez activada, verás tus créditos en la app.</p>

      <h3 className="font-semibold text-ink">¿Cómo reservo una clase?</h3>
      <p>En la pestaña de reservas elige la clase y tu bici. Cada reserva usa 1 crédito de tu membresía.</p>

      <h3 className="font-semibold text-ink">¿Puedo cancelar una reserva?</h3>
      <p>
        Sí, hasta el plazo que muestra cada clase (por defecto 12 horas antes). Al cancelar a tiempo recuperas el
        crédito. Pasado ese plazo la reserva ya no se puede cancelar.
      </p>

      <h3 className="font-semibold text-ink">¿Cómo funciona la lista de espera?</h3>
      <p>
        Si la clase está llena puedes unirte a la lista de espera. Si alguien cancela, te reservamos la bici
        automáticamente (si tienes créditos) y te avisamos con una notificación.
      </p>

      <h3 className="font-semibold text-ink">Olvidé mi contraseña</h3>
      <p>Escríbenos desde el correo de tu cuenta y te ayudamos a restablecerla.</p>

      <h3 className="font-semibold text-ink">No me llegan las notificaciones</h3>
      <p>Revisa que las notificaciones de Pulso estén permitidas en los ajustes de tu teléfono.</p>

      <h3 className="font-semibold text-ink">¿Cómo elimino mi cuenta?</h3>
      <p>
        Sigue los pasos en <Link href="/eliminar-cuenta">Eliminar cuenta</Link>.
      </p>
    </>
  );
}
