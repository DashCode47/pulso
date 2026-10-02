import { backend } from './client';

export type MyAchievement = { code: string; name: string; description: string; xpReward: number; unlocked: boolean };

export type MyProgress = {
  totalXp: number;
  level: number;
  currentStreakWeeks: number;
  maxStreakWeeks: number;
  classesCompleted: number;
  weeklyGoal: number;
  weeklyCompleted: number;
  weeklyXp: number;
  rank: number | null; // null = not in the ranking yet (no XP)
  achievements: MyAchievement[];
};

// Everything Home and Progress show, in one round of parallel reads. RLS
// scopes stats, reservations, XP and unlocks to the user's own rows.
// weekStart: Monday 00:00 Bogota as an ISO instant.
export async function getMyProgress(userId: string, weekStart: string): Promise<MyProgress> {
  const [stats, membership, weekly, weekXp, ranked, catalog, unlocked] = await Promise.all([
    backend
      .from('user_stats')
      .select('total_xp, current_level, current_streak_weeks, max_streak_weeks, classes_completed')
      .eq('user_id', userId)
      .maybeSingle(),
    backend.from('memberships').select('weekly_goal').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    backend
      .from('reservations')
      .select('id, classes!inner(starts_at)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'attended')
      .gte('classes.starts_at', weekStart),
    backend.from('xp_transactions').select('amount').eq('user_id', userId).gte('created_at', weekStart),
    backend.from('leaderboard').select('rank').eq('user_id', userId).maybeSingle(),
    backend.from('achievements').select('id, code, name, description, xp_reward').order('name'),
    backend.from('user_achievements').select('achievement_id').eq('user_id', userId),
  ]);
  const error = [stats, membership, weekly, weekXp, ranked, catalog, unlocked].find((r) => r.error)?.error;
  if (error) throw error;

  const unlockedIds = new Set((unlocked.data ?? []).map((u) => u.achievement_id));
  const achievements = (catalog.data ?? [])
    .map((a) => ({
      code: a.code,
      name: a.name,
      description: a.description,
      xpReward: a.xp_reward,
      unlocked: unlockedIds.has(a.id),
    }))
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked)); // stable: unlocked first, then by name

  return {
    totalXp: stats.data?.total_xp ?? 0,
    level: stats.data?.current_level ?? 1,
    currentStreakWeeks: stats.data?.current_streak_weeks ?? 0,
    maxStreakWeeks: stats.data?.max_streak_weeks ?? 0,
    classesCompleted: stats.data?.classes_completed ?? 0,
    weeklyGoal: membership.data?.weekly_goal ?? 3,
    weeklyCompleted: weekly.count ?? 0,
    weeklyXp: (weekXp.data ?? []).reduce((sum, x) => sum + x.amount, 0),
    rank: ranked.data?.rank ?? null,
    achievements,
  };
}
