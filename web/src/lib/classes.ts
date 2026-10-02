import { createClient } from '@/lib/supabase/client';
import { firstEmbed } from '@/lib/supabaseEmbed';

export type AdminClass = {
  id: string;
  title: string;
  instructorId: string;
  instructorName: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  status: 'scheduled' | 'completed' | 'cancelled';
};

const CLASS_SELECT = 'id, title, instructor_id, instructors(name), starts_at, duration_minutes, capacity, status, reservations(status)';

// RLS on `classes` grants admins full read/write -- no RPC needed for listing.
export async function listUpcomingClasses(): Promise<AdminClass[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classes')
    .select(CLASS_SELECT)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return (data ?? []).map(toAdminClass);
}

// Studio dates are Bogota dates ('YYYY-MM-DD'). Bogota is a fixed UTC-5 with
// no DST, so a date + time maps to an instant with a constant offset.
export const STUDIO_TZ = 'America/Bogota';

export function bogotaInstant(date: string, time: string) {
  return new Date(`${date}T${time}:00-05:00`).toISOString();
}

export function bogotaDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: STUDIO_TZ });
}

export function bogotaTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: STUDIO_TZ, hour: '2-digit', minute: '2-digit' });
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date: string) {
  return addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
}

// Non-cancelled classes of the Mon-Sun week starting at weekStart.
export async function listWeekClasses(weekStart: string): Promise<AdminClass[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classes')
    .select(CLASS_SELECT)
    .gte('starts_at', bogotaInstant(weekStart, '00:00'))
    .lt('starts_at', bogotaInstant(addDays(weekStart, 7), '00:00'))
    .neq('status', 'cancelled')
    .order('starts_at');
  if (error) throw error;
  return (data ?? []).map(toAdminClass);
}

export type ClassInput = {
  title: string;
  instructorId: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
};

// RLS lets admins insert directly (mirrors mobile/services/backend/classes.ts).
export async function createClass(input: ClassInput) {
  const supabase = createClient();
  const { error } = await supabase.from('classes').insert({
    title: input.title,
    instructor_id: input.instructorId,
    starts_at: input.startsAt,
    duration_minutes: input.durationMinutes,
    capacity: input.capacity,
  });
  return { error };
}

// admin_update_class() notifies anyone booked if the time or duration changed.
export async function updateClass(classId: string, input: ClassInput) {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_update_class', {
    p_class_id: classId,
    p_title: input.title,
    p_instructor_id: input.instructorId,
    p_starts_at: input.startsAt,
    p_duration_minutes: input.durationMinutes,
    p_capacity: input.capacity,
  });
  return { error };
}

// Copies the previous week's classes into weekStart, skipping any slot that
// already has a class with the same title (so clicking twice is harmless).
export async function copyPreviousWeek(weekStart: string): Promise<{ copied: number; error: Error | null }> {
  const [source, target] = await Promise.all([listWeekClasses(addDays(weekStart, -7)), listWeekClasses(weekStart)]);
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const taken = new Set(target.map((c) => `${new Date(c.startsAt).getTime()}|${c.title}`));
  const rows = source
    .map((c) => ({ ...c, startsAt: new Date(new Date(c.startsAt).getTime() + WEEK_MS).toISOString() }))
    .filter((c) => !taken.has(`${new Date(c.startsAt).getTime()}|${c.title}`) && c.startsAt > new Date().toISOString())
    .map((c) => ({
      title: c.title,
      instructor_id: c.instructorId,
      starts_at: c.startsAt,
      duration_minutes: c.durationMinutes,
      capacity: c.capacity,
    }));
  if (rows.length === 0) return { copied: 0, error: null };
  const { error } = await createClient().from('classes').insert(rows);
  return { copied: error ? 0 : rows.length, error };
}

function toAdminClass(c: {
  id: string;
  title: string;
  instructor_id: string;
  instructors: unknown;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  status: AdminClass['status'];
  reservations: { status: string }[];
}): AdminClass {
  return {
    id: c.id,
    title: c.title,
    instructorId: c.instructor_id,
    instructorName: firstEmbed(c.instructors as { name: string } | { name: string }[] | null)?.name ?? '',
    startsAt: c.starts_at,
    durationMinutes: c.duration_minutes,
    capacity: c.capacity,
    bookedCount: c.reservations.filter((r) => r.status === 'booked').length,
    status: c.status,
  };
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
