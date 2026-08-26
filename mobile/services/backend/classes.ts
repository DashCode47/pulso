import { backend } from './client';

export type AdminClass = {
  id: string;
  title: string;
  trainerName: string;
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
    .select('id, title, trainer_name, starts_at, duration_minutes, capacity, status')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    trainerName: c.trainer_name,
    startsAt: c.starts_at,
    durationMinutes: c.duration_minutes,
    capacity: c.capacity,
    status: c.status,
  }));
}

export async function createClass(input: {
  title: string;
  trainerName: string;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
}) {
  const { error } = await backend.from('classes').insert({
    title: input.title,
    trainer_name: input.trainerName,
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
  input: { title: string; trainerName: string; startsAt: Date; durationMinutes: number; capacity: number },
) {
  const { error } = await backend.rpc('admin_update_class', {
    p_class_id: classId,
    p_title: input.title,
    p_trainer_name: input.trainerName,
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
