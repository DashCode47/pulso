import { createClient } from '@/lib/supabase/client';

export type Bike = { id: string; label: string; active: boolean };

// RLS: everyone reads bikes, admins write ("admin write bikes"). Inactive
// bikes stay in the table (past reservations reference them) but can't be
// picked for new bookings.
export async function listBikes(): Promise<Bike[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('bikes').select('id, label, active');
  if (error) throw error;
  // Natural sort so "Bici 10" comes after "Bici 9".
  return (data ?? []).sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
}

export async function createBike(label: string) {
  const supabase = createClient();
  const { error } = await supabase.from('bikes').insert({ label });
  return { error };
}

export async function updateBike(id: string, fields: { label?: string; active?: boolean }) {
  const supabase = createClient();
  const { error } = await supabase.from('bikes').update(fields).eq('id', id);
  return { error };
}
