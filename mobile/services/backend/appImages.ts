import { backend } from './client';

// Fixed file names in the public app-images bucket -- replace an image by
// uploading over the same name in the Supabase dashboard.
export type AppImageName = 'onboarding-1.jpg' | 'onboarding-2.jpg' | 'onboarding-3.jpg' | 'bookings-hero.jpg' | 'home-whatsapp.jpg';

export function appImageUrl(name: AppImageName): string {
  return backend.storage.from('app-images').getPublicUrl(name).data.publicUrl;
}
