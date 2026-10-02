import { backend } from './client';
import { firstEmbed } from './embed';

export type AdminClass = {
  id: string;
  title: string;
  instructorId: string;
  instructorName: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  status: 'scheduled' | 'completed' | 'cancelled';
};

// RLS on `classes` already grants admins insert/select for every row (see
// "admin write classes" / "read classes" policies) -- no RPC needed.
// Non-cancelled classes in [from, to) -- one week of the admin schedule.
export async function listClassesBetween(from: Date, to: Date): Promise<AdminClass[]> {
  const { data, error } = await backend
    .from('classes')
    .select('id, title, instructor_id, instructors(name), starts_at, duration_minutes, capacity, status')
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .neq('status', 'cancelled')
    .order('starts_at');
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    instructorId: c.instructor_id,
    instructorName: firstEmbed(c.instructors)?.name ?? '',
    startsAt: c.starts_at,
    durationMinutes: c.duration_minutes,
    capacity: c.capacity,
    status: c.status,
  }));
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Copies the week before [weekStart, weekStart + 7d) into it, skipping slots
// that already have a class with the same title (clicking twice is harmless)
// and slots already in the past. Same logic as web/src/lib/classes.ts.
export async function copyPreviousWeek(weekStart: Date): Promise<{ copied: number; error: Error | null }> {
  const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
  const [source, target] = await Promise.all([
    listClassesBetween(new Date(weekStart.getTime() - WEEK_MS), weekStart),
    listClassesBetween(weekStart, weekEnd),
  ]);
  const key = (startsAt: number, title: string) => `${startsAt}|${title}`;
  const taken = new Set(target.map((c) => key(new Date(c.startsAt).getTime(), c.title)));
  const rows = source
    .map((c) => ({ ...c, at: new Date(c.startsAt).getTime() + WEEK_MS }))
    .filter((c) => !taken.has(key(c.at, c.title)) && c.at > Date.now())
    .map((c) => ({
      title: c.title,
      instructor_id: c.instructorId,
      starts_at: new Date(c.at).toISOString(),
      duration_minutes: c.durationMinutes,
      capacity: c.capacity,
    }));
  if (rows.length === 0) return { copied: 0, error: null };
  const { error } = await backend.from('classes').insert(rows);
  return { copied: error ? 0 : rows.length, error };
}

// Thu-Sun publishes next week; Mon-Wed the current one. Returns the new
// schedule_published_until ('YYYY-MM-DD').
export async function publishNextWeek(): Promise<{ until: string | null; error: Error | null }> {
  const { data, error } = await backend.rpc('admin_publish_next_week');
  return { until: data, error };
}

export async function createClass(input: {
  title: string;
  instructorId: string;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
}) {
  const { error } = await backend.from('classes').insert({
    title: input.title,
    instructor_id: input.instructorId,
    starts_at: input.startsAt.toISOString(),
    duration_minutes: input.durationMinutes,
    capacity: input.capacity,
  });
  return { error };
}

// Rescheduling (starts_at/duration) notifies booked riders, so this goes
// through admin_update_class() instead of a plain update.
export async function updateClass(
  classId: string,
  input: { title: string; instructorId: string; startsAt: Date; durationMinutes: number; capacity: number },
) {
  const { error } = await backend.rpc('admin_update_class', {
    p_class_id: classId,
    p_title: input.title,
    p_instructor_id: input.instructorId,
    p_starts_at: input.startsAt.toISOString(),
    p_duration_minutes: input.durationMinutes,
    p_capacity: input.capacity,
  });
  return { error };
}

// Refunds credits and notifies anyone with a booked reservation, then marks
// the class cancelled -- see admin_cancel_class() in the DB.
export async function cancelClass(classId: string) {
  const { error } = await backend.rpc('admin_cancel_class', { p_class_id: classId });
  return { error };
}

export type Instructor = { id: string; name: string; active: boolean };

// RLS on `instructors` grants everyone read, admins write -- no RPC needed.
export async function listInstructors(): Promise<Instructor[]> {
  const { data, error } = await backend.from('instructors').select('id, name, active').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createInstructor(name: string): Promise<{ instructor: Instructor | null; error: Error | null }> {
  const { data, error } = await backend.from('instructors').insert({ name }).select('id, name, active').single();
  return { instructor: data, error };
}
