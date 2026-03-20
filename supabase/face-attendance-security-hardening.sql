-- ============================================================
-- Face attendance security hardening
-- ============================================================
-- Safe to re-run: drops/recreates policies.
--
-- Goals:
-- 1) Students can register embeddings/photos only until they complete face registration.
-- 2) Attendance insert is restricted to:
--    - student can only insert their own attendance
--    - verified=true and similarity_score >= 0.35
--    - within 15 minutes after class start time
--    - only for events where the student is in the event's assigned student groups
--    - photo_path must belong to the student folder

-- -----------------------------
-- Constants
-- -----------------------------
-- Keep in sync with face-service: SIMILARITY_THRESHOLD = 0.35

-- -----------------------------
-- 1) Lock face embedding/photo registration after completion
-- -----------------------------
drop policy if exists "Students upload own face photos" on storage.objects;
create policy "Students upload own face photos"
  on storage.objects for insert with check (
    bucket_id = 'face-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.face_registered = false
    )
  );

drop policy if exists "Students delete own face photos" on storage.objects;
create policy "Students delete own face photos"
  on storage.objects for delete using (
    bucket_id = 'face-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.face_registered = false
    )
  );

-- Read can stay permissive for the student.

drop policy if exists "Students can insert own embeddings" on public.face_embeddings;
create policy "Students can insert own embeddings"
  on public.face_embeddings for insert with check (
    auth.uid() = student_id
    and photo_path like (auth.uid()::text || '/%')
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.face_registered = false
    )
  );

drop policy if exists "Students can delete own embeddings" on public.face_embeddings;
create policy "Students can delete own embeddings"
  on public.face_embeddings for delete using (
    auth.uid() = student_id
    and photo_path like (auth.uid()::text || '/%')
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.face_registered = false
    )
  );

-- -----------------------------
-- 2) Restrict attendance marking (time window + membership + verification)
-- -----------------------------
drop policy if exists "Students can mark own attendance" on public.attendance_records;

create policy "Students can mark own attendance"
  on public.attendance_records for insert with check (
    auth.uid() = student_id
    and verified = true
    and similarity_score >= 0.35
    and photo_path like (auth.uid()::text || '/%')
    and exists (
      select 1
      from public.calendar_requests cr
      where cr.id = event_id
        and cr.status = 'approved'
        and (
          -- Legacy single-group support
          (
            cr.student_group_id is not null
            and exists (
              select 1
              from public.student_group_members sgm
              where sgm.student_id = auth.uid()
                and sgm.group_id = cr.student_group_id
            )
          )
          or
          -- Multi-group support via junction
          exists (
            select 1
            from public.calendar_request_groups crg
            join public.student_group_members sgm2
              on sgm2.group_id = crg.student_group_id
            where crg.calendar_request_id = cr.id
              and sgm2.student_id = auth.uid()
          )
        )
        and now() between
          (cr.event_date + cr.start_time)
          and
          ((cr.event_date + cr.start_time) + interval '15 minutes')
    )
  );

-- Professors can overwrite attendance (insert/delete) for students in their own approved events.
drop policy if exists "Professors can override attendance for own events" on public.attendance_records;
create policy "Professors can override attendance for own events"
  on public.attendance_records for insert with check (
    verified = true
    and similarity_score >= 0
    and exists (
      select 1
      from public.calendar_requests cr
      join public.profiles p on p.id = auth.uid()
      where cr.id = event_id
        and cr.status = 'approved'
        and (
          cr.professor_id = auth.uid()
          or cr.professor_email = p.email
        )
        and (
          (
            cr.student_group_id is not null
            and exists (
              select 1
              from public.student_group_members sgm
              where sgm.student_id = student_id
                and sgm.group_id = cr.student_group_id
            )
          )
          or exists (
            select 1
            from public.calendar_request_groups crg
            join public.student_group_members sgm2
              on sgm2.group_id = crg.student_group_id
            where crg.calendar_request_id = cr.id
              and sgm2.student_id = student_id
          )
        )
    )
  );

drop policy if exists "Professors can delete attendance for own events" on public.attendance_records;
create policy "Professors can delete attendance for own events"
  on public.attendance_records for delete using (
    exists (
      select 1
      from public.calendar_requests cr
      join public.profiles p on p.id = auth.uid()
      where cr.id = event_id
        and cr.status = 'approved'
        and (
          cr.professor_id = auth.uid()
          or cr.professor_email = p.email
        )
    )
  );

