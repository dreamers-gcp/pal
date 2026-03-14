-- Fix: Update student RLS policy to support all group assignment methods
-- Run this in your Supabase SQL Editor

drop policy if exists "Students can view approved events for their group" on public.calendar_requests;

create policy "Students can view approved events for their group"
  on public.calendar_requests for select using (
    status = 'approved'
    and (
      -- Method 1: student_enrollments (CSV-based) — match email to enrolled subjects
      exists (
        select 1
        from public.profiles p
        join public.student_enrollments se on se.email = p.email
        join public.student_groups sg on sg.name = se.subject
        where p.id = auth.uid()
          and sg.id = student_group_id
      )
      or
      -- Method 2: student_group_members join table
      exists (
        select 1 from public.student_group_members sgm
        where sgm.student_id = auth.uid()
          and sgm.group_id = student_group_id
      )
      or
      -- Method 3: Legacy profiles.student_group field
      exists (
        select 1 from public.profiles p
        join public.student_groups sg on sg.name = p.student_group
        where p.id = auth.uid()
          and p.role = 'student'
          and sg.id = student_group_id
      )
    )
  );
