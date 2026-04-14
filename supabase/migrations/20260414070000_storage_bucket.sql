-- Public storage bucket for store logos and product images.
-- Path convention: {store_id}/...  so RLS can scope writes per-tenant.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-media',
  'store-media',
  true,  -- public read
  5 * 1024 * 1024,  -- 5 MB per file
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Read: anyone (the bucket is public and images are referenced from the Shopper).
drop policy if exists store_media_public_read on storage.objects;
create policy store_media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'store-media');

-- Write: only authenticated users, only into their own store's folder.
-- Path is "{store_id}/..." — first folder segment must match the user's store.
drop policy if exists store_media_store_write on storage.objects;
create policy store_media_store_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-media'
    and (storage.foldername(name))[1] = public.current_store_id()::text
  );

drop policy if exists store_media_store_update on storage.objects;
create policy store_media_store_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-media'
    and (storage.foldername(name))[1] = public.current_store_id()::text
  );

drop policy if exists store_media_store_delete on storage.objects;
create policy store_media_store_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store-media'
    and (storage.foldername(name))[1] = public.current_store_id()::text
  );
