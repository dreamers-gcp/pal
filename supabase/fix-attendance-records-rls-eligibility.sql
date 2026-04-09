-- Align attendance_records INSERT policies with how students are linked to classes:
-- - student_group_members (program groups after assign_groups_from_enrollments)
-- - student_enrollments: program OR subject name matching the event's student_groups row
-- - legacy profiles.student_group name matching the event's group
--
-- Without this, students may see approved slots (campus-wide select policy) but INSERT fails
-- when they are only tied via enrollments / legacy profile and not yet in student_group_members.
--
-- IMPORTANT — time window:
-- The old policy required: now() between (event_date + start_time) and + 15 minutes.
-- On Supabase, `now()` is timestamptz (usually UTC) while `event_date + start_time` is a
-- timestamp without time zone, so the comparison uses the DB session timezone and almost
-- always misses the real class start in local time → RLS rejects valid inserts.
-- The web/mobile app already enforces the 15-minute window in the UI; we do NOT repeat it here.
--
-- Safe to re-run: drops and recreates the two insert policies from
-- face-attendance-security-hardening.sql (minus broken server time check).

drop policy if exists "Students can mark own attendance" on public.attendance_records;

create policy "Students can mark own attendance"
  on public.attendance_records for insert
  with check (
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
          (
            cr.student_group_id is not null
            and (
              exists (
                select 1
                from public.student_group_members sgm
                where sgm.student_id = auth.uid()
                  and sgm.group_id = cr.student_group_id
              )
              or exists (
                select 1
                from public.profiles p
                join public.student_enrollments se on lower(trim(se.email)) = lower(trim(p.email))
                join public.student_groups sg on sg.id = cr.student_group_id
                where p.id = auth.uid()
                  and (
                    (
                      se.program is not null
                      and trim(se.program) <> ''
                      and lower(trim(sg.name)) = lower(trim(se.program))
                    )
                    or (
                      se.subject is not null
                      and trim(se.subject) <> ''
                      and lower(trim(sg.name)) = lower(trim(se.subject))
                    )
                  )
              )
              or exists (
                select 1
                from public.profiles p
                join public.student_groups sg on sg.id = cr.student_group_id
                where p.id = auth.uid()
                  and p.role = 'student'
                  and p.student_group is not null
                  and trim(p.student_group) <> ''
                  and lower(trim(sg.name)) = lower(trim(p.student_group))
              )
            )
          )
          or exists (
            select 1
            from public.calendar_request_groups crg
            where crg.calendar_request_id = cr.id
              and (
                exists (
                  select 1
                  from public.student_group_members sgm2
                  where sgm2.student_id = auth.uid()
                    and sgm2.group_id = crg.student_group_id
                )
                or exists (
                  select 1
                  from public.profiles p
                  join public.student_enrollments se on lower(trim(se.email)) = lower(trim(p.email))
                  join public.student_groups sg on sg.id = crg.student_group_id
                  where p.id = auth.uid()
                    and (
                      (
                        se.program is not null
                        and trim(se.program) <> ''
                        and lower(trim(sg.name)) = lower(trim(se.program))
                      )
                      or (
                        se.subject is not null
                        and trim(se.subject) <> ''
                        and lower(trim(sg.name)) = lower(trim(se.subject))
                      )
                    )
                )
                or exists (
                  select 1
                  from public.profiles p
                  join public.student_groups sg on sg.id = crg.student_group_id
                  where p.id = auth.uid()
                    and p.role = 'student'
                    and p.student_group is not null
                    and trim(p.student_group) <> ''
                    and lower(trim(sg.name)) = lower(trim(p.student_group))
                )
              )
          )
        )
    )
  );

drop policy if exists "Professors can override attendance for own events" on public.attendance_records;

create policy "Professors can override attendance for own events"
  on public.attendance_records for insert
  with check (
    (
      (verified = true and similarity_score >= 0 and photo_path like 'manual-override/%')
      or (verified = false and similarity_score >= 0 and photo_path like 'manual-override-absent/%')
    )
    and exists (
      select 1
      from public.calendar_requests cr
      join public.profiles p on p.id = auth.uid()
      where cr.id = event_id
        and cr.status = 'approved'
        and (
          cr.professor_id = auth.uid()
          or lower(trim(cr.professor_email)) = lower(trim(p.email))
        )
        and (
          (
            cr.student_group_id is not null
            and (
              exists (
                select 1
                from public.student_group_members sgm
                where sgm.student_id = student_id
                  and sgm.group_id = cr.student_group_id
              )
              or exists (
                select 1
                from public.profiles ps
                join public.student_enrollments se on lower(trim(se.email)) = lower(trim(ps.email))
                join public.student_groups sg on sg.id = cr.student_group_id
                where ps.id = student_id
                  and (
                    (
                      se.program is not null
                      and trim(se.program) <> ''
                      and lower(trim(sg.name)) = lower(trim(se.program))
                    )
                    or (
                      se.subject is not null
                      and trim(se.subject) <> ''
                      and lower(trim(sg.name)) = lower(trim(se.subject))
                    )
                  )
              )
              or exists (
                select 1
                from public.profiles ps
                join public.student_groups sg on sg.id = cr.student_group_id
                where ps.id = student_id
                  and ps.role = 'student'
                  and ps.student_group is not null
                  and trim(ps.student_group) <> ''
                  and lower(trim(sg.name)) = lower(trim(ps.student_group))
              )
            )
          )
          or exists (
            select 1
            from public.calendar_request_groups crg
            where crg.calendar_request_id = cr.id
              and (
                exists (
                  select 1
                  from public.student_group_members sgm2
                  where sgm2.student_id = student_id
                    and sgm2.group_id = crg.student_group_id
                )
                or exists (
                  select 1
                  from public.profiles ps
                  join public.student_enrollments se on lower(trim(se.email)) = lower(trim(ps.email))
                  join public.student_groups sg on sg.id = crg.student_group_id
                  where ps.id = student_id
                    and (
                      (
                        se.program is not null
                        and trim(se.program) <> ''
                        and lower(trim(sg.name)) = lower(trim(se.program))
                      )
                      or (
                        se.subject is not null
                        and trim(se.subject) <> ''
                        and lower(trim(sg.name)) = lower(trim(se.subject))
                      )
                    )
                )
                or exists (
                  select 1
                  from public.profiles ps
                  join public.student_groups sg on sg.id = crg.student_group_id
                  where ps.id = student_id
                    and ps.role = 'student'
                    and ps.student_group is not null
                    and trim(ps.student_group) <> ''
                    and lower(trim(sg.name)) = lower(trim(ps.student_group))
                )
              )
          )
        )
    )
  );

-- Professors: UPDATE required for upsert when a row already exists (Mark Present again / refresh).
drop policy if exists "Professors can update attendance for own events" on public.attendance_records;

create policy "Professors can update attendance for own events"
  on public.attendance_records for update
  using (
    exists (
      select 1
      from public.calendar_requests cr
      join public.profiles p on p.id = auth.uid()
      where cr.id = event_id
        and cr.status = 'approved'
        and (
          cr.professor_id = auth.uid()
          or lower(trim(cr.professor_email)) = lower(trim(p.email))
        )
    )
  )
  with check (
    (
      (verified = true and similarity_score >= 0 and photo_path like 'manual-override/%')
      or (verified = false and similarity_score >= 0 and photo_path like 'manual-override-absent/%')
    )
    and exists (
      select 1
      from public.calendar_requests cr
      join public.profiles p on p.id = auth.uid()
      where cr.id = event_id
        and cr.status = 'approved'
        and (
          cr.professor_id = auth.uid()
          or lower(trim(cr.professor_email)) = lower(trim(p.email))
        )
        and (
          (
            cr.student_group_id is not null
            and (
              exists (
                select 1
                from public.student_group_members sgm
                where sgm.student_id = student_id
                  and sgm.group_id = cr.student_group_id
              )
              or exists (
                select 1
                from public.profiles ps
                join public.student_enrollments se on lower(trim(se.email)) = lower(trim(ps.email))
                join public.student_groups sg on sg.id = cr.student_group_id
                where ps.id = student_id
                  and (
                    (
                      se.program is not null
                      and trim(se.program) <> ''
                      and lower(trim(sg.name)) = lower(trim(se.program))
                    )
                    or (
                      se.subject is not null
                      and trim(se.subject) <> ''
                      and lower(trim(sg.name)) = lower(trim(se.subject))
                    )
                  )
              )
              or exists (
                select 1
                from public.profiles ps
                join public.student_groups sg on sg.id = cr.student_group_id
                where ps.id = student_id
                  and ps.role = 'student'
                  and ps.student_group is not null
                  and trim(ps.student_group) <> ''
                  and lower(trim(sg.name)) = lower(trim(ps.student_group))
              )
            )
          )
          or exists (
            select 1
            from public.calendar_request_groups crg
            where crg.calendar_request_id = cr.id
              and (
                exists (
                  select 1
                  from public.student_group_members sgm2
                  where sgm2.student_id = student_id
                    and sgm2.group_id = crg.student_group_id
                )
                or exists (
                  select 1
                  from public.profiles ps
                  join public.student_enrollments se on lower(trim(se.email)) = lower(trim(ps.email))
                  join public.student_groups sg on sg.id = crg.student_group_id
                  where ps.id = student_id
                    and (
                      (
                        se.program is not null
                        and trim(se.program) <> ''
                        and lower(trim(sg.name)) = lower(trim(se.program))
                      )
                      or (
                        se.subject is not null
                        and trim(se.subject) <> ''
                        and lower(trim(sg.name)) = lower(trim(se.subject))
                      )
                    )
                )
                or exists (
                  select 1
                  from public.profiles ps
                  join public.student_groups sg on sg.id = crg.student_group_id
                  where ps.id = student_id
                    and ps.role = 'student'
                    and ps.student_group is not null
                    and trim(ps.student_group) <> ''
                    and lower(trim(sg.name)) = lower(trim(ps.student_group))
                )
              )
          )
        )
    )
  );
