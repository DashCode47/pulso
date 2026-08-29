import { createClient } from '@/lib/supabase/client';
import { firstEmbed } from '@/lib/supabaseEmbed';

export type ClassTemplate = {
  id: string;
  title: string;
  instructorId: string;
  instructorName: string;
  dayOfWeek: number; // 0 = Sunday
  startTime: string; // 'HH:MM:SS'
  durationMinutes: number;
  capacity: number;
  active: boolean;
};

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// RLS on `class_templates` grants admins full read/write -- no RPC needed for
// plain CRUD (mirrors mobile/services/backend/classes.ts).
export async function listClassTemplates(): Promise<ClassTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('class_templates')
    .select('id, title, instructor_id, instructors(name), day_of_week, start_time, duration_minutes, capacity, active')
    .order('day_of_week')
    .order('start_time');
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    instructorId: t.instructor_id,
    instructorName: firstEmbed(t.instructors)?.name ?? '',
    dayOfWeek: t.day_of_week,
    startTime: t.start_time,
    durationMinutes: t.duration_minutes,
    capacity: t.capacity,
    active: t.active,
  }));
}

export type ClassTemplateInput = {
  title: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
};

export async function createClassTemplate(input: ClassTemplateInput) {
  const supabase = createClient();
  const { error } = await supabase.from('class_templates').insert({
    title: input.title,
    instructor_id: input.instructorId,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    duration_minutes: input.durationMinutes,
    capacity: input.capacity,
  });
  return { error };
}

// Editing a template only affects classes generated *after* the edit -- it
// never rewrites already-generated rows.
export async function updateClassTemplate(templateId: string, input: ClassTemplateInput) {
  const supabase = createClient();
  const { error } = await supabase
    .from('class_templates')
    .update({
      title: input.title,
      instructor_id: input.instructorId,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      duration_minutes: input.durationMinutes,
      capacity: input.capacity,
    })
    .eq('id', templateId);
  return { error };
}

// Soft delete: stops future generation but keeps already-generated classes
// (and their reservations) intact.
export async function setClassTemplateActive(templateId: string, active: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from('class_templates').update({ active }).eq('id', templateId);
  return { error };
}
