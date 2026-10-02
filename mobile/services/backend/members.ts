import { backend } from './client';
import { firstEmbed } from './embed';

export type MemberSummary = {
  userId: string;
  fullName: string;
  creditsBalance: number;
  membershipStatus: string | null;
};

// search_members() excludes admins server-side -- the client can't join
// against `admins` itself, since that table has no policies/grants by design.
type SearchMembersRow = { user_id: string; full_name: string; credits_balance: number; membership_status: string | null };

export async function searchMembers(query: string): Promise<MemberSummary[]> {
  const { data, error } = await backend.rpc('search_members', { p_query: query.trim() });
  if (error) throw error;
  return ((data ?? []) as SearchMembersRow[]).map((m) => ({
    userId: m.user_id,
    fullName: m.full_name,
    creditsBalance: m.credits_balance,
    membershipStatus: m.membership_status,
  }));
}

export type MemberReservation = {
  id: string;
  classTitle: string;
  startsAt: string;
  status: 'booked' | 'cancelled' | 'attended' | 'no_show';
};

export async function listMemberReservations(userId: string): Promise<MemberReservation[]> {
  // One request: the class comes embedded instead of a second lookup.
  const { data, error } = await backend
    .from('reservations')
    .select('id, status, classes(title, starts_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  return (data ?? []).map((r) => {
    const c = firstEmbed(r.classes);
    return { id: r.id, classTitle: c?.title ?? 'Clase eliminada', startsAt: c?.starts_at ?? '', status: r.status };
  });
}

export async function adjustCredits(userId: string, amount: number, note?: string) {
  const { error } = await backend.rpc('admin_adjust_credits', { p_user_id: userId, p_amount: amount, p_note: note ?? null });
  return { error };
}

export async function markNoShow(reservationId: string) {
  const { error } = await backend.rpc('mark_no_show', { p_reservation_id: reservationId });
  return { error };
}
