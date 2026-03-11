-- Run this in Supabase SQL Editor
-- Allows professors to see all APPROVED requests (for the Booked Schedule view)

create policy "Professors can view all approved requests"
  on public.calendar_requests for select using (
    status = 'approved'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'professor')
  );
