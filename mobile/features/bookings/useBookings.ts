import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as backend from '../../services/backend';
import { scheduleStatus } from './scheduleStatus';

export type { ClassWithBikes, Bike } from '../../services/backend';
export { groupClassesByDay, groupClassesByWeekday } from './groupByDay';
export * from './scheduleStatus';

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

// Whether there's anything to book right now, or why not (see scheduleStatus).
export function useScheduleStatus() {
  const { data: classes } = useUpcomingClasses();
  const { data: publishedUntil } = useSchedulePublishedUntil();
  return scheduleStatus(classes ?? [], classes && publishedUntil);
}

// Same key as the profile screen, so both share one cache entry.
export function useMyMembership() {
  return useQuery({ queryKey: ['my-membership'], queryFn: backend.getMyMembership });
}

export function useBookingActions() {
  const queryClient = useQueryClient();

  // Refetch after errors too: a failed booking usually means our view of the
  // class is stale (someone else took the bike / the spot).
  async function run(action: Promise<{ error: { message: string } | null }>) {
    const { error } = await action;
    if (error) console.warn('[bookings]', error.message);
    // Credits and "Mis reservas" (profile) change too, not just the class list.
    await Promise.all(
      [['classes'], ['my-membership'], ['my-history']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
    return { error };
  }

  return {
    book: (classId: string, bikeId: string) => run(backend.bookClass(classId, bikeId)),
    cancel: (reservationId: string) => run(backend.cancelReservation(reservationId)),
    joinWaitlist: (classId: string) => run(backend.joinWaitlist(classId)),
    leaveWaitlist: (entryId: string) => run(backend.leaveWaitlist(entryId)),
  };
}
