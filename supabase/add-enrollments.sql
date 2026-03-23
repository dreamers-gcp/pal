-- ============================================================
-- Student Enrollments & Multi-Group Membership
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. STUDENT ENROLLMENTS TABLE (stores CSV data)
-- This is the "master roster" the admin uploads.
-- When a student signs up with a matching email, they auto-join groups.
create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  email text not null,
  term text not null,
  subject text not null,
  credits numeric(6, 2) not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists student_enrollments_email_subject_term
  on public.student_enrollments (email, subject, term);

-- 2. STUDENT GROUP MEMBERS (many-to-many: profiles <-> student_groups)
create table if not exists public.student_group_members (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.student_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, group_id)
);

-- 3. RLS POLICIES

alter table public.student_enrollments enable row level security;
alter table public.student_group_members enable row level security;

-- Enrollments: admins can do everything, others can read
create policy "Admins can manage enrollments"
  on public.student_enrollments for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Anyone can view enrollments"
  on public.student_enrollments for select using (true);

-- Group members: admins can manage, everyone can read
create policy "Admins can manage group members"
  on public.student_group_members for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Anyone can view group members"
  on public.student_group_members for select using (true);

-- 4. FUNCTION: assign groups to a student based on their enrollments
-- Called after CSV upload or when a student signs up
create or replace function public.assign_groups_from_enrollments(p_email text)
returns void as $$
declare
  v_student_id uuid;
  v_enrollment record;
  v_group_id uuid;
begin
  -- Find the student profile
  select id into v_student_id
    from public.profiles
    where email = p_email and role = 'student';

  if v_student_id is null then
    return; -- student hasn't signed up yet
  end if;

  -- Loop through their enrollments
  for v_enrollment in
    select distinct subject from public.student_enrollments where email = p_email
  loop
    -- Find or create the student group for this subject
    select id into v_group_id
      from public.student_groups
      where name = v_enrollment.subject;

    if v_group_id is null then
      insert into public.student_groups (name)
        values (v_enrollment.subject)
        returning id into v_group_id;
    end if;

    -- Link student to group (skip if already linked)
    insert into public.student_group_members (student_id, group_id)
      values (v_student_id, v_group_id)
      on conflict (student_id, group_id) do nothing;
  end loop;

  -- Also update the legacy student_group field with the first group name
  update public.profiles
    set student_group = (
      select sg.name from public.student_group_members sgm
      join public.student_groups sg on sg.id = sgm.group_id
      where sgm.student_id = v_student_id
      order by sg.name limit 1
    ),
    updated_at = now()
    where id = v_student_id;
end;
$$ language plpgsql security definer;

-- 5. UPDATED TRIGGER: auto-assign groups on signup
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

  -- If student, check enrollments and auto-assign groups
  if coalesce(new.raw_user_meta_data->>'role', 'student') = 'student' then
    perform public.assign_groups_from_enrollments(new.email);
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Re-create the trigger (safe to run multiple times)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
