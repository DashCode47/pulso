// Maps Postgres RAISE EXCEPTION messages from the booking/waitlist RPCs
// (see supabase/migrations) to user-facing Spanish text. Shared by any screen
// that lets a member book or cancel (bookings tab, profile "Mis reservas").
export const BOOK_ERROR_MESSAGES: Record<string, string> = {
  no_active_membership: 'No tienes una membresía activa.',
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

export const WAITLIST_ERROR_MESSAGES: Record<string, string> = {
  no_active_membership: 'No tienes una membresía activa.',
  class_not_available: 'Esta clase ya no está disponible.',
  waitlist_closed: 'La lista de espera ya cerró para esta clase.',
  already_booked: 'Ya tienes una reserva en esta clase.',
  already_on_waitlist: 'Ya estás en la lista de espera.',
  waitlist_entry_not_found: 'Ya no estás en la lista de espera.',
};
