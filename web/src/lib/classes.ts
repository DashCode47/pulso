import { createClient } from '@/lib/supabase/client';
import { firstEmbed } from '@/lib/supabaseEmbed';

export type AdminClass = {
  id: string;
  title: string;
  instructorName: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  status: 'scheduled' | 'completed' | 'cancelled';
};

// RLS on `classes` grants admins full read/write -- no RPC needed for listing.
export async function listUpcomingClasses(): Promise<AdminClass[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classes')
    .select('id, title, instructors(name), starts_at, duration_minutes, capacity, status, reservations(status)')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    instructorName: firstEmbed(c.instructors)?.name ?? '',
    startsAt: c.starts_at,
    durationMinutes: c.duration_minutes,
    capacity: c.capacity,
    bookedCount: c.reservations.filter((r) => r.status === 'booked').length,
    status: c.status,
  }));
}

// Refunds credits and notifies anyone with a booked reservation, then marks
// the class cancelled -- see admin_cancel_class() in the DB.
export async function cancelClass(classId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_cancel_class', { p_class_id: classId });
  return { error };
}

export type ClassRoster = {
  reservationId: string;
  fullName: string;
  bikeLabel: string;
  status: 'booked' | 'cancelled' | 'attended' | 'no_show';
  bookedAt: string;
};

// reservations.user_id references auth.users, not public.profiles directly
// (profiles.id happens to match auth.users.id, but there's no FK PostgREST
// can follow), so profiles can't be embedded in this select -- fetched
// separately and joined in JS instead. "admin read all profiles" RLS policy
// covers that lookup.
export async function listClassRoster(classId: string): Promise<ClassRoster[]> {
  const supabase = createClient();
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id, user_id, status, booked_at, bikes(label)')
    .eq('class_id', classId)
    .neq('status', 'cancelled')
    .order('booked_at');
  if (error) throw error;
  if (!reservations?.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', reservations.map((r) => r.user_id));
  if (profilesError) throw profilesError;
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return reservations.map((r) => ({
    reservationId: r.id,
    fullName: nameById.get(r.user_id) ?? '',
    bikeLabel: firstEmbed(r.bikes)?.label ?? '',
    status: r.status,
    bookedAt: r.booked_at,
  }));
}
