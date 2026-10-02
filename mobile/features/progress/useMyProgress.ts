import { useQuery } from '@tanstack/react-query';
import { getMyProgress } from '../../services/backend';
import { useAuthStore } from '../auth/store';
import { bogotaDate, bogotaInstant, mondayOf } from '../schedule/week';

// xp_to_level() in the backend: flat 500 XP per level.
export const XP_PER_LEVEL = 500;

// La racha la evalúa update_weekly_streaks() cada lunes 00:05 (Bogotá), así
// que el texto aclara que cumplir la meta hoy se refleja en la racha el lunes.
export function weeklyGoalHint(completed: number, goal: number) {
  const left = goal - completed;
  if (left <= 0) return '¡Meta cumplida! Tu racha sube el lunes.';
  return `Te ${left === 1 ? 'falta 1 clase' : `faltan ${left} clases`} para sumar una semana a tu racha.`;
}

// Shared by Home and Progress (same cache entry).
export function useMyProgress() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['my-progress', userId],
    enabled: !!userId,
    queryFn: () => getMyProgress(userId!, bogotaInstant(mondayOf(bogotaDate(new Date()))).toISOString()),
  });
}
