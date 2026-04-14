-- Allow authenticated users to create their own profile row (needed for OAuth onboarding
-- when profile trigger is missing/delayed). Keep scope strict to own auth.uid().
-- Run once in Supabase SQL editor.

alter table public.profiles enable row level security;

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);
