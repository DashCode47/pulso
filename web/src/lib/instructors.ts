import { createClient } from '@/lib/supabase/client';
import { MAX_IMAGE_BYTES, downscale } from '@/lib/storage';

const PHOTOS_BUCKET = 'instructor-photos';
// Shown as a small avatar on the class card: 600px is plenty even at 3x.
const PHOTO_MAX_WIDTH = 600;

export type Instructor = { id: string; name: string; active: boolean; photoUrl: string | null };

type Row = { id: string; name: string; active: boolean; photo_path: string | null };
const SELECT = 'id, name, active, photo_path';

function fromRow(r: Row): Instructor {
  const supabase = createClient();
  return {
    id: r.id,
    name: r.name,
    active: r.active,
    photoUrl: r.photo_path ? supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(r.photo_path).data.publicUrl : null,
  };
}

// RLS on `instructors` grants everyone read, admins write -- no RPC needed.
export async function listInstructors(): Promise<Instructor[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('instructors').select(SELECT).order('name');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function createInstructor(name: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('instructors').insert({ name }).select(SELECT).single();
  return { instructor: data ? fromRow(data) : null, error };
}

export async function updateInstructor(id: string, fields: { name?: string; active?: boolean }) {
  const supabase = createClient();
  const { error } = await supabase.from('instructors').update(fields).eq('id', id);
  return { error };
}

// Fails with a FK error (23503) once the instructor has classes or an
// achievement -- deactivating is the way to retire those.
export async function deleteInstructor(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('instructors').delete().eq('id', id);
  if (!error) await removeFiles(id);
  return { error };
}

// A new file name per upload (never overwritten), so phones and the CDN can
// cache each URL for a year -- same scheme as member avatars. Older files in
// the instructor's folder are deleted afterwards.
export async function uploadInstructorPhoto(id: string, file: File): Promise<{ error: Error | null }> {
  if (!file.type.startsWith('image/')) return { error: new Error('El archivo debe ser una imagen.') };
  const image = await downscale(file, PHOTO_MAX_WIDTH);
  if (image.size > MAX_IMAGE_BYTES) return { error: new Error('La foto no puede pesar más de 5 MB.') };

  const supabase = createClient();
  const ext = image !== file ? 'jpg' : (file.name.split('.').pop() ?? 'jpg');
  const fileName = `${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(`${id}/${fileName}`, image, { cacheControl: String(365 * 24 * 60 * 60), contentType: image.type || file.type });
  if (uploadError) return { error: uploadError };

  const { error } = await supabase.from('instructors').update({ photo_path: `${id}/${fileName}` }).eq('id', id);
  if (error) return { error };
  await removeFiles(id, fileName);
  return { error: null };
}

export async function removeInstructorPhoto(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('instructors').update({ photo_path: null }).eq('id', id);
  if (!error) await removeFiles(id);
  return { error };
}

// Best effort: a leftover file only costs a few KB of storage.
async function removeFiles(id: string, keep?: string) {
  const bucket = createClient().storage.from(PHOTOS_BUCKET);
  const { data } = await bucket.list(id);
  const old = (data ?? []).filter((f) => f.name !== keep).map((f) => `${id}/${f.name}`);
  if (old.length) await bucket.remove(old);
}
