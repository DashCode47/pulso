import { backend } from './client';

export type MyMembership = {
  planName: string;
  creditsBalance: number;
  creditsPerCycle: number;
  cycleEnd: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
};

// RLS grants a user select on their own membership/user_stats row
// ("read own membership" / "read own stats") -- no RPC needed.
export async function getMyMembership(): Promise<MyMembership | null> {
  const {
    data: { user },
  } = await backend.auth.getUser();
  if (!user) return null;

  const { data: membership, error: membershipError } = await backend
    .from('memberships')
    .select('plan_name, credits_per_cycle, cycle_end, status')
    .eq('user_id', user.id)
    .order('cycle_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return null;

  const { data: stats, error: statsError } = await backend
    .from('user_stats')
    .select('credits_balance')
    .eq('user_id', user.id)
    .maybeSingle();
  if (statsError) throw statsError;

  return {
    planName: membership.plan_name,
    creditsBalance: stats?.credits_balance ?? 0,
    creditsPerCycle: membership.credits_per_cycle,
    cycleEnd: membership.cycle_end,
    status: membership.status,
  };
}

export type MyHistoryEntry = {
  id: string;
  classTitle: string;
  startsAt: string;
  status: 'booked' | 'cancelled' | 'attended' | 'no_show';
};

export async function listMyHistory(): Promise<MyHistoryEntry[]> {
  const {
    data: { user },
  } = await backend.auth.getUser();
  if (!user) return [];

  const { data: reservations, error } = await backend
    .from('reservations')
    .select('id, class_id, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  if (!reservations?.length) return [];

  const classIds = [...new Set(reservations.map((r) => r.class_id))];
  const { data: classes, error: classesError } = await backend.from('classes').select('id, title, starts_at').in('id', classIds);
  if (classesError) throw classesError;
  const classById = new Map((classes ?? []).map((c) => [c.id, c]));

  return reservations.map((r) => ({
    id: r.id,
    classTitle: classById.get(r.class_id)?.title ?? 'Clase eliminada',
    startsAt: classById.get(r.class_id)?.starts_at ?? '',
    status: r.status,
  }));
}
