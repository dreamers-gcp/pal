-- Optional subject on calendar requests + program student groups for professor booking form.
-- Run in Supabase SQL Editor.

alter table public.calendar_requests
  add column if not exists subject text;

comment on column public.calendar_requests.subject is
  'Optional subject(s): JSON array text e.g. ["Course A","Course B"], or legacy single plain string.';

insert into public.student_groups (name, department) values
  ('GMP-A', null),
  ('GMP-B', null),
  ('HRM-A', null),
  ('HRM-B', null),
  ('HRM-C', null),
  ('BM-A', null),
  ('BM-B', null),
  ('BM-C', null),
  ('BM-D', null)
on conflict (name) do nothing;
