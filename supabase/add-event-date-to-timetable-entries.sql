-- Store concrete session dates for full-term generated timetables.
alter table public.timetable_entries
  add column if not exists event_date date;

create index if not exists idx_timetable_entries_timetable_event_date
  on public.timetable_entries (timetable_id, event_date);
