-- Let students and professors load approved bookings for scheduling UIs (mini calendars).
-- Policies are OR'd with existing "own row" policies.

-- Sports: any approved booking for a venue is visible to authenticated students/professors.
drop policy if exists "Students view approved sports for availability" on public.sports_bookings;
create policy "Students view approved sports for availability"
  on public.sports_bookings for select
  using (
    status = 'approved'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
  );

drop policy if exists "Professors view approved sports for availability" on public.sports_bookings;
create policy "Professors view approved sports for availability"
  on public.sports_bookings for select
  using (
    status = 'approved'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'professor')
  );

-- Auditorium: students need approved slots for the hall they are booking.
drop policy if exists "Students view approved auditorium bookings for availability" on public.facility_bookings;
create policy "Students view approved auditorium bookings for availability"
  on public.facility_bookings for select
  using (
    status = 'approved'
    and facility_type = 'auditorium'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
  );

-- Health: students see approved slots for any provider so they can pick free times.
-- Rows may include other students’ bookings; the UI only shows times as busy (not identities).
drop policy if exists "Students view approved appointments for availability" on public.appointment_bookings;
create policy "Students view approved appointments for availability"
  on public.appointment_bookings for select
  using (
    status = 'approved'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
  );
