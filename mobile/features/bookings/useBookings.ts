import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as backend from '../../services/backend';

export type { ClassWithBikes, Bike } from '../../services/backend';
export { groupClassesByDay } from './groupByDay';

export function useUpcomingClasses() {
  // ponytail: polling instead of realtime -- keeps bike availability roughly
  // fresh; switch to a Supabase realtime channel if collisions stay common.
  return useQuery({ queryKey: ['classes', 'upcoming'], queryFn: backend.listUpcomingClasses, refetchInterval: 30_000 });
}

export function useBookingActions() {
  const queryClient = useQueryClient();

  // Refetch after errors too: a failed booking usually means our view of the
  // class is stale (someone else took the bike / the spot).
  async function run(action: Promise<{ error: { message: string } | null }>) {
    const { error } = await action;
    if (error) console.warn('[bookings]', error.message);
    await queryClient.invalidateQueries({ queryKey: ['classes', 'upcoming'] });
    return { error };
  }

  return {
    book: (classId: string, bikeId: string) => run(backend.bookClass(classId, bikeId)),
    cancel: (reservationId: string) => run(backend.cancelReservation(reservationId)),
    joinWaitlist: (classId: string) => run(backend.joinWaitlist(classId)),
    leaveWaitlist: (entryId: string) => run(backend.leaveWaitlist(entryId)),
  };
}
