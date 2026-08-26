import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as backend from '../../services/backend';

export type { ClassWithBikes, Bike } from '../../services/backend';
export { groupClassesByDay } from './groupByDay';

export function useUpcomingClasses() {
  return useQuery({ queryKey: ['classes', 'upcoming'], queryFn: backend.listUpcomingClasses });
}

export function useBookingActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['classes', 'upcoming'] });

  return {
    async book(classId: string, bikeId: string) {
      const { error } = await backend.bookClass(classId, bikeId);
      if (!error) await invalidate();
      return { error };
    },
    async cancel(classId: string) {
      const { error } = await backend.cancelReservationForClass(classId);
      if (!error) await invalidate();
      return { error };
    },
  };
}
