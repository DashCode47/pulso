import { createClient } from '@/lib/supabase/client';

const NEWS_IMAGES_BUCKET = 'news-images';

// storage.buckets has no size/mime constraints set at the DB level (kept out
// of the migration since the exact column names weren't worth guessing at) --
// enforced here client-side instead.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// The banner renders full-width on phones (~1200 px on a 3x screen): anything
// bigger is egress every member pays for on Home (Free plan: 5 GB/month).
// Browser-native canvas, no dependency. Transparent PNGs come out with a black
// background, which matches the app's dark theme.
const NEWS_IMAGE_MAX_WIDTH = 1280;

async function downscale(file: File): Promise<Blob> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file; // animation / vector
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, NEWS_IMAGE_MAX_WIDTH / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // format the browser can't decode (e.g. HEIC): upload as is
  }
}

export async function uploadNewsImage(file: File): Promise<{ url: string | null; error: Error | null }> {
  if (!file.type.startsWith('image/')) {
    return { url: null, error: new Error('El archivo debe ser una imagen.') };
  }

  const image = await downscale(file);
  if (image.size > MAX_IMAGE_BYTES) {
    return { url: null, error: new Error('La imagen no puede pesar más de 5 MB.') };
  }

  const supabase = createClient();
  const ext = image !== file ? 'jpg' : file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;

  const { error } = await supabase.storage
    .from(NEWS_IMAGES_BUCKET)
    // random file name, never overwritten: safe to cache for a year
    .upload(path, image, { cacheControl: String(365 * 24 * 60 * 60), contentType: image.type || file.type });
  if (error) return { url: null, error };

  const { data } = supabase.storage.from(NEWS_IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
