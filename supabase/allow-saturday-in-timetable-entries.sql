-- Allow Saturday in timetable entries (1=Mon ... 6=Sat).
do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'timetable_entries'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%day_of_week%'
    and pg_get_constraintdef(c.oid) ilike '%between 1 and 5%';

  if constraint_name is not null then
    execute format('alter table public.timetable_entries drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.timetable_entries
  drop constraint if exists timetable_entries_day_of_week_check;

alter table public.timetable_entries
  add constraint timetable_entries_day_of_week_check
  check (day_of_week between 1 and 6);
