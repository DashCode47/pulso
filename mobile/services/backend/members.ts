import { backend } from './client';

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
  const { data: reservations, error } = await backend
    .from('reservations')
    .select('id, class_id, status')
    .eq('user_id', userId)
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

export async function adjustCredits(userId: string, amount: number, note?: string) {
  const { error } = await backend.rpc('admin_adjust_credits', { p_user_id: userId, p_amount: amount, p_note: note ?? null });
  return { error };
}

export async function markNoShow(reservationId: string) {
  const { error } = await backend.rpc('mark_no_show', { p_reservation_id: reservationId });
  return { error };
}
