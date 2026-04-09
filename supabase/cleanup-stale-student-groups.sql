-- Remove stale student_groups entries that are NOT a current program
-- from the enrollment CSV AND have no calendar request references.
-- Run this in Supabase SQL Editor.

-- Current valid program names from enrollment CSV
-- (preview what will be kept)
-- select distinct program from public.student_enrollments
--   where program is not null and program <> '';

-- 1. Remove student_group_members links for stale groups
delete from public.student_group_members
where group_id in (
  select sg.id from public.student_groups sg
  where sg.name not in (
    select distinct program from public.student_enrollments
    where program is not null and program <> ''
  )
);

-- 2. Remove calendar_request_groups links for stale groups
delete from public.calendar_request_groups
where student_group_id in (
  select sg.id from public.student_groups sg
  where sg.name not in (
    select distinct program from public.student_enrollments
    where program is not null and program <> ''
  )
);

-- 3. Delete stale student_groups that are no longer referenced by
--    calendar_requests.student_group_id (NOT NULL FK)
delete from public.student_groups
where name not in (
  select distinct program from public.student_enrollments
  where program is not null and program <> ''
)
and id not in (
  select distinct student_group_id from public.calendar_requests
);
