import { backend } from './client';
import { currentUserId } from './auth';
import { firstEmbed } from './embed';

export type MyMembership = {
  planName: string;
  creditsBalance: number;
  creditsPerCycle: number;
  cycleEnd: string;
  status: 'active' | 'expired' | 'cancelled';
};

// RLS grants a user select on their own membership/user_stats row
// ("read own membership" / "read own stats") -- no RPC needed.
export async function getMyMembership(): Promise<MyMembership | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data: membership, error: membershipError } = await backend
    .from('memberships')
    .select('plan_name, credits_per_cycle, cycle_end, status')
    .eq('user_id', userId)
    // created_at, like the admin and search_members(): a re-enrollment can share
    // cycle_start with the cancelled row it replaces.
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return null;

  const { data: stats, error: statsError } = await backend
    .from('user_stats')
    .select('credits_balance')
    .eq('user_id', userId)
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

export async function getMyAvatarUrl(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await backend.from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.avatar_url ?? null;
}

// A new file name per upload (never overwritten), so phones and the CDN can
// cache each URL for a year: a new photo is simply a new URL. The previous
// file is deleted afterwards so old photos don't pile up in the bucket.
const AVATAR_CACHE_SECONDS = String(365 * 24 * 60 * 60);

export async function uploadMyAvatar(uri: string, contentType: string): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Usuario no autenticado');

  const bucket = backend.storage.from('avatars');
  const body = await fetch(uri).then((r) => r.arrayBuffer());
  const fileName = `${Date.now()}.jpg`;
  const { error: uploadError } = await bucket.upload(`${userId}/${fileName}`, body, {
    contentType,
    cacheControl: AVATAR_CACHE_SECONDS,
  });
  if (uploadError) throw uploadError;

  const url = bucket.getPublicUrl(`${userId}/${fileName}`).data.publicUrl;
  const { error } = await backend.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (error) throw error;

  // Best effort: a leftover file only costs a few KB of storage.
  const { data: files } = await bucket.list(userId);
  const old = (files ?? []).filter((f) => f.name !== fileName).map((f) => `${userId}/${f.name}`);
  if (old.length) await bucket.remove(old);
  return url;
}

export type MyHistoryEntry = {
  id: string;
  classTitle: string;
  startsAt: string;
  status: 'booked' | 'cancelled' | 'attended' | 'no_show';
};

export async function listMyHistory(): Promise<MyHistoryEntry[]> {
  const userId = await currentUserId();
  if (!userId) return [];

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
