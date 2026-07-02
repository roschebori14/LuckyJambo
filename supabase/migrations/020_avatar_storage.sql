-- Lucky Jambo - Avatar uploads
--
-- Adds a public "avatars" storage bucket (name matches
-- SUPABASE_BUCKET_AVATARS in .env.example, which was already
-- documented but never actually created) plus RLS policies scoping
-- writes to each user's own folder.
--
-- Storage path convention: avatars/{user_id}/{filename}
-- The user_id folder segment is what the policies check against
-- auth.uid(), so a user can only ever write inside their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read - avatars are meant to be visible to anyone viewing a
-- profile, friend list, etc.
create policy "avatar images are publicly accessible"
on storage.objects
for select
using (bucket_id = 'avatars');

-- Upload only into your own folder.
create policy "users can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Overwrite (re-upload) only your own file.
create policy "users can update their own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete only your own file (e.g. before uploading a replacement with
-- a different extension).
create policy "users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
