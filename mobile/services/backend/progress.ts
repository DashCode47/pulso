import { backend } from './client';

export type AchievementIcon =
  | 'trophy' | 'medal' | 'bicycle' | 'fire' | 'flag' | 'lightning'
  | 'sun' | 'moon' | 'ranking' | 'users' | 'calendar' | 'clock';

export type MyAchievement = {
  id: string;
  name: string;
  description: string;
  xpReward: number;
  icon: AchievementIcon;
  unlocked: boolean;
  startsOn: string | null; // YYYY-MM-DD (Bogota); null = counts all history
  endsOn: string | null; // YYYY-MM-DD (Bogota); null = no end
  // Progress toward the card, computed by the backend with the same rules
  // that unlock it. null = no bar (ranking cards: progress is a rank).
  progress: { current: number; target: number } | null;
};

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

type AchievementRow = {
  id: string;
  name: string;
  description: string;
  xp_reward: number;
  icon: AchievementIcon;
  rule: string;
  starts_on: string | null;
  ends_on: string | null;
  unlocked: boolean;
  progress: number | null;
  threshold: number;
};

// Everything Home and Progress show, in one round of parallel reads. RLS
// scopes stats, reservations, XP and unlocks to the user's own rows.
// weekStart: Monday 00:00 Bogota as an ISO instant.
export async function getMyProgress(userId: string, weekStart: string): Promise<MyProgress> {
  const [stats, membership, weekly, weekXp, ranked, cards] = await Promise.all([
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
    backend.rpc('my_achievements'),
  ]);
  const error = [stats, membership, weekly, weekXp, ranked, cards].find((r) => r.error)?.error;
  if (error) throw error;

  const achievements: MyAchievement[] = ((cards.data ?? []) as AchievementRow[])
    .map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      xpReward: a.xp_reward,
      icon: a.icon,
      unlocked: a.unlocked,
      startsOn: a.starts_on,
      endsOn: a.ends_on,
      progress:
        a.rule === 'leaderboard_top' || a.progress == null
          ? null
          : { current: Math.min(a.progress, a.threshold), target: a.threshold },
    }))
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked)); // stable: unlocked first, then by name (RPC order)

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
