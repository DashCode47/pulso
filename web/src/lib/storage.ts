import { createClient } from '@/lib/supabase/client';

const NEWS_IMAGES_BUCKET = 'news-images';

// storage.buckets has no size/mime constraints set at the DB level (kept out
// of the migration since the exact column names weren't worth guessing at) --
// enforced here client-side instead.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadNewsImage(file: File): Promise<{ url: string | null; error: Error | null }> {
  if (!file.type.startsWith('image/')) {
    return { url: null, error: new Error('El archivo debe ser una imagen.') };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { url: null, error: new Error('La imagen no puede pesar más de 5 MB.') };
  }

  const supabase = createClient();
  const ext = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;

  const { error } = await supabase.storage.from(NEWS_IMAGES_BUCKET).upload(path, file, { cacheControl: '3600' });
  if (error) return { url: null, error };

  const { data } = supabase.storage.from(NEWS_IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
