-- Run in Supabase SQL Editor (or migrate).
-- Lets students see the same campus-wide approved schedule as professors:
-- any approved classroom or facility booking is visible for slot transparency.
-- OR-combines with existing policies (own rows, group-scoped rows, etc.).

drop policy if exists "Students view approved calendar requests for scheduling" on public.calendar_requests;
create policy "Students view approved calendar requests for scheduling"
  on public.calendar_requests for select
  using (
    status = 'approved'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
  );

drop policy if exists "Students view approved facility bookings for scheduling" on public.facility_bookings;
create policy "Students view approved facility bookings for scheduling"
  on public.facility_bookings for select
  using (
    status = 'approved'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
  );
