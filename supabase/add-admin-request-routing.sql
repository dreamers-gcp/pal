-- Super admin (profile email admin@test.com) assigns which left-rail dashboard sections each admin email may see.
-- Keys include all request-queue tabs plus enrollments, students, professor tools, parcels, timetable.
-- Admins with no rows for their email see no sidebar sections until the super admin assigns at least one.

create table if not exists public.admin_request_routing (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  request_type_key text not null,
  created_at timestamptz not null default now(),
  unique (admin_email, request_type_key)
);

create index if not exists admin_request_routing_email_idx
  on public.admin_request_routing (admin_email);

comment on table public.admin_request_routing is
  'Maps admin profile emails (lowercase) to allowed dashboard nav keys: request-* tabs plus enrollments, students, prof-assignments, professors, parcel-management, timetable.';

-- Stable helper: super admin is the profile with this exact email (case-insensitive).
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(trim(p.email)) = 'admin@test.com'
  );
$$;

alter table public.admin_request_routing enable row level security;

-- Super admin: full CRUD on all rows
create policy "admin_request_routing_super_admin_all"
  on public.admin_request_routing
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Any admin can read their own routing rows (to know which tabs to show)
create policy "admin_request_routing_read_own"
  on public.admin_request_routing
  for select
  using (
    exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role = 'admin'
        and lower(trim(pr.email)) = lower(trim(admin_email))
    )
  );
