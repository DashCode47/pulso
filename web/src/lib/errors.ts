// Turns Supabase/Postgres/network errors into Spanish copy an admin can act on.
// DB functions raise snake_case codes (`raise exception 'negative_balance'`),
// which arrive as the error message.
const messages: Record<string, string> = {
  cycle_already_over: 'Con esa fecha de inicio la membresía ya habría vencido.',
  negative_balance: 'El saldo no puede quedar negativo.',
  achievement_locked: 'Este logro ya fue desbloqueado y no se puede editar.',
  achievement_deleted: 'Este logro fue eliminado.',
  class_not_found: 'La clase ya no existe. Recarga la página.',
  class_already_started: 'La clase ya empezó y no se puede modificar.',
  title_and_body_required: 'El título y el mensaje son obligatorios.',
  no_active_membership: 'El miembro no tiene una membresía activa.',
  membership_not_valid_for_class: 'La membresía del miembro vence antes de esa clase.',
  insufficient_credits: 'El miembro no tiene créditos.',
  class_not_available: 'La clase está llena o ya no está disponible.',
  bike_or_class_unavailable: 'Esa bici ya fue tomada o el miembro ya está inscrito en esta clase.',
  reservation_not_markable: 'Esa reserva ya no se puede marcar.',
  not_authorized: 'Tu cuenta no tiene permisos para esta acción.',
  not_authenticated: 'Tu sesión expiró. Vuelve a ingresar.',
  // Postgres SQLSTATE codes
  '23505': 'Ya existe un registro igual.',
  '23503': 'No se puede: hay otros datos que dependen de este registro.',
  '23514': 'Alguno de los valores no es válido.',
  '42501': 'Tu cuenta no tiene permisos para esta acción.',
  PGRST301: 'Tu sesión expiró. Vuelve a ingresar.',
};

export function describeError(e: unknown, fallback = 'Algo salió mal. Intenta de nuevo.') {
  const { message = '', code = '' } = (e ?? {}) as { message?: string; code?: string };
  if (messages[message]) return messages[message];
  if (messages[code]) return messages[code];
  if (/failed to fetch|network/i.test(message)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  if (/jwt expired/i.test(message)) return messages.not_authenticated;
  console.error(e);
  return fallback;
}
