-- Saved Chart Builder snapshots (per authenticated user).
create table if not exists public.admin_saved_charts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_saved_charts_user_id_created_at_idx
  on public.admin_saved_charts (user_id, created_at desc);

alter table public.admin_saved_charts enable row level security;

create policy "Users read own saved charts"
  on public.admin_saved_charts for select
  using (auth.uid() = user_id);

create policy "Users insert own saved charts"
  on public.admin_saved_charts for insert
  with check (auth.uid() = user_id);

create policy "Users update own saved charts"
  on public.admin_saved_charts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own saved charts"
  on public.admin_saved_charts for delete
  using (auth.uid() = user_id);
