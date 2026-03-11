-- Run this in Supabase SQL Editor to allow admins to update any profile
-- (needed for assigning student groups)
--
-- Safe to run multiple times — drops existing policy first if it exists.

do $$
begin
  drop policy if exists "Admins can update any profile" on public.profiles;
end
$$;

create policy "Admins can update any profile"
  on public.profiles for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
