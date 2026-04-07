-- Normalize classroom venue names to Title Case without breaking FKs.
--
-- Why this exists:
-- - `add-campus-use-cases.sql` / `expand-professor-request-kinds-and-venues.sql` may insert
--   venue rows with mixed casing (e.g. "Board room").
-- - A later run with different casing can insert a second row ("Board Room") because the
--   unique constraint on `name` is case-sensitive.
-- - Simply DELETE-ing the old row fails if `calendar_requests` or `timetable_entries` still
--   reference it (FK calendar_requests_classroom_id_fkey, etc.).
--
-- Strategy: if both old and canonical rows exist, re-point FKs to the canonical id, then
-- remove the duplicate row. If only the old row exists, rename it in place.

create or replace function public.merge_classroom_name_pair(old_name text, canonical_name text)
returns void
language plpgsql
as $$
declare
  old_id uuid;
  new_id uuid;
begin
  select id into old_id from public.classrooms where name = old_name;
  select id into new_id from public.classrooms where name = canonical_name;

  -- Only canonical row exists (or nothing): nothing to merge
  if old_id is null then
    return;
  end if;

  -- Only old row exists: rename in place
  if new_id is null then
    update public.classrooms
    set name = canonical_name
    where id = old_id;
    return;
  end if;

  -- Same row (already correct)
  if old_id = new_id then
    return;
  end if;

  -- Both rows exist: move references to canonical row, drop duplicate
  update public.calendar_requests
  set classroom_id = new_id
  where classroom_id = old_id;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'timetable_entries'
  ) then
    update public.timetable_entries
    set classroom_id = new_id
    where classroom_id = old_id;
  end if;

  delete from public.classrooms where id = old_id;
end;
$$;

select public.merge_classroom_name_pair('Class room', 'Class Room');
select public.merge_classroom_name_pair('Exam hall', 'Exam Hall');
select public.merge_classroom_name_pair('Seminar hall', 'Seminar Hall');
select public.merge_classroom_name_pair('Board room', 'Board Room');
select public.merge_classroom_name_pair('Computer hall', 'Computer Hall');

drop function public.merge_classroom_name_pair(text, text);
