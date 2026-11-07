-- Pulso: app images storage bucket
-- Marketing images the app shows (onboarding slides, the "Reservar" hero)
-- come from here instead of being bundled, so they can be swapped without
-- shipping a new build. The app reads fixed paths -- replace a file by
-- uploading over it with the same name:
--   onboarding-1.jpg, onboarding-2.jpg, onboarding-3.jpg, bookings-hero.jpg
-- Public bucket: onboarding runs before sign-in, so reads can't require auth.
-- Only admins may write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app-images', 'app-images', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']);

-- Public reads go through the public URL and need no policy; select is
-- only here so admins can upsert (overwrite) a file.
create policy "admin read app images" on storage.objects for select
  to authenticated using (bucket_id = 'app-images' and is_admin());

create policy "admin upload app images" on storage.objects for insert
  to authenticated with check (bucket_id = 'app-images' and is_admin());

create policy "admin update app images" on storage.objects for update
  to authenticated using (bucket_id = 'app-images' and is_admin())
  with check (bucket_id = 'app-images' and is_admin());

create policy "admin delete app images" on storage.objects for delete
  to authenticated using (bucket_id = 'app-images' and is_admin());
