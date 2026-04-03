-- Allow professors to read all *approved* facility bookings so the Calendar tab can
-- show campus facility availability alongside classroom bookings.
-- (Existing policy still allows them to see their own rows at any status.)

drop policy if exists "Professors view approved facility bookings" on public.facility_bookings;
create policy "Professors view approved facility bookings"
  on public.facility_bookings for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'professor'
    )
    and status = 'approved'
  );
