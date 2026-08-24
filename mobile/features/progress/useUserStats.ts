import { useQuery } from '@tanstack/react-query';
import { backend } from '../../services/backend';
import { useAuthStore } from '../auth/store';

export interface UserStats {
  total_xp: number;
  current_level: number;
  current_streak_weeks: number;
  max_streak_weeks: number;
  classes_completed: number;
  credits_balance: number;
}

export function useUserStats() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['user_stats', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await backend.database
        .from('user_stats')
        .select('total_xp, current_level, current_streak_weeks, max_streak_weeks, classes_completed, credits_balance')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return (data as UserStats) ?? null;
    },
  });
}
