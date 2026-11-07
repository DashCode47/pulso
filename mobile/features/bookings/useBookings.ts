import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as backend from '../../services/backend';
import * as analytics from '../../lib/analytics';

export type { ClassWithBikes, Bike } from '../../services/backend';
export { groupClassesByDay, groupClassesByWeekday } from './groupByDay';

export function useUpcomingClasses() {
  // ponytail: polling instead of realtime -- keeps bike availability roughly
  // fresh; switch to a Supabase realtime channel if collisions stay common.
  return useQuery({ queryKey: ['classes', 'upcoming'], queryFn: backend.listUpcomingClasses, refetchInterval: 30_000 });
}

// Changes once a week (Sunday publish): a slow poll plus the refetch when the
// app comes back to the foreground is plenty.
export function useSchedulePublishedUntil() {
  return useQuery({ queryKey: ['classes', 'publishedUntil'], queryFn: backend.getSchedulePublishedUntil, refetchInterval: 5 * 60_000 });
}

// Same key as the profile screen, so both share one cache entry.
export function useMyMembership() {
  return useQuery({ queryKey: ['my-membership'], queryFn: backend.getMyMembership });
}

export function useBookingActions() {
  const queryClient = useQueryClient();

  // Refetch after errors too: a failed booking usually means our view of the
  // class is stale (someone else took the bike / the spot).
  // Class details for analytics, from the list the member is looking at.
  function classProps(classId: string): analytics.EventProperties {
    const c = queryClient.getQueryData<backend.ClassWithBikes[]>(['classes', 'upcoming'])?.find((x) => x.id === classId);
    if (!c) return { class_id: classId };
    const startsAt = new Date(c.startsAt);
    return {
      class_id: classId,
      class_title: c.title,
      instructor: c.instructorName,
      hours_before_class: Math.round((startsAt.getTime() - Date.now()) / 360_000) / 10,
    };
  }

  async function run(
    action: Promise<{ error: { message: string } | null }>,
    event: string,
    props: analytics.EventProperties,
  ) {
    const { error } = await action;
    if (error) console.warn('[bookings]', error.message);
    analytics.track(error ? 'Booking Action Failed' : event, error ? { ...props, action: event, error: error.message } : props);
    // Credits and "Mis reservas" (profile) change too, not just the class list.
    await Promise.all(
      [['classes'], ['my-membership'], ['my-history']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
    return { error };
  }

  return {
    book: (classId: string, bikeId: string) => run(backend.bookClass(classId, bikeId), 'Class Booked', classProps(classId)),
    cancel: (reservationId: string) => run(backend.cancelReservation(reservationId), 'Booking Cancelled', {}),
    joinWaitlist: (classId: string) => run(backend.joinWaitlist(classId), 'Waitlist Joined', classProps(classId)),
    leaveWaitlist: (entryId: string) => run(backend.leaveWaitlist(entryId), 'Waitlist Left', {}),
  };
}
