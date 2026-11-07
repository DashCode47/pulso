-- Pulso: instructor photos
-- The class card on "Reservar" now shows the instructor's face. Photos live
-- in a public bucket (rendered from a plain public URL, like avatars and
-- news images); instructors.photo_path holds the object path inside it,
-- e.g. '<instructor id>/photo.jpg'. The client builds the URL with
-- storage.from('instructor-photos').getPublicUrl(photo_path).
-- Null = no photo yet; the app falls back to initials.

alter table instructors add column photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('instructor-photos', 'instructor-photos', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

-- Public reads go through the public URL and need no policy; select is
-- only here so admins can upsert (overwrite) a photo.
create policy "admin read instructor photos" on storage.objects for select
  to authenticated using (bucket_id = 'instructor-photos' and is_admin());

create policy "admin upload instructor photos" on storage.objects for insert
  to authenticated with check (bucket_id = 'instructor-photos' and is_admin());

create policy "admin update instructor photos" on storage.objects for update
  to authenticated using (bucket_id = 'instructor-photos' and is_admin())
  with check (bucket_id = 'instructor-photos' and is_admin());

create policy "admin delete instructor photos" on storage.objects for delete
  to authenticated using (bucket_id = 'instructor-photos' and is_admin());
