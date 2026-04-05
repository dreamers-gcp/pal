-- Professor request types + venue-style classrooms (run in Supabase SQL Editor on existing projects).

-- ---------------------------------------------------------------------------
-- 1) Expand request_kind (migrate legacy class → extra_class)
-- ---------------------------------------------------------------------------
alter table public.calendar_requests
  drop constraint if exists calendar_requests_request_kind_check;

update public.calendar_requests
set request_kind = 'extra_class'
where request_kind = 'class';

alter table public.calendar_requests
  add constraint calendar_requests_request_kind_check
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

alter table public.calendar_requests
  alter column request_kind set default 'extra_class';

comment on column public.calendar_requests.request_kind is
  'Professor-facing event category (guest speaker, exam, conclave, etc.).';

-- ---------------------------------------------------------------------------
-- 2) Normalize Exam Hall naming + seed venue rows (unique on classrooms.name)
-- ---------------------------------------------------------------------------
update public.classrooms
set name = 'Exam hall'
where name = 'Exam Hall';

insert into public.classrooms (name, capacity)
values
  ('Class room', 40),
  ('Exam hall', 200),
  ('Seminar hall', 80),
  ('Board room', 20),
  ('Auditorium', 300),
  ('Computer hall', 50)
on conflict (name) do nothing;
