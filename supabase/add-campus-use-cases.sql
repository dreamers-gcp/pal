-- Campus use cases: student leave, facility bookings, mess extras, health appointments,
-- calendar request_kind (class vs exam), Exam Hall classroom seed.
-- Run in Supabase SQL Editor after existing migrations.

-- ---------------------------------------------------------------------------
-- 1) Calendar: distinguish class sessions vs exams (professor scheduling)
-- ---------------------------------------------------------------------------
alter table public.calendar_requests
  add column if not exists request_kind text not null default 'extra_class'
  check (
    request_kind in (
      'guest_speaker_session',
      'extra_class',
      'exam',
      'conclave',
      'conference',
      'student_event',
      'faculty_meeting'
    )
  );

comment on column public.calendar_requests.request_kind is
  'Professor event category: guest speaker, extra class, exam, conclave, conference, student event, faculty meeting.';

-- ---------------------------------------------------------------------------
-- 2) Venue-style classrooms (professor “Venue” dropdown)
-- ---------------------------------------------------------------------------
insert into public.classrooms (name, capacity)
values
  ('Class Room', 40),
  ('Exam Hall', 200),
  ('Seminar Hall', 80),
  ('Board Room', 20),
  ('Auditorium', 300),
  ('Computer Hall', 50)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Student leave requests (admin approves)
-- ---------------------------------------------------------------------------
create table if not exists public.student_leave_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  status public.request_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_leave_dates_valid check (end_date >= start_date)
);

create index if not exists idx_student_leave_student_dates
  on public.student_leave_requests (student_id, start_date, end_date);

alter table public.student_leave_requests enable row level security;

drop policy if exists "Admins manage student leave requests" on public.student_leave_requests;
create policy "Admins manage student leave requests"
  on public.student_leave_requests for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Students insert own leave requests" on public.student_leave_requests;
create policy "Students insert own leave requests"
  on public.student_leave_requests for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
    and student_id = auth.uid()
  );

drop policy if exists "Students view own leave requests" on public.student_leave_requests;
create policy "Students view own leave requests"
  on public.student_leave_requests for select
  using (student_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) Facility bookings (auditorium: student; computer/board/conference: professor)
-- ---------------------------------------------------------------------------
create table if not exists public.facility_bookings (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete set null,
  requester_email text,
  requester_role text not null check (requester_role in ('student', 'professor')),
  facility_type text not null check (
    facility_type in (
      'auditorium',
      'computer_hall',
      'board_room',
      'conference_room'
    )
  ),
  venue_code text not null,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  purpose text,
  status public.request_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  constraint facility_auditorium_student check (
    facility_type <> 'auditorium' or requester_role = 'student'
  ),
  constraint facility_prof_types check (
    facility_type = 'auditorium' or requester_role = 'professor'
  )
);

create index if not exists idx_facility_bookings_date_type
  on public.facility_bookings (facility_type, venue_code, booking_date, status);

alter table public.facility_bookings enable row level security;

drop policy if exists "Admins manage facility bookings" on public.facility_bookings;
create policy "Admins manage facility bookings"
  on public.facility_bookings for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Students create auditorium bookings" on public.facility_bookings;
create policy "Students create auditorium bookings"
  on public.facility_bookings for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
    and requester_id = auth.uid()
    and facility_type = 'auditorium'
    and requester_role = 'student'
  );

drop policy if exists "Students view own facility bookings" on public.facility_bookings;
create policy "Students view own facility bookings"
  on public.facility_bookings for select
  using (requester_id = auth.uid());

drop policy if exists "Professors create facility bookings" on public.facility_bookings;
create policy "Professors create facility bookings"
  on public.facility_bookings for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'professor')
    and requester_id = auth.uid()
    and requester_role = 'professor'
    and facility_type in ('computer_hall', 'board_room', 'conference_room')
  );

drop policy if exists "Professors view own facility bookings" on public.facility_bookings;
create policy "Professors view own facility bookings"
  on public.facility_bookings for select
  using (requester_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5) Mess / dining — extra guests (1 day advance; admin approves)
-- ---------------------------------------------------------------------------
create table if not exists public.mess_extra_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  meal_date date not null,
  meal_period text not null default 'lunch' check (meal_period in ('breakfast', 'lunch', 'dinner')),
  extra_guest_count int not null check (extra_guest_count >= 1 and extra_guest_count <= 50),
  notes text,
  status public.request_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mess_extra_student_date
  on public.mess_extra_requests (student_id, meal_date);

alter table public.mess_extra_requests enable row level security;

drop policy if exists "Admins manage mess extra requests" on public.mess_extra_requests;
create policy "Admins manage mess extra requests"
  on public.mess_extra_requests for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Students create mess extra requests" on public.mess_extra_requests;
create policy "Students create mess extra requests"
  on public.mess_extra_requests for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
    and student_id = auth.uid()
  );

drop policy if exists "Students view own mess extra requests" on public.mess_extra_requests;
create policy "Students view own mess extra requests"
  on public.mess_extra_requests for select
  using (student_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6) Counsellor (1) + Doctors (2) — slot booking, student-initiated, admin approves
-- ---------------------------------------------------------------------------
create table if not exists public.appointment_bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  service_type text not null check (service_type in ('counsellor', 'doctor')),
  provider_code text not null check (
    provider_code in ('counsellor_1', 'doctor_1', 'doctor_2')
  ),
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  status public.request_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  constraint appointment_provider_matches_service check (
    (service_type = 'counsellor' and provider_code = 'counsellor_1')
    or (service_type = 'doctor' and provider_code in ('doctor_1', 'doctor_2'))
  )
);

create index if not exists idx_appointment_provider_slot
  on public.appointment_bookings (provider_code, booking_date, start_time, status);

alter table public.appointment_bookings enable row level security;

drop policy if exists "Admins manage appointment bookings" on public.appointment_bookings;
create policy "Admins manage appointment bookings"
  on public.appointment_bookings for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Students create appointment bookings" on public.appointment_bookings;
create policy "Students create appointment bookings"
  on public.appointment_bookings for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
    and student_id = auth.uid()
  );

drop policy if exists "Students view own appointment bookings" on public.appointment_bookings;
create policy "Students view own appointment bookings"
  on public.appointment_bookings for select
  using (student_id = auth.uid());

-- If you previously used venue_code main / conf_a / conf_b, run migrate-facility-venue-codes.sql once.
