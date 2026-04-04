-- Sports facility bookings by students/professors with admin approval.
create table if not exists public.sports_bookings (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete set null,
  requester_email text,
  requester_role text not null check (requester_role in ('student', 'professor')),
  sport text not null check (
    sport in (
      'cricket',
      'badminton',
      'basketball',
      'football',
      'table_tennis',
      'lawn_tennis',
      'snooker'
    )
  ),
  venue_code text not null check (
    venue_code in (
      'cricket_ground',
      'badminton_court',
      'basketball_court',
      'football_field',
      'table_tennis',
      'lawn_tennis',
      'snooker_board_1',
      'snooker_board_2'
    )
  ),
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  purpose text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'clarification_needed')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create index if not exists idx_sports_bookings_date_venue
  on public.sports_bookings (booking_date, venue_code);

alter table public.sports_bookings enable row level security;

drop policy if exists "Admins can manage sports bookings" on public.sports_bookings;
create policy "Admins can manage sports bookings"
  on public.sports_bookings for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Students can create sports bookings" on public.sports_bookings;
create policy "Students can create sports bookings"
  on public.sports_bookings for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
    and requester_id = auth.uid()
  );

drop policy if exists "Students can view own sports bookings" on public.sports_bookings;
create policy "Students can view own sports bookings"
  on public.sports_bookings for select
  using (requester_id = auth.uid());

drop policy if exists "Professors can create sports bookings" on public.sports_bookings;
create policy "Professors can create sports bookings"
  on public.sports_bookings for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'professor')
    and requester_id = auth.uid()
  );

drop policy if exists "Professors can view own sports bookings" on public.sports_bookings;
create policy "Professors can view own sports bookings"
  on public.sports_bookings for select
  using (requester_id = auth.uid());
