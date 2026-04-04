-- Requested number of rooms (min ceil(guest_count/4); students may request more).
-- Run in Supabase SQL Editor once.

alter table public.guest_house_bookings
  add column if not exists requested_room_count integer;

update public.guest_house_bookings
set requested_room_count = greatest(1, (guest_count + 3) / 4)
where requested_room_count is null;

alter table public.guest_house_bookings
  alter column requested_room_count set default 1;

alter table public.guest_house_bookings
  alter column requested_room_count set not null;

alter table public.guest_house_bookings
  drop constraint if exists guest_house_bookings_requested_room_count_range;

alter table public.guest_house_bookings
  add constraint guest_house_bookings_requested_room_count_range
  check (requested_room_count >= 1 and requested_room_count <= 200);

comment on column public.guest_house_bookings.requested_room_count is
  'Rooms requested; must be at least ceil(guest_count/4); max 4 guests per room capacity.';
