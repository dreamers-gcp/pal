-- Mobile number on profiles (10-digit, digits only) + parcel desk workflow
-- Run in Supabase SQL Editor after prior migrations.

-- 1. Profiles: mobile for signup + parcel lookup
alter table public.profiles
  add column if not exists mobile_phone text;

comment on column public.profiles.mobile_phone is '10-digit mobile (digits only). Used for parcel matching.';

create unique index if not exists profiles_mobile_phone_unique
  on public.profiles (mobile_phone)
  where mobile_phone is not null and btrim(mobile_phone) <> '';

-- 2. Parcel status + table
do $$
begin
  if not exists (select 1 from pg_type where typname = 'parcel_status') then
    create type public.parcel_status as enum ('awaiting_pickup', 'collected');
  end if;
end$$;

create table if not exists public.parcels (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  mobile_snapshot text not null,
  status public.parcel_status not null default 'awaiting_pickup',
  registered_by uuid references public.profiles(id) on delete set null,
  notes text,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parcels_recipient_status_idx
  on public.parcels (recipient_id, status);

create index if not exists parcels_created_at_idx
  on public.parcels (created_at desc);

alter table public.parcels enable row level security;

drop policy if exists "Admins select parcels" on public.parcels;
drop policy if exists "Admins insert parcels" on public.parcels;
drop policy if exists "Admins update parcels" on public.parcels;
drop policy if exists "Recipients select own parcels" on public.parcels;
drop policy if exists "Recipients mark parcel collected" on public.parcels;

-- Admins: full access
create policy "Admins select parcels"
  on public.parcels for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Admins insert parcels"
  on public.parcels for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    and registered_by = auth.uid()
  );

create policy "Admins update parcels"
  on public.parcels for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Students / professors: see own parcels
create policy "Recipients select own parcels"
  on public.parcels for select
  using (
    recipient_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('student', 'professor')
    )
  );

-- Recipient: only transition awaiting_pickup -> collected
create policy "Recipients mark parcel collected"
  on public.parcels for update
  using (
    recipient_id = auth.uid()
    and status = 'awaiting_pickup'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('student', 'professor')
    )
  )
  with check (
    recipient_id = auth.uid()
    and status = 'collected'
  );

-- 3. Keep handle_new_user in sync (mobile_phone from signup metadata)
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_mobile text;
begin
  v_mobile := nullif(btrim(coalesce(new.raw_user_meta_data->>'mobile_phone', '')), '');

  insert into public.profiles (id, email, full_name, role, mobile_phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    v_mobile
  );

  if coalesce(new.raw_user_meta_data->>'role', 'student') = 'student' then
    perform public.assign_groups_from_enrollments(new.email);
  end if;

  return new;
end;
$$ language plpgsql security definer;
