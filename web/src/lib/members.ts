import { createClient } from '@/lib/supabase/client';
import { firstEmbed } from '@/lib/supabaseEmbed';

export type MembershipStatus = 'active' | 'expired' | 'cancelled';

export type Member = {
  userId: string;
  fullName: string;
  email: string;
  creditsBalance: number;
  membershipStatus: MembershipStatus | null;
  cycleStart: string | null;
  cycleEnd: string | null;
};

// search_members() excludes admins server-side (no role column to filter on
// client-side) -- see supabase/migrations/20260826210000_search-members.sql.
type SearchMembersRow = {
  user_id: string;
  full_name: string;
  email: string | null;
  credits_balance: number;
  membership_status: MembershipStatus | null;
  cycle_start: string | null;
  cycle_end: string | null;
};

export async function searchMembers(query: string): Promise<Member[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('search_members', { p_query: query });
  if (error) throw error;
  return ((data ?? []) as SearchMembersRow[]).map((m) => ({
    userId: m.user_id,
    fullName: m.full_name,
    email: m.email ?? '',
    creditsBalance: m.credits_balance,
    membershipStatus: m.membership_status,
    cycleStart: m.cycle_start,
    cycleEnd: m.cycle_end,
  }));
}

export type Membership = {
  id: string;
  planName: string;
  creditsPerCycle: number;
  weeklyGoal: number;
  status: MembershipStatus;
  cycleStart: string;
  cycleEnd: string;
};

// RLS grants admins full read/write on memberships (see access-control.sql).
// Fetches the most recent membership regardless of status, so an
// expired/cancelled one can still be viewed and renewed/reactivated.
export async function getLatestMembership(userId: string): Promise<Membership | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('memberships')
    .select('id, plan_name, credits_per_cycle, weekly_goal, status, cycle_start, cycle_end')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    planName: data.plan_name,
    creditsPerCycle: data.credits_per_cycle,
    weeklyGoal: data.weekly_goal,
    status: data.status,
    cycleStart: data.cycle_start,
    cycleEnd: data.cycle_end,
  };
}

// cycleStart is YYYY-MM-DD; cycle_end is derived from it by a DB trigger (+1 month).
export type MembershipInput = { planName: string; creditsPerCycle: number; weeklyGoal: number; cycleStart: string };

// Grants the first cycle's credits immediately and sets cycle_end to 1 month
// out (see admin_create_membership() in the DB).
export async function createMembership(userId: string, input: MembershipInput) {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_create_membership', {
    p_user_id: userId,
    p_plan_name: input.planName,
    p_credits_per_cycle: input.creditsPerCycle,
    p_weekly_goal: input.weeklyGoal,
    p_cycle_start: input.cycleStart,
  });
  return { error };
}

export async function updateMembership(membershipId: string, input: MembershipInput) {
  const supabase = createClient();
  const { error } = await supabase
    .from('memberships')
    .update({ plan_name: input.planName, credits_per_cycle: input.creditsPerCycle, weekly_goal: input.weeklyGoal, cycle_start: input.cycleStart })
    .eq('id', membershipId);
  return { error };
}

// Also cancels the member's future bookings and zeroes their credits (see
// admin_cancel_membership() in the DB).
export async function cancelMembership(membershipId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_cancel_membership', { p_membership_id: membershipId });
  return { error };
}

// Ledger insert via RPC -- credits_balance is derived from credit_transactions,
// never written directly (see admin_adjust_credits() in business-logic.sql).
export async function adjustCredits(userId: string, amount: number, note: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_adjust_credits', { p_user_id: userId, p_amount: amount, p_note: note || null });
  return { error };
}

// Resets credits to the plan's amount (leftovers don't roll over) AND restarts
// the cycle at cycleStart (default today) for one or more members at
// once (reactivates an expired membership too) -- there is no automatic
// monthly grant anymore, the admin is the one who knows who actually
// renewed/paid.
export async function grantCreditsBulk(userIds: string[], cycleStart?: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_grant_credits_bulk', { p_user_ids: userIds, p_cycle_start: cycleStart });
  return { error };
}

export type CreditTransaction = {
  id: string;
  amount: number;
  type: 'grant' | 'booking' | 'cancel_refund' | 'no_show_penalty' | 'admin_adjustment';
  note: string | null;
  createdAt: string;
};

// The ledger credits_balance is derived from -- newest first.
export async function listCreditHistory(userId: string, limit = 50): Promise<CreditTransaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('id, amount, type, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, amount: t.amount, type: t.type, note: t.note, createdAt: t.created_at }));
}

export type MemberBooking = {
  reservationId: string;
  status: 'booked' | 'cancelled' | 'attended' | 'no_show';
  classTitle: string;
  startsAt: string;
};

export type MemberActivity = {
  classesCompleted: number;
  currentStreakWeeks: number;
  level: number;
  noShows: number; // in the loaded window
  upcoming: MemberBooking[];
  recent: MemberBooking[];
};

export async function getMemberActivity(userId: string): Promise<MemberActivity> {
  const supabase = createClient();
  const [{ data: stats, error: statsError }, { data: reservations, error: resError }] = await Promise.all([
    supabase.from('user_stats').select('classes_completed, current_streak_weeks, current_level').eq('user_id', userId).maybeSingle(),
    supabase
      .from('reservations')
      .select('id, status, classes(title, starts_at)')
      .eq('user_id', userId)
      .order('booked_at', { ascending: false })
      .limit(60),
  ]);
  if (statsError) throw statsError;
  if (resError) throw resError;

  const now = new Date();
  const bookings: MemberBooking[] = (reservations ?? []).flatMap((r) => {
    const c = firstEmbed(r.classes as { title: string; starts_at: string } | { title: string; starts_at: string }[] | null);
    return c ? [{ reservationId: r.id, status: r.status, classTitle: c.title, startsAt: c.starts_at }] : [];
  });
  const byDate = (a: MemberBooking, b: MemberBooking) => a.startsAt.localeCompare(b.startsAt);
  return {
    classesCompleted: stats?.classes_completed ?? 0,
    currentStreakWeeks: stats?.current_streak_weeks ?? 0,
    level: stats?.current_level ?? 1,
    noShows: bookings.filter((b) => b.status === 'no_show').length,
    upcoming: bookings.filter((b) => b.status === 'booked' && new Date(b.startsAt) > now).sort(byDate),
    recent: bookings
      .filter((b) => new Date(b.startsAt) <= now && b.status !== 'cancelled')
      .sort(byDate)
      .reverse()
      .slice(0, 10),
  };
}
