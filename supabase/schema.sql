-- ============================================================
-- PAL - Calendar Blocking Web App
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null default '',
  role text not null default 'student' check (role in ('student', 'professor', 'admin')),
  student_group text, -- e.g. "CS-2024-A", "ECE-2024-B"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. CLASSROOMS TABLE
create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- e.g. "Room 101", "Lecture Hall A"
  capacity int,
  created_at timestamptz not null default now()
);

-- 3. STUDENT GROUPS TABLE
create table public.student_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- e.g. "CS-2024-A"
  department text,
  created_at timestamptz not null default now()
);

-- 4. CALENDAR REQUESTS TABLE (core of the app)
create type public.request_status as enum (
  'pending',
  'approved',
  'rejected',
  'clarification_needed'
);

create table public.calendar_requests (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references public.profiles(id) on delete cascade,
  professor_email text,
  title text not null,
  description text,
  student_group_id uuid not null references public.student_groups(id),
  classroom_id uuid not null references public.classrooms(id),
  event_date date not null,
  start_time time not null,
  end_time time not null,
  status public.request_status not null default 'pending',
  admin_note text, -- admin's message when rejecting or asking clarification
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. ROW LEVEL SECURITY (RLS)

alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.student_groups enable row level security;
alter table public.calendar_requests enable row level security;

-- Profiles: users can read all profiles, update only their own
create policy "Anyone can view profiles"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Classrooms: everyone can read
create policy "Anyone can view classrooms"
  on public.classrooms for select using (true);

create policy "Admins can manage classrooms"
  on public.classrooms for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Student groups: everyone can read
create policy "Anyone can view student groups"
  on public.student_groups for select using (true);

create policy "Admins can manage student groups"
  on public.student_groups for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Calendar requests:
-- Professors can create and view their own requests
create policy "Professors can create requests"
  on public.calendar_requests for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'professor')
    and professor_id = auth.uid()
  );

create policy "Professors can view own requests"
  on public.calendar_requests for select using (
    professor_id = auth.uid()
  );

create policy "Professors can view all approved requests"
  on public.calendar_requests for select using (
    status = 'approved'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'professor')
  );

-- Admins can view and update all requests
create policy "Admins can view all requests"
  on public.calendar_requests for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update requests"
  on public.calendar_requests for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Students can view approved requests for their groups
create policy "Students can view approved events for their group"
  on public.calendar_requests for select using (
    status = 'approved'
    and (
      exists (
        select 1
        from public.profiles p
        join public.student_enrollments se on se.email = p.email
        join public.student_groups sg on sg.name = se.subject
        where p.id = auth.uid()
          and sg.id = student_group_id
      )
      or
      exists (
        select 1 from public.student_group_members sgm
        where sgm.student_id = auth.uid()
          and sgm.group_id = student_group_id
      )
      or
      exists (
        select 1 from public.profiles p
        join public.student_groups sg on sg.name = p.student_group
        where p.id = auth.uid()
          and p.role = 'student'
          and sg.id = student_group_id
      )
    )
  );

-- 6. AUTO-CREATE PROFILE ON SIGNUP (trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. SEED DATA: some classrooms and student groups
insert into public.classrooms (name, capacity) values
  ('Room 101', 40),
  ('Room 102', 30),
  ('Lecture Hall A', 120),
  ('Lecture Hall B', 100),
  ('Lab 201', 25),
  ('Lab 202', 25);

insert into public.student_groups (name, department) values
  ('CS-2024-A', 'Computer Science'),
  ('CS-2024-B', 'Computer Science'),
  ('ECE-2024-A', 'Electronics'),
  ('ECE-2024-B', 'Electronics'),
  ('ME-2024-A', 'Mechanical'),
  ('ME-2024-B', 'Mechanical');
