-- Pulso: profile photos storage bucket
-- Public bucket so Home/Profile render avatars from a plain public URL
-- (profiles.avatar_url). Each user may only write inside their own folder:
-- avatars/<auth.uid()>/avatar. Size and mime type enforced by the bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

-- select is needed for upsert (overwrite) to work, not for public reads.
create policy "read own avatar" on storage.objects for select
  to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "upload own avatar" on storage.objects for insert
  to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "update own avatar" on storage.objects for update
  to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "delete own avatar" on storage.objects for delete
  to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
