-- Reset professor_assignments to a single clear schema (run in Supabase SQL Editor).
-- WARNING: Deletes all rows in professor_assignments.

drop table if exists public.professor_assignments cascade;

create table public.professor_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id text not null default '',
  term text not null,
  subject text not null,
  professor text not null,
  email text not null,
  credits numeric(6, 2) not null default 0,
  preferred_slot_1 text,
  preferred_slot_2 text,
  preferred_slot_3 text,
  max_hours_per_day int not null default 4,
  created_at timestamptz not null default now()
);

create unique index professor_assignments_email_subject_term
  on public.professor_assignments (email, subject, term);

alter table public.professor_assignments enable row level security;

create policy "Admins can manage professor assignments"
  on public.professor_assignments for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Anyone can view professor assignments"
  on public.professor_assignments for select using (true);
