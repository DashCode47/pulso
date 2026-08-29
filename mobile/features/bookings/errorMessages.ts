// Maps Postgres RAISE EXCEPTION messages from book_class/cancel_reservation
// (see business-logic.sql) to user-facing Spanish text. Shared by any screen
// that lets a member book or cancel (bookings tab, profile "Mis reservas").
export const BOOK_ERROR_MESSAGES: Record<string, string> = {
  no_active_membership: 'No tienes una membresía activa.',
  class_not_available: 'Esta clase ya no está disponible.',
  class_already_started: 'Esta clase ya comenzó.',
  insufficient_credits: 'No te quedan créditos.',
  bike_or_class_unavailable: 'Alguien más tomó esa bici, elige otra.',
};

export const CANCEL_ERROR_MESSAGES: Record<string, string> = {
  reservation_not_found: 'No se encontró la reserva.',
  reservation_not_active: 'Esta reserva ya no está activa.',
  cancellation_window_closed: 'Ya no se puede cancelar; faltan menos de 2 horas para la clase.',
};
