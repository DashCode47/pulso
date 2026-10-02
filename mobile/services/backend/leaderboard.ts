import { backend } from './client';

export type LeaderboardEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  xp: number;
  rank: number;
};

// View `leaderboard` (migrations/*general-leaderboard.sql): all-time total XP,
// active members with XP only, already ranked (ties share the rank).
// ponytail: fetches every ranked member (60-80 rows) so the user's own rank is
// always there; add a limit + a "my rank" query if the studio grows into the thousands.
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await backend
    .from('leaderboard')
    .select('user_id, full_name, avatar_url, xp, rank')
    .order('rank')
    .order('full_name');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    name: r.full_name,
    avatarUrl: r.avatar_url,
    xp: r.xp,
    rank: r.rank,
  }));
}
