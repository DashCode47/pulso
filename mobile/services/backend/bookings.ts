import { backend } from './client';

export type Bike = { id: string; label: string; taken: boolean };

export type ClassWithBikes = {
  id: string;
  title: string;
  trainerName: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  bikes: Bike[];
  bookedBikeId: string | null;
};

// One day's worth of classes, grouped for the day-pill UI.
export async function listUpcomingClasses(): Promise<ClassWithBikes[]> {
  const { data: classes, error: classesError } = await backend
    .from('classes')
    .select('id, title, trainer_name, starts_at, duration_minutes, capacity')
    .eq('status', 'scheduled')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at');
  if (classesError) throw classesError;
  if (!classes?.length) return [];

  const { data: bikes, error: bikesError } = await backend.from('bikes').select('id, label').eq('active', true);
  if (bikesError) throw bikesError;

  const classIds = classes.map((c) => c.id);
  const {
    data: { user },
  } = await backend.auth.getUser();
  const { data: reservations, error: reservationsError } = await backend
    .from('reservations')
    .select('id, class_id, bike_id, user_id')
    .in('class_id', classIds)
    .eq('status', 'booked');
  if (reservationsError) throw reservationsError;

  return classes.map((c) => {
    const classReservations = reservations?.filter((r) => r.class_id === c.id) ?? [];
    const takenBikeIds = new Set(classReservations.map((r) => r.bike_id));
    const mine = classReservations.find((r) => r.user_id === user?.id);
    return {
      id: c.id,
      title: c.title,
      trainerName: c.trainer_name,
      startsAt: c.starts_at,
      durationMinutes: c.duration_minutes,
      capacity: c.capacity,
      bookedCount: classReservations.length,
      bikes: (bikes ?? []).map((b) => ({ id: b.id, label: b.label, taken: takenBikeIds.has(b.id) })),
      bookedBikeId: mine?.bike_id ?? null,
    };
  });
}

// Errors are Postgres RAISE EXCEPTION messages from book_class/cancel_reservation
// (e.g. "insufficient_credits", "bike_or_class_unavailable") -- surfaced as-is.
export async function bookClass(classId: string, bikeId: string) {
  const { error } = await backend.rpc('book_class', { p_class_id: classId, p_bike_id: bikeId });
  return { error };
}

export async function cancelReservation(reservationId: string) {
  const { error } = await backend.rpc('cancel_reservation', { p_reservation_id: reservationId });
  return { error };
}

// bookings.tsx cancels by classId (mirrors the mock UI's shape); look up the
// user's active reservation id for that class first.
export async function cancelReservationForClass(classId: string) {
  const {
    data: { user },
  } = await backend.auth.getUser();
  const { data, error } = await backend
    .from('reservations')
    .select('id')
    .eq('class_id', classId)
    .eq('user_id', user?.id ?? '')
    .eq('status', 'booked')
    .maybeSingle();
  if (error) return { error };
  if (!data) return { error: null };
  return cancelReservation(data.id);
}
