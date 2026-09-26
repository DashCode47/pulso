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

// admin_save_class_template() is the only write path: it also rebuilds the
// template's future classes that nobody booked. `kept` = booked classes left
// as they were that no longer match the template (admin should review them).
export async function saveClassTemplate(templateId: string | null, input: ClassTemplateInput, active = true) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_save_class_template', {
    p_template_id: templateId,
    p_title: input.title,
    p_instructor_id: input.instructorId,
    p_day_of_week: input.dayOfWeek,
    p_start_time: input.startTime,
    p_duration_minutes: input.durationMinutes,
    p_capacity: input.capacity,
    p_active: active,
  });
  return { kept: (data as number | null) ?? 0, error };
}
