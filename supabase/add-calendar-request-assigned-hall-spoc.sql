-- Admin approval fields for calendar (classroom) requests. Run in Supabase SQL Editor.

alter table public.calendar_requests
  add column if not exists assigned_hall text,
  add column if not exists admin_spoc text;

comment on column public.calendar_requests.assigned_hall is
  'Hall/venue assigned by admin when approving the request.';

comment on column public.calendar_requests.admin_spoc is
  'Admin single point of contact recorded at approval.';
