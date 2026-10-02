// Maps Postgres RAISE EXCEPTION messages from the booking/waitlist RPCs
// (see supabase/migrations) to user-facing Spanish text. Shared by any screen
// that lets a member book or cancel (bookings tab, profile "Mis reservas").
export const BOOK_ERROR_MESSAGES: Record<string, string> = {
  no_active_membership: 'No tienes una membresía activa.',
  membership_not_valid_for_class: 'Tu membresía no cubre la fecha de esta clase.',
  class_not_available: 'La clase se llenó o ya no está disponible.',
  class_already_started: 'Esta clase ya comenzó.',
  insufficient_credits: 'No te quedan créditos.',
  bike_or_class_unavailable: 'Alguien más tomó esa bici justo antes que tú. Elige otra.',
};

export const CANCEL_ERROR_MESSAGES: Record<string, string> = {
  reservation_not_found: 'No se encontró la reserva.',
  reservation_not_active: 'Esta reserva ya no está activa.',
  cancellation_window_closed: 'Ya pasó el plazo para cancelar esta clase.',
};

// Mirrors book_class()/join_waitlist()'s gate (status 'active' and cycle_end
// not passed) so screens can say why up front instead of failing on tap.
// Returns null when the member can book; undefined = still loading, don't block.
export function membershipBlockMessage(
  membership: { status: string; cycleEnd: string } | null | undefined,
  today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), // YYYY-MM-DD, studio date
): string | null {
  if (membership === undefined) return null;
  if (!membership) return 'No tienes una membresía activa. Acércate a recepción para activarla.';
  if (membership.status === 'cancelled') return 'Tu membresía fue cancelada. Acércate a recepción para activar una nueva.';
  if (membership.status === 'expired' || membership.cycleEnd < today) {
    // cycle_end is a plain date: parse as local midnight, not UTC.
    const day = new Date(membership.cycleEnd + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' });
    return `Tu membresía venció el ${day}. Renuévala en recepción para seguir reservando.`;
  }
  return null;
}

export const WAITLIST_ERROR_MESSAGES: Record<string, string> = {
  no_active_membership: 'No tienes una membresía activa.',
  membership_not_valid_for_class: 'Tu membresía no cubre la fecha de esta clase.',
  class_not_available: 'Esta clase ya no está disponible.',
  waitlist_closed: 'La lista de espera ya cerró para esta clase.',
  already_booked: 'Ya tienes una reserva en esta clase.',
  already_on_waitlist: 'Ya estás en la lista de espera.',
  waitlist_entry_not_found: 'Ya no estás en la lista de espera.',
};
