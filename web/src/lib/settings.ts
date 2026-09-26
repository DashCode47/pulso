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
