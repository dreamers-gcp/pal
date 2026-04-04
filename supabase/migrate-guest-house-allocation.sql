-- Guest house: requester submits guest count only; admin assigns rooms after approval.
-- Run in Supabase SQL Editor once.

alter table public.guest_house_bookings
  add column if not exists guest_count integer not null default 1
    check (guest_count >= 1 and guest_count <= 200);

alter table public.guest_house_bookings
  add column if not exists allocated_rooms jsonb;

-- Pending requests have no house/room yet; legacy rows keep values
alter table public.guest_house_bookings
  alter column guest_house drop not null;

comment on column public.guest_house_bookings.guest_count is 'Number of guests; max 4 per room; admin assigns rooms.';
comment on column public.guest_house_bookings.allocated_rooms is 'Admin-set list: [{guest_house, room_number}, ...] when approved.';

update public.guest_house_bookings
set guest_count = 1
where guest_count is null;
