import { backend } from './client';

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
export async function listAllUpcomingClasses(): Promise<AdminClass[]> {
  const { data, error } = await backend
    .from('classes')
    .select('id, title, instructor_id, instructors(name), starts_at, duration_minutes, capacity, status')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    instructorId: c.instructor_id,
    instructorName: c.instructors[0]?.name ?? '',
    startsAt: c.starts_at,
    durationMinutes: c.duration_minutes,
    capacity: c.capacity,
    status: c.status,
  }));
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
