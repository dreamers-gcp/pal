-- Guest house booking requests (admin approval workflow).

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'guest_house_code'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.guest_house_code as enum ('international_centre', 'mdp_building');
  end if;
end $$;

create table if not exists public.guest_house_bookings (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete set null,
  requester_email text,
  guest_name text not null,
  purpose text,
  guest_house public.guest_house_code,
  room_number text,
  guest_count integer not null default 1
    check (guest_count >= 1 and guest_count <= 200),
  requested_room_count integer not null default 1
    check (requested_room_count >= 1 and requested_room_count <= 200),
  allocated_rooms jsonb,
  check_in_date date not null,
  check_out_date date not null,
  status public.request_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_house_booking_dates_valid check (check_out_date >= check_in_date)
);

create index if not exists idx_guest_house_bookings_status_dates
  on public.guest_house_bookings (status, guest_house, check_in_date, check_out_date);

create index if not exists idx_guest_house_bookings_room_dates
  on public.guest_house_bookings (guest_house, room_number, check_in_date, check_out_date);

alter table public.guest_house_bookings enable row level security;

drop policy if exists "Admins can manage guest house bookings" on public.guest_house_bookings;
create policy "Admins can manage guest house bookings"
  on public.guest_house_bookings for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Professors can create guest house bookings" on public.guest_house_bookings;
drop policy if exists "Students can create guest house bookings" on public.guest_house_bookings;
create policy "Students can create guest house bookings"
  on public.guest_house_bookings for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
    and requester_id = auth.uid()
  );

drop policy if exists "Professors can view own guest house bookings" on public.guest_house_bookings;
drop policy if exists "Students can view own guest house bookings" on public.guest_house_bookings;
create policy "Students can view own guest house bookings"
  on public.guest_house_bookings for select
  using (requester_id = auth.uid());
