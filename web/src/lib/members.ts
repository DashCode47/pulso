import { createClient } from '@/lib/supabase/client';

export type MembershipStatus = 'active' | 'paused' | 'cancelled' | 'expired';

export type Member = {
  userId: string;
  fullName: string;
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
  cycleEnd: string;
};

// RLS grants admins full read/write on memberships (see access-control.sql).
// Fetches the most recent membership regardless of status, so an
// expired/paused/cancelled one can still be viewed and renewed/reactivated.
export async function getLatestMembership(userId: string): Promise<Membership | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('memberships')
    .select('id, plan_name, credits_per_cycle, weekly_goal, status, cycle_end')
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
    cycleEnd: data.cycle_end,
  };
}

export type MembershipInput = { planName: string; creditsPerCycle: number; weeklyGoal: number };

// Grants the first cycle's credits immediately and sets cycle_end to 1 month
// out (see admin_create_membership() in the DB).
export async function createMembership(userId: string, input: MembershipInput) {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_create_membership', {
    p_user_id: userId,
    p_plan_name: input.planName,
    p_credits_per_cycle: input.creditsPerCycle,
    p_weekly_goal: input.weeklyGoal,
  });
  return { error };
}

export async function updateMembership(membershipId: string, input: MembershipInput) {
  const supabase = createClient();
  const { error } = await supabase
    .from('memberships')
    .update({ plan_name: input.planName, credits_per_cycle: input.creditsPerCycle, weekly_goal: input.weeklyGoal })
    .eq('id', membershipId);
  return { error };
}

export async function setMembershipStatus(membershipId: string, status: 'active' | 'paused' | 'cancelled') {
  const supabase = createClient();
  const { error } = await supabase.from('memberships').update({ status }).eq('id', membershipId);
  return { error };
}

// Ledger insert via RPC -- credits_balance is derived from credit_transactions,
// never written directly (see admin_adjust_credits() in business-logic.sql).
export async function adjustCredits(userId: string, amount: number, note: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_adjust_credits', { p_user_id: userId, p_amount: amount, p_note: note || null });
  return { error };
}

// Renews credits AND extends cycle_end by 1 month for one or more members at
// once (reactivates an expired membership too) -- there is no automatic
// monthly grant anymore, the admin is the one who knows who actually
// renewed/paid.
export async function grantCreditsBulk(userIds: string[]) {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_grant_credits_bulk', { p_user_ids: userIds });
  return { error };
}
