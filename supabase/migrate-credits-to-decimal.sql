-- Allow decimal credits (e.g. 1.5, 2.25) on student enrollments.
-- professor_assignments.credits is already numeric(6,2) if you used recreate-professor-assignments.sql.

alter table public.student_enrollments
  alter column credits type numeric(6, 2)
  using round(credits::numeric, 2);

alter table public.student_enrollments
  alter column credits set default 0;
