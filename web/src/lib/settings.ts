import { createClient } from '@/lib/supabase/client';

export type StudioSettings = { cancellationCutoffHours: number };

// studio_settings is a single row (id is always true). RLS grants every
// authenticated user select, but only admins can update -- no RPC needed.
export async function getStudioSettings(): Promise<StudioSettings> {
  const supabase = createClient();
  const { data, error } = await supabase.from('studio_settings').select('cancellation_cutoff_hours').eq('id', true).single();
  if (error) throw error;
  return { cancellationCutoffHours: data.cancellation_cutoff_hours };
}

export async function updateCancellationCutoff(hours: number) {
  const supabase = createClient();
  const { error } = await supabase.from('studio_settings').update({ cancellation_cutoff_hours: hours }).eq('id', true);
  return { error };
}

// Members only see/book classes up to this Bogota date ('YYYY-MM-DD', a Sunday).
export async function getSchedulePublishedUntil(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.from('studio_settings').select('schedule_published_until').eq('id', true).single();
  if (error) throw error;
  return data.schedule_published_until;
}

export async function publishNextWeek(): Promise<{ until: string | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_publish_next_week');
  return { until: data, error };
}
