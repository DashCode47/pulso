import { createClient } from '@/lib/supabase/client';

export type Instructor = { id: string; name: string; active: boolean };

// RLS on `instructors` grants everyone read, admins write -- no RPC needed.
export async function listInstructors(): Promise<Instructor[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('instructors').select('id, name, active').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createInstructor(name: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('instructors').insert({ name }).select('id, name, active').single();
  return { instructor: data as Instructor | null, error };
}
