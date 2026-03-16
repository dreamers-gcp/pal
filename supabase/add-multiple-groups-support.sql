-- Add support for multiple student groups per calendar request
-- This migration creates a junction table to handle many-to-many relationship

-- 1. Create junction table for calendar requests and student groups
create table public.calendar_request_groups (
  id uuid primary key default gen_random_uuid(),
  calendar_request_id uuid not null references public.calendar_requests(id) on delete cascade,
  student_group_id uuid not null references public.student_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(calendar_request_id, student_group_id)
);

-- 2. Add RLS policy for the junction table
alter table public.calendar_request_groups enable row level security;

create policy "Anyone can view calendar request groups"
  on public.calendar_request_groups for select using (true);

create policy "Professors can manage their request groups"
  on public.calendar_request_groups for all using (
    exists (
      select 1 from public.calendar_requests cr
      where cr.id = calendar_request_id 
      and cr.professor_id = auth.uid()
    )
  );

create policy "Admins can manage all request groups"
  on public.calendar_request_groups for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 3. Migrate existing data from single student_group_id to junction table
insert into public.calendar_request_groups (calendar_request_id, student_group_id)
select id, student_group_id from public.calendar_requests
where student_group_id is not null
on conflict do nothing;

-- 4. Make student_group_id nullable in calendar_requests (for backward compatibility)
-- Note: We keep the column for now but it will be deprecated
-- alter table public.calendar_requests alter column student_group_id drop not null;
