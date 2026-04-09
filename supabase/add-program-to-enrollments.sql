-- Add a `program` column to student_enrollments so the CSV can carry
-- the student's program (GMP-A, BM-C, …) separately from their subjects.
-- Run this in Supabase SQL Editor.

-- 1. Add the column (nullable so existing rows aren't broken)
alter table public.student_enrollments
  add column if not exists program text;

-- 2. Update assign_groups_from_enrollments to use the `program` column
--    for linking students to student_groups (programs), instead of `subject`.
create or replace function public.assign_groups_from_enrollments(p_email text)
returns void as $$
declare
  v_student_id uuid;
  v_enrollment record;
  v_group_id uuid;
  v_first_program text;
begin
  select id into v_student_id
    from public.profiles
    where email = p_email and role = 'student';

  if v_student_id is null then
    return;
  end if;

  -- Link student to each distinct program found in their enrollments
  for v_enrollment in
    select distinct program
      from public.student_enrollments
      where email = p_email and program is not null and program <> ''
  loop
    select id into v_group_id
      from public.student_groups
      where name = v_enrollment.program;

    if v_group_id is null then
      insert into public.student_groups (name)
        values (v_enrollment.program)
        returning id into v_group_id;
    end if;

    insert into public.student_group_members (student_id, group_id)
      values (v_student_id, v_group_id)
      on conflict (student_id, group_id) do nothing;
  end loop;

  -- Update legacy profiles.student_group with the first program name
  select sg.name into v_first_program
    from public.student_group_members sgm
    join public.student_groups sg on sg.id = sgm.group_id
    where sgm.student_id = v_student_id
    order by sg.name limit 1;

  update public.profiles
    set student_group = v_first_program,
        updated_at = now()
    where id = v_student_id;
end;
$$ language plpgsql security definer;
