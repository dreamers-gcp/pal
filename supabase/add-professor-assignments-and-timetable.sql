-- ============================================================
-- Professor Assignments & Timetable Generation
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. PROFESSOR ASSIGNMENTS TABLE (CSV data: which professor teaches what)
create table if not exists public.professor_assignments (
  id uuid primary key default gen_random_uuid(),
  professor_name text not null,
  email text not null,
  term text not null,
  subject text not null,
  credits int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists professor_assignments_email_subject_term
  on public.professor_assignments (email, subject, term);

-- 2. GENERATED TIMETABLES TABLE (stores each generated timetable batch)
create table if not exists public.generated_timetables (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  start_date date not null,
  end_date date not null,
  max_hours_per_day int not null default 4,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  generated_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. TIMETABLE ENTRIES TABLE (individual class slots in a generated timetable)
create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.generated_timetables(id) on delete cascade,
  professor_id uuid references public.profiles(id),
  professor_email text not null,
  subject text not null,
  student_group_id uuid references public.student_groups(id),
  classroom_id uuid references public.classrooms(id),
  day_of_week int not null check (day_of_week between 1 and 5),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

-- 4. RLS POLICIES

alter table public.professor_assignments enable row level security;
alter table public.generated_timetables enable row level security;
alter table public.timetable_entries enable row level security;

-- Professor assignments: admins manage, everyone reads
create policy "Admins can manage professor assignments"
  on public.professor_assignments for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Anyone can view professor assignments"
  on public.professor_assignments for select using (true);

-- Generated timetables: admins manage, everyone reads
create policy "Admins can manage timetables"
  on public.generated_timetables for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Anyone can view timetables"
  on public.generated_timetables for select using (true);

-- Timetable entries: admins manage, everyone reads
create policy "Admins can manage timetable entries"
  on public.timetable_entries for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Anyone can view timetable entries"
  on public.timetable_entries for select using (true);

-- 5. Allow admins to insert calendar_requests (for approved timetable entries)
-- This is needed because only professors can insert by default
create policy "Admins can create calendar requests"
  on public.calendar_requests for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
