-- Fix: Update storage policy to also allow attendance/ prefix paths
-- Run this if attendance photo uploads are failing

-- Drop old policies and recreate with broader match
drop policy if exists "Students upload own face photos" on storage.objects;
drop policy if exists "Students read own face photos" on storage.objects;
drop policy if exists "Students delete own face photos" on storage.objects;

-- Students can upload to their own folder: {student_id}/...
create policy "Students upload own face photos"
  on storage.objects for insert with check (
    bucket_id = 'face-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Students can read their own files
create policy "Students read own face photos"
  on storage.objects for select using (
    bucket_id = 'face-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Students can delete their own files
create policy "Students delete own face photos"
  on storage.objects for delete using (
    bucket_id = 'face-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );
