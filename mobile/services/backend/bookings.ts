import { backend } from './client';

export type Bike = { id: string; label: string; taken: boolean };

export type ClassWithBikes = {
  id: string;
  title: string;
  instructorName: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  bikes: Bike[];
  bookedBikeId: string | null;
  myReservationId: string | null;
  myWaitlistEntryId: string | null;
  myWaitlistPosition: number | null;
  // After this, members can't cancel and the waitlist is closed.
  cancelDeadline: string;
};

type AvailabilityRow = {
  class_id: string;
  taken_bike_ids: string[];
  booked_count: number;
  my_reservation_id: string | null;
  my_bike_id: string | null;
  my_waitlist_entry_id: string | null;
  my_waitlist_position: number | null;
  cancel_deadline: string;
};

// Availability comes from class_availability() (SECURITY DEFINER): RLS only
// lets members read their own reservations, so counting them client-side
// made every bike look free.
export async function listUpcomingClasses(): Promise<ClassWithBikes[]> {
  const [classesRes, bikesRes, availabilityRes] = await Promise.all([
    backend
      .from('classes')
      .select('id, title, instructors(name), starts_at, duration_minutes, capacity')
      .eq('status', 'scheduled')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at'),
    backend.from('bikes').select('id, label').eq('active', true).order('label'),
    backend.rpc('class_availability'),
  ]);
  if (classesRes.error) throw classesRes.error;
  if (bikesRes.error) throw bikesRes.error;
  if (availabilityRes.error) throw availabilityRes.error;

  const availabilityById = new Map(((availabilityRes.data ?? []) as AvailabilityRow[]).map((a) => [a.class_id, a]));

  return (classesRes.data ?? []).flatMap((c) => {
    const a = availabilityById.get(c.id);
    if (!a) return []; // started between the two queries
    const takenBikeIds = new Set(a.taken_bike_ids);
    return [
      {
        id: c.id,
        title: c.title,
        instructorName: c.instructors[0]?.name ?? '',
        startsAt: c.starts_at,
        durationMinutes: c.duration_minutes,
        capacity: c.capacity,
        bookedCount: a.booked_count,
        bikes: (bikesRes.data ?? []).map((b) => ({ id: b.id, label: b.label, taken: takenBikeIds.has(b.id) })),
        bookedBikeId: a.my_bike_id,
        myReservationId: a.my_reservation_id,
        myWaitlistEntryId: a.my_waitlist_entry_id,
        myWaitlistPosition: a.my_waitlist_position,
        cancelDeadline: a.cancel_deadline,
      },
    ];
  });
}

// Errors are Postgres RAISE EXCEPTION messages from the RPCs (e.g.
// "insufficient_credits", "bike_or_class_unavailable") -- mapped to Spanish
// in features/bookings/errorMessages.ts.
export async function bookClass(classId: string, bikeId: string) {
  const { error } = await backend.rpc('book_class', { p_class_id: classId, p_bike_id: bikeId });
  return { error };
}

export async function cancelReservation(reservationId: string) {
  const { error } = await backend.rpc('cancel_reservation', { p_reservation_id: reservationId });
  return { error };
}

export async function joinWaitlist(classId: string) {
  const { error } = await backend.rpc('join_waitlist', { p_class_id: classId });
  return { error };
}

export async function leaveWaitlist(entryId: string) {
  const { error } = await backend.rpc('leave_waitlist', { p_waitlist_entry_id: entryId });
  return { error };
}
