-- Optional infrastructure requirements on professor calendar requests.
-- Run in Supabase SQL Editor.

alter table public.calendar_requests
  add column if not exists infra_requirements jsonb;

comment on column public.calendar_requests.infra_requirements is
  'Optional JSON: mic_count, sofa_count, video_recording, photography, stage, momento_count, bouquet_count';
