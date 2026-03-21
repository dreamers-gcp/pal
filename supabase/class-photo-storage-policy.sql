-- Allow professors to upload class attendance photos under class-photo/{event_id}/...
-- Run in Supabase SQL Editor after face-photos bucket exists.

drop policy if exists "Professors upload class attendance photos" on storage.objects;
create policy "Professors upload class attendance photos"
  on storage.objects for insert with check (
    bucket_id = 'face-photos'
    and (string_to_array(name, '/'))[1] = 'class-photo'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'professor'
    )
  );

-- Optional: professors can read class photos they need for review (same prefix)
drop policy if exists "Professors read class attendance photos" on storage.objects;
create policy "Professors read class attendance photos"
  on storage.objects for select using (
    bucket_id = 'face-photos'
    and (string_to_array(name, '/'))[1] = 'class-photo'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'professor'
    )
  );
