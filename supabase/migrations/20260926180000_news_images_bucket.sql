-- Pulso: news images storage bucket
-- Replaces the free-text image_url field's "paste any URL" flow -- admins
-- now upload the file directly. Public bucket so the app can render banners
-- from a plain public URL (same shape as the Unsplash URLs it replaces);
-- only admins may upload/replace/remove files.

insert into storage.buckets (id, name, public)
values ('news-images', 'news-images', true);

create policy "public read news images" on storage.objects for select
  to public using (bucket_id = 'news-images');

create policy "admin upload news images" on storage.objects for insert
  to authenticated with check (bucket_id = 'news-images' and is_admin());

create policy "admin update news images" on storage.objects for update
  to authenticated using (bucket_id = 'news-images' and is_admin())
  with check (bucket_id = 'news-images' and is_admin());

create policy "admin delete news images" on storage.objects for delete
  to authenticated using (bucket_id = 'news-images' and is_admin());
